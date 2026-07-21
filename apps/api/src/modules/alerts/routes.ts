import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { assertSecretsConfigured } from "../../security/secrets.service.js";
import { AuditService } from "../../services/audit.service.js";
import { AlertDeliveryService } from "./alert-delivery.service.js";
import { AlertTemplateService } from "./alert-template.service.js";
import { NotificationHistoryService } from "./notification-history.service.js";

const telegramSchema = z.object({
  provider: z.literal("TELEGRAM"),
  name: z.string().trim().min(1).max(80),
  enabled: z.boolean().default(true),
  botToken: z.string().trim().regex(/^\d+:[A-Za-z0-9_-]{20,}$/, "Enter a valid Telegram bot token."),
  chatId: z.string().trim().min(1).max(100)
});

const discordSchema = z.object({
  provider: z.literal("DISCORD"),
  name: z.string().trim().min(1).max(80),
  enabled: z.boolean().default(true),
  webhookUrl: z.string().url().refine((value) => /^https:\/\/(?:canary\.|ptb\.)?(?:discord\.com|discordapp\.com)\/api\/webhooks\/\d+\/[A-Za-z0-9._-]+$/.test(value), "Enter an official Discord incoming webhook URL.")
});

const createSchema = z.discriminatedUnion("provider", [telegramSchema, discordSchema]);
const patchSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  enabled: z.boolean().optional(),
  botToken: z.string().trim().optional(),
  chatId: z.string().trim().optional(),
  webhookUrl: z.string().trim().optional()
});

const templateTypeSchema = z.enum(["ACCEPTED_PRICE_FOUND", "MSRP_MATCH_FOUND", "PRICE_DROPPED_ACCEPTED", "UNKNOWN_MSRP_MAPPING", "HUMAN_REVIEW_NEEDED", "SCAN_FAILED", "CONFIGURATION_NEEDED", "TEST_ALERT"]);
const previewSchema = z.object({ templateType: templateTypeSchema, stockCheckResultId: z.string().optional(), channelId: z.string().optional() });
const settingsSchema = z.object({
  compactMobileAlerts: z.boolean().optional(),
  includeProductImage: z.boolean().optional(),
  includeMsrpDetails: z.boolean().optional(),
  includeOpenProductLink: z.boolean().optional()
});

async function previewInput(app: FastifyInstance, ownerId: string, input: z.infer<typeof previewSchema>) {
  const stock = input.stockCheckResultId
    ? await app.prisma.stockCheckResult.findFirst({ where: { id: input.stockCheckResultId, store: { ownerId } }, include: { store: true, retailerProduct: true } })
    : await app.prisma.stockCheckResult.findFirst({ where: { store: { ownerId } }, include: { store: true, retailerProduct: true }, orderBy: { checkedAt: "desc" } });
  return { stock, templateType: input.templateType };
}

export async function registerAlertRoutes(app: FastifyInstance): Promise<void> {
  const service = () => new AlertDeliveryService(app.prisma);
  const templates = () => new AlertTemplateService(app.prisma);
  const history = () => new NotificationHistoryService(app.prisma);
  const audit = () => new AuditService(app.prisma);

  app.get("/notifications", async (request) => {
    const query = z.object({
      status: z.enum(["SENT", "FAILED", "SUPPRESSED", "PENDING"]).optional(),
      provider: z.enum(["DISCORD", "TELEGRAM"]).optional(),
      priority: z.literal("HIGH_URGENT").optional(),
      period: z.enum(["TODAY", "LAST_7_DAYS"]).optional()
    }).parse(request.query);
    return { notifications: await history().list(request.currentUser!.id, query) };
  });

  app.get("/notifications/:id", async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const notification = await history().detail(request.currentUser!.id, id);
    return notification ? { notification } : reply.notFound("Notification not found");
  });

  app.get("/alert-settings", async (request) => ({ settings: await templates().getSettings(request.currentUser!.id) }));

  app.put("/alert-settings", async (request) => {
    const patch = settingsSchema.parse(request.body);
    const settings = await templates().saveSettings(request.currentUser!.id, patch);
    await audit().log({ action: "ALERT_SETTINGS_UPDATED", summary: "Alert template settings updated.", actorUserId: request.currentUser!.id, metadata: settings });
    return { settings };
  });

  app.post("/alerts/preview", async (request) => {
    const input = previewSchema.parse(request.body);
    const { stock, templateType } = await previewInput(app, request.currentUser!.id, input);
    const preview = templates().render({
      templateType,
      productName: stock?.retailerProduct.name ?? "Pokemon Booster Bundle",
      storeName: stock?.store.name ?? "Best Buy",
      priceCents: stock?.priceCents ?? 2699,
      msrpCents: stock?.msrpCents ?? 2699,
      acceptedMaxPriceCents: stock?.acceptedMaxPriceCents ?? 3499,
      stockStatus: stock?.stockStatus ?? "IN_STOCK",
      priceStatus: stock?.priceStatus ?? "MSRP_MATCH",
      productUrl: stock?.retailerProduct.productUrl,
      imageUrl: stock?.retailerProduct.imageUrl,
      fallbackMessage: templateType === "CONFIGURATION_NEEDED" ? "Best Buy scan skipped. Reason: API key not configured." : undefined,
      test: false
    }, await templates().getSettings(request.currentUser!.id));
    await audit().log({ action: "ALERT_TEMPLATE_PREVIEWED", summary: "Alert template previewed.", actorUserId: request.currentUser!.id, metadata: { templateType, stockCheckResultId: stock?.id ?? null } });
    return { preview };
  });

  app.post("/alerts/preview/send", async (request, reply) => {
    const input = previewSchema.parse(request.body);
    const { stock, templateType } = await previewInput(app, request.currentUser!.id, input);
    const channel = input.channelId ? await service().getChannel(request.currentUser!.id, input.channelId) : null;
    if (!channel) return reply.code(422).send({ error: "Choose a configured alert channel before sending a test." });
    const event = await app.prisma.alertEvent.create({
      data: {
        ownerId: request.currentUser!.id,
        alertChannelId: channel.id,
        stockCheckResultId: stock?.id,
        type: templateType === "SCAN_FAILED" || templateType === "CONFIGURATION_NEEDED" ? "ERROR" : templateType === "HUMAN_REVIEW_NEEDED" ? "HUMAN_ACTION_NEEDED" : "ACCEPTABLE_PRICE_FOUND",
        templateType,
        title: "TEST ALERT - PokeDad Radar",
        priority: templates().priorityFor(templateType, stock?.priceStatus),
        status: "PENDING",
        message: "TEST ALERT - PokeDad Radar. Preview delivery only; no cart or checkout action is performed."
      }
    });
    const result = await service().deliverEvent(request.currentUser!.id, event.id, channel.id);
    const delivered = result.deliveries.some((item) => item.status === "SENT");
    await audit().log({ action: delivered ? "ALERT_PREVIEW_TEST_SENT" : "ALERT_PREVIEW_TEST_FAILED", summary: delivered ? "Template test alert sent." : "Template test alert failed safely.", actorUserId: request.currentUser!.id, metadata: { alertEventId: event.id, channelId: channel.id, templateType, status: result.deliveries[0]?.status ?? "CONFIGURATION_NEEDED" } });
    return reply.code(delivered ? 200 : 422).send({ ...result, delivered });
  });

  app.get("/alert-channels", async (request) => ({ alertChannels: await service().listChannels(request.currentUser!.id) }));

  app.post("/alert-channels", async (request, reply) => {
    try {
      assertSecretsConfigured();
    } catch (error) {
      return reply.code(503).send({ error: error instanceof Error ? error.message : "Alert encryption is not configured." });
    }
    const input = createSchema.parse(request.body);
    const config = input.provider === "TELEGRAM" ? { botToken: input.botToken, chatId: input.chatId } : { webhookUrl: input.webhookUrl };
    const channel = await service().createChannel(request.currentUser!.id, { provider: input.provider, name: input.name, enabled: input.enabled, config });
    return reply.code(201).send({ alertChannel: channel });
  });

  app.get("/alert-channels/:id", async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const channel = await service().getChannel(request.currentUser!.id, id);
    return channel ? { alertChannel: channel } : reply.notFound("Alert channel not found");
  });

  app.patch("/alert-channels/:id", async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const input = patchSchema.parse(request.body);
    const current = await service().getChannel(request.currentUser!.id, id);
    if (!current) return reply.notFound("Alert channel not found");
    let config;
    if (input.botToken != null || input.chatId != null || input.webhookUrl != null) {
      try {
        assertSecretsConfigured();
      } catch (error) {
        return reply.code(503).send({ error: error instanceof Error ? error.message : "Alert encryption is not configured." });
      }
      if (current.provider === "TELEGRAM") {
        const parsed = telegramSchema.pick({ botToken: true, chatId: true }).parse({ botToken: input.botToken, chatId: input.chatId });
        config = parsed;
      } else if (current.provider === "DISCORD") {
        config = discordSchema.pick({ webhookUrl: true }).parse({ webhookUrl: input.webhookUrl });
      }
    }
    const alertChannel = await service().updateChannel(request.currentUser!.id, id, { name: input.name, enabled: input.enabled, config });
    return { alertChannel };
  });

  app.delete("/alert-channels/:id", async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    return await service().deleteChannel(request.currentUser!.id, id) ? reply.code(204).send() : reply.notFound("Alert channel not found");
  });

  app.post("/alert-channels/:id/test", async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const current = await service().getChannel(request.currentUser!.id, id);
    if (!current) return reply.notFound("Alert channel not found");
    const result = await service().testChannel(request.currentUser!.id, id);
    const delivery = result.deliveries[0];
    return reply.code(delivery?.status === "SENT" ? 200 : 422).send({ ...result, alertChannel: await service().getChannel(request.currentUser!.id, id) });
  });

  app.post("/alerts/:id/send", async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    try {
      return await service().deliverEvent(request.currentUser!.id, id);
    } catch (error) {
      return reply.code(404).send({ error: error instanceof Error ? error.message : "Alert event not found." });
    }
  });
}
