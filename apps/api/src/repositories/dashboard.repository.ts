import type { Prisma, PrismaClient } from "@prisma/client";
import {
  AlertStatus,
  CartAssistMode,
  CartAssistStatus,
  ProductCategoryKind,
  PriceStatus,
  SellerPolicy,
  SkipReason,
  StockStatus,
  StoreSessionState,
  type DemoAlertChannel,
  type DemoAuditLog,
  type DemoCartAttempt,
  type DemoHistoryEvent,
  type DemoLiveFind,
  type DemoPriceRule,
  type DemoRadarRules,
  type DemoStore
} from "@pokedad-radar/shared";
import type { ProductSearchResult } from "../modules/adapters/types.js";

const defaultRadarRules: DemoRadarRules = {
  monitorAllSealed: true,
  selectedCategories: Object.values(ProductCategoryKind),
  monitorNewReleases: true,
  ignoreSingles: true,
  ignoreThirdPartySellers: true,
  shippingPreferred: true,
  pickupPreferred: true,
  pickupZip: "19019",
  pickupRadiusMiles: 25,
  quantityWantedPerProduct: 1,
  maxQuantityPerStoreProduct: 1
};

function dateToIso(value?: Date | string | null): string {
  if (!value) {
    return new Date(0).toISOString();
  }
  return value instanceof Date ? value.toISOString() : value;
}

function nullableDateToIso(value?: Date | string | null): string | undefined {
  return value ? dateToIso(value) : undefined;
}

function normalizeSessionState(value?: string | null): StoreSessionState {
  if (value === "QUEUE_OR_WAITING_ROOM") {
    return StoreSessionState.QUEUE_DETECTED;
  }
  if (value && value in StoreSessionState) {
    return value as StoreSessionState;
  }
  return StoreSessionState.UNKNOWN;
}

function centsLabel(cents?: number | null): string {
  if (cents == null) {
    return "Custom";
  }
  if (cents === 0) {
    return "MSRP only";
  }
  return `MSRP + $${(cents / 100).toFixed(0)}`;
}

function statusFromBool(value?: boolean | null): "Available" | "Unavailable" | "Unknown" {
  if (value == null) return "Unknown";
  return value ? "Available" : "Unavailable";
}

type StoreWithStatus = Prisma.StoreGetPayload<{ include: { sessionStatus: true } }>;
type StockWithRelations = Prisma.StockCheckResultGetPayload<{
  include: {
    store: true;
    retailerProduct: { include: { category: true } };
    cartAttempts: { orderBy: { updatedAt: "desc" } };
    alertEvents: true;
    purchaseDecision: true;
  };
}>;
type CartWithRelations = Prisma.CartAssistAttemptGetPayload<{
  include: {
    stockCheckResult: {
      include: {
        store: true;
        retailerProduct: true;
      };
    };
  };
}>;

export class DashboardRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getStores(ownerId: string): Promise<DemoStore[]> {
    const stores = await this.prisma.store.findMany({
      where: { ownerId },
      include: { sessionStatus: true },
      orderBy: { name: "asc" }
    });
    return stores.map((store) => this.mapStore(store));
  }

  async updateStore(ownerId: string, id: string, patch: Partial<DemoStore>): Promise<DemoStore | null> {
    const store = await this.prisma.store.update({
      where: { id, ownerId },
      data: {
        monitoringEnabled: patch.monitoringEnabled,
        cartAssistMode: patch.cartAssistMode,
        defaultToleranceCents: patch.defaultToleranceCents,
        lastError: patch.lastError
      },
      include: { sessionStatus: true }
    }).catch(() => null);
    return store ? this.mapStore(store) : null;
  }

  async getRadarRules(ownerId: string): Promise<DemoRadarRules> {
    const setting = await this.prisma.appSetting.findUnique({
      where: { ownerId_key: { ownerId, key: "radarRules" } }
    });
    return (setting?.value as unknown as DemoRadarRules | undefined) ?? defaultRadarRules;
  }

  async updateRadarRules(ownerId: string, value: DemoRadarRules): Promise<DemoRadarRules> {
    await this.prisma.appSetting.upsert({
      where: { ownerId_key: { ownerId, key: "radarRules" } },
      create: { ownerId, key: "radarRules", value: value as unknown as Prisma.InputJsonValue },
      update: { value: value as unknown as Prisma.InputJsonValue }
    });
    return value;
  }

  async getPriceRules(ownerId: string): Promise<DemoPriceRule[]> {
    const rules = await this.prisma.priceRule.findMany({
      where: { ownerId },
      orderBy: { createdAt: "asc" }
    });
    return rules.map((rule) => ({
      id: rule.id,
      scope: rule.scope,
      label: rule.label,
      target: rule.target,
      msrpCents: rule.msrpCents,
      allowedMarkupCents: rule.allowedMarkupCents,
      maxAcceptedPriceCents: rule.customMaxPriceCents,
      storeSpecificToleranceCents: rule.storeSpecificToleranceCents,
      categorySpecificToleranceCents: rule.categorySpecificToleranceCents,
      productSpecificOverrideCents: rule.productSpecificOverrideCents,
      enabled: rule.enabled
    }));
  }

  async createPriceRule(ownerId: string, input: Omit<DemoPriceRule, "id">): Promise<DemoPriceRule> {
    const rule = await this.prisma.priceRule.create({
      data: {
        ownerId,
        scope: input.scope,
        label: input.label,
        target: input.target,
        msrpCents: input.msrpCents,
        allowedMarkupCents: input.allowedMarkupCents,
        customMaxPriceCents: input.maxAcceptedPriceCents,
        productSpecificOverrideCents: input.productSpecificOverrideCents ?? input.maxAcceptedPriceCents,
        storeSpecificToleranceCents: input.storeSpecificToleranceCents,
        categorySpecificToleranceCents: input.categorySpecificToleranceCents,
        enabled: input.enabled
      }
    });
    return (await this.getPriceRules(ownerId)).find((item) => item.id === rule.id)!;
  }

  async updatePriceRule(ownerId: string, id: string, patch: Partial<DemoPriceRule>): Promise<DemoPriceRule | null> {
    await this.prisma.priceRule.update({
      where: { id, ownerId },
      data: {
        label: patch.label,
        target: patch.target,
        scope: patch.scope,
        msrpCents: patch.msrpCents,
        allowedMarkupCents: patch.allowedMarkupCents,
        customMaxPriceCents: patch.maxAcceptedPriceCents,
        productSpecificOverrideCents: patch.productSpecificOverrideCents ?? patch.maxAcceptedPriceCents,
        storeSpecificToleranceCents: patch.storeSpecificToleranceCents,
        categorySpecificToleranceCents: patch.categorySpecificToleranceCents,
        enabled: patch.enabled
      }
    }).catch(() => null);
    return (await this.getPriceRules(ownerId)).find((item) => item.id === id) ?? null;
  }

  async getLiveFinds(ownerId: string): Promise<DemoLiveFind[]> {
    const checks = await this.prisma.stockCheckResult.findMany({
      where: { store: { ownerId } },
      include: {
        store: true,
        retailerProduct: { include: { category: true } },
        cartAttempts: { orderBy: { updatedAt: "desc" } },
        alertEvents: true,
        purchaseDecision: true
      },
      orderBy: { checkedAt: "desc" }
    });
    return checks.map((check) => this.mapLiveFind(check));
  }

  async persistAdapterFinds(ownerId: string, storeSlug: string, results: ProductSearchResult[]): Promise<DemoLiveFind[]> {
    const store = await this.prisma.store.findUnique({
      where: { ownerId_slug: { ownerId, slug: storeSlug } }
    });
    if (!store) {
      throw new Error(`Store ${storeSlug} not found for owner.`);
    }

    const categories = await this.prisma.productCategory.findMany();
    const categoryByKind = new Map(categories.map((category) => [category.kind, category.id]));

    for (const result of results) {
      const categoryKind = this.inferCategoryKind(result.name);
      const externalId = result.sku ?? result.externalId;
      const retailerProduct = await this.prisma.retailerProduct.upsert({
        where: { storeId_externalId: { storeId: store.id, externalId } },
        create: {
          storeId: store.id,
          categoryId: categoryByKind.get(categoryKind),
          externalId,
          productUrl: result.productUrl,
          imageUrl: result.imageUrl,
          name: result.name,
          sellerName: result.seller,
          sellerIsOfficial: result.sellerAccepted,
          marketplaceListing: !result.sellerAccepted,
          suspicious: false
        },
        update: {
          categoryId: categoryByKind.get(categoryKind),
          productUrl: result.productUrl,
          imageUrl: result.imageUrl,
          name: result.name,
          sellerName: result.seller,
          sellerIsOfficial: result.sellerAccepted,
          marketplaceListing: !result.sellerAccepted
        }
      });

      await this.prisma.stockCheckResult.create({
        data: {
          storeId: store.id,
          retailerProductId: retailerProduct.id,
          priceCents: result.priceCents,
          msrpCents: result.msrpCents,
          acceptedMaxPriceCents: result.maxAcceptedPriceCents,
          accepted: result.priceStatus === PriceStatus.ACCEPTED || result.priceStatus === PriceStatus.MSRP_MATCH || result.priceStatus === PriceStatus.ACCEPTED_MARKUP,
          sellerName: result.seller,
          sellerAccepted: result.sellerAccepted,
          priceStatus: result.priceStatus ?? PriceStatus.UNKNOWN_MSRP,
          alertStatus: "READY",
          stockStatus: result.stockStatus,
          shippingAvailable: result.shippingAvailable,
          pickupAvailable: result.pickupAvailable,
          skipReason: result.priceStatus === PriceStatus.OVER_LIMIT ? "PRICE_ABOVE_MAX" : result.sellerAccepted ? "NONE" : "THIRD_PARTY_SELLER",
          rawMetadata: {
            source: result.source,
            sku: result.sku,
            onlineAvailability: result.onlineAvailability
          }
        }
      });
    }

    return this.getLiveFinds(ownerId);
  }

  async updateLiveFind(ownerId: string, id: string, patch: { ignored?: boolean; bought?: boolean; snoozedUntil?: Date }): Promise<DemoLiveFind | null> {
    const updated = await this.prisma.stockCheckResult.update({
      where: { id, store: { ownerId } },
      data: patch,
      include: {
        store: true,
        retailerProduct: { include: { category: true } },
        cartAttempts: { orderBy: { updatedAt: "desc" } },
        alertEvents: true,
        purchaseDecision: true
      }
    }).catch(() => null);
    return updated ? this.mapLiveFind(updated) : null;
  }

  async getCartQueue(ownerId: string): Promise<DemoCartAttempt[]> {
    const attempts = await this.prisma.cartAssistAttempt.findMany({
      where: { stockCheckResult: { store: { ownerId } } },
      include: {
        stockCheckResult: {
          include: {
            store: true,
            retailerProduct: true
          }
        }
      },
      orderBy: { updatedAt: "desc" }
    });
    return attempts.map((attempt) => this.mapCartAttempt(attempt));
  }

  async getCartAttempt(ownerId: string, id: string): Promise<DemoCartAttempt | null> {
    const attempt = await this.prisma.cartAssistAttempt.findFirst({
      where: { id, stockCheckResult: { store: { ownerId } } },
      include: {
        stockCheckResult: {
          include: {
            store: true,
            retailerProduct: true
          }
        }
      }
    });
    return attempt ? this.mapCartAttempt(attempt) : null;
  }

  async updateCartAttempt(ownerId: string, id: string, patch: { status: CartAssistStatus; lastMessage: string; stopReason?: string | null }): Promise<DemoCartAttempt | null> {
    const attempt = await this.prisma.cartAssistAttempt.update({
      where: { id, stockCheckResult: { store: { ownerId } } },
      data: {
        status: patch.status,
        lastMessage: patch.lastMessage,
        stopReason: patch.stopReason
      },
      include: {
        stockCheckResult: {
          include: {
            store: true,
            retailerProduct: true
          }
        }
      }
    }).catch(() => null);
    return attempt ? this.mapCartAttempt(attempt) : null;
  }

  async getAlertChannels(ownerId: string): Promise<DemoAlertChannel[]> {
    const channels = await this.prisma.alertChannel.findMany({
      where: { ownerId },
      orderBy: { createdAt: "asc" }
    });
    return channels.map((channel) => ({
      id: channel.id,
      type: this.alertTypeLabel(channel.type),
      label: channel.label,
      enabled: channel.enabled,
      destinationHint: channel.destinationHint ?? "Encrypted secret reference",
      lastTestAt: nullableDateToIso(channel.lastTestAt)
    }));
  }

  async testAlert(ownerId: string, channelId: string): Promise<DemoAlertChannel | null> {
    const channel = await this.prisma.alertChannel.update({
      where: { id: channelId, ownerId },
      data: { lastTestAt: new Date() }
    }).catch(() => null);
    if (!channel) {
      return null;
    }
    await this.prisma.alertEvent.create({
      data: {
        ownerId,
        alertChannelId: channel.id,
        type: "ACCEPTABLE_PRICE_FOUND",
        templateType: "TEST_ALERT",
        title: "TEST ALERT - PokeDad Radar",
        priority: "NORMAL",
        status: "SENT",
        message: `Demo test alert sent to ${channel.label}.`,
        sentAt: new Date()
      }
    });
    return (await this.getAlertChannels(ownerId)).find((item) => item.id === channelId) ?? null;
  }

  async getHistory(ownerId: string): Promise<DemoHistoryEvent[]> {
    const checks = await this.prisma.stockCheckResult.findMany({
      where: { store: { ownerId } },
      include: {
        store: true,
        retailerProduct: { include: { category: true } },
        cartAttempts: true,
        alertEvents: true
      },
      orderBy: { checkedAt: "desc" }
    });
    return checks.map((check) => {
      const metadata = (check.rawMetadata ?? {}) as Record<string, unknown>;
      return {
        id: check.id,
        productName: check.retailerProduct.name,
        storeName: check.store.name,
        priceCents: check.priceCents ?? 0,
        msrpCents: check.msrpCents,
        foundAt: dateToIso(check.checkedAt),
        soldOutAt: typeof metadata.soldOutAt === "string" ? metadata.soldOutAt : undefined,
        alertSent: check.alertEvents.some((event) => event.status === "SENT"),
        cartAssistWorked: check.cartAttempts.some((attempt) => attempt.status === CartAssistStatus.CART_READY),
        bought: check.bought,
        skipReason: check.skipReason as SkipReason
      };
    });
  }

  async getAuditLogs(ownerId: string): Promise<DemoAuditLog[]> {
    const logs = await this.prisma.auditLog.findMany({
      where: {
        OR: [
          { actorUserId: ownerId },
          { actorUserId: null }
        ]
      },
      orderBy: { createdAt: "desc" },
      take: 100
    });
    return logs.map((log) => ({
      id: log.id,
      action: log.action,
      summary: log.summary,
      createdAt: dateToIso(log.createdAt),
      metadata: (log.metadata ?? {}) as Record<string, unknown>
    }));
  }

  private mapStore(store: StoreWithStatus): DemoStore {
    const tolerance = store.defaultToleranceCents ?? 0;
    return {
      id: store.id,
      name: store.name,
      slug: store.slug,
      baseUrl: store.baseUrl,
      loginUrl: store.loginUrl ?? store.baseUrl,
      cartUrl: store.cartUrl ?? store.baseUrl,
      sessionState: normalizeSessionState(store.sessionStatus?.state),
      monitoringEnabled: store.monitoringEnabled,
      cartAssistMode: (store.cartAssistMode as CartAssistMode | null) ?? CartAssistMode.OPEN_ONLY,
      sellerPolicy: store.sellerPolicy as SellerPolicy,
      priceToleranceLabel: centsLabel(tolerance),
      defaultToleranceCents: tolerance,
      lastCheckTime: dateToIso(store.lastSuccessfulCheckAt ?? store.updatedAt),
      lastError: store.lastError ?? undefined
    };
  }

  private mapLiveFind(check: StockWithRelations): DemoLiveFind {
    const latestCart = check.cartAttempts[0];
    const metadata = (check.rawMetadata ?? {}) as Record<string, unknown>;
    return {
      id: check.id,
      productId: check.retailerProductId,
      productName: check.retailerProduct.name,
      category: (check.retailerProduct.category?.kind ?? ProductCategoryKind.NEW_RELEASE) as ProductCategoryKind,
      storeId: check.storeId,
      storeName: check.store.name,
      source: metadata.source as string | undefined,
      seller: check.sellerName ?? check.retailerProduct.sellerName ?? "Unknown",
      sellerAccepted: check.sellerAccepted,
      productUrl: check.retailerProduct.productUrl,
      cartUrl: check.store.cartUrl ?? check.store.baseUrl,
      imageColor: check.retailerProduct.imageUrl ?? "#157f7b",
      priceCents: check.priceCents ?? 0,
      msrpCents: check.msrpCents,
      maxAcceptedPriceCents: check.acceptedMaxPriceCents,
      priceStatus: check.priceStatus as PriceStatus,
      stockStatus: check.stockStatus as StockStatus,
      shippingStatus: statusFromBool(check.shippingAvailable),
      pickupStatus: statusFromBool(check.pickupAvailable),
      cartAssistStatus: (latestCart?.status as CartAssistStatus | undefined) ?? CartAssistStatus.NOT_ATTEMPTED,
      alertStatus: check.alertStatus as AlertStatus,
      ignored: check.ignored,
      bought: check.bought,
      snoozedUntil: nullableDateToIso(check.snoozedUntil),
      purchaseDecisionStatus: check.purchaseDecision?.status ?? null,
      purchaseSkipReason: check.purchaseDecision?.skipReason ?? null,
      purchaseNote: check.purchaseDecision?.note ?? null,
      purchaseQuantity: check.purchaseDecision?.quantity ?? null,
      purchaseFinalPriceCents: check.purchaseDecision?.finalPriceCents ?? null,
      wishlistPriority: metadata.wishlistPriority as DemoLiveFind["wishlistPriority"] ?? null,
      wishlistAlertBehavior: metadata.wishlistAlertBehavior as DemoLiveFind["wishlistAlertBehavior"] ?? null,
      wishlistItemId: typeof metadata.wishlistItemId === "string" ? metadata.wishlistItemId : null,
      wishlistItemName: typeof metadata.wishlistItemName === "string" ? metadata.wishlistItemName : null,
      wishlistSetName: typeof metadata.wishlistSetName === "string" ? metadata.wishlistSetName : null,
      wishlistDesiredQuantity: typeof metadata.wishlistDesiredQuantity === "number" ? metadata.wishlistDesiredQuantity : null,
      wishlistMaxPriceCents: typeof metadata.wishlistMaxPriceCents === "number" ? metadata.wishlistMaxPriceCents : null,
      wishlistMatchReasons: Array.isArray(metadata.wishlistMatchReasons) ? metadata.wishlistMatchReasons.filter((item): item is string => typeof item === "string") : [],
      foundAt: dateToIso(check.checkedAt)
    };
  }

  private mapCartAttempt(attempt: CartWithRelations): DemoCartAttempt {
    return {
      id: attempt.id,
      liveFindId: attempt.stockCheckResultId,
      productName: attempt.stockCheckResult.retailerProduct.name,
      storeName: attempt.stockCheckResult.store.name,
      status: attempt.status as CartAssistStatus,
      productUrl: attempt.productUrl,
      cartUrl: attempt.cartUrl ?? attempt.stockCheckResult.store.cartUrl ?? attempt.stockCheckResult.store.baseUrl,
      requestedQuantity: attempt.requestedQuantity,
      stopReason: attempt.stopReason ?? undefined,
      lastMessage: attempt.lastMessage ?? "",
      createdAt: dateToIso(attempt.createdAt),
      updatedAt: dateToIso(attempt.updatedAt)
    };
  }

  private alertTypeLabel(type: string): string {
    return ({
      TELEGRAM: "Telegram",
      DISCORD_WEBHOOK: "Discord webhook",
      SMS: "SMS",
      EMAIL: "Email",
      BROWSER: "Browser notification"
    } as Record<string, string>)[type] ?? type;
  }

  private inferCategoryKind(name: string): ProductCategoryKind {
    const normalized = name.toLowerCase();
    if (normalized.includes("pokemon center") && normalized.includes("elite trainer")) return ProductCategoryKind.POKEMON_CENTER_ETB;
    if (normalized.includes("elite trainer") || normalized.includes(" etb")) return ProductCategoryKind.ELITE_TRAINER_BOX;
    if (normalized.includes("booster bundle")) return ProductCategoryKind.BOOSTER_BUNDLE;
    if (normalized.includes("booster box")) return ProductCategoryKind.BOOSTER_BOX;
    if (normalized.includes("ultra premium") || normalized.includes(" upc")) return ProductCategoryKind.ULTRA_PREMIUM_COLLECTION;
    if (normalized.includes("premium collection")) return ProductCategoryKind.PREMIUM_COLLECTION;
    if (normalized.includes("collection box")) return ProductCategoryKind.COLLECTION_BOX;
    if (normalized.includes("mini tin")) return ProductCategoryKind.MINI_TIN;
    if (normalized.includes("tin")) return ProductCategoryKind.TIN;
    if (normalized.includes("sleeved") || normalized.includes("booster pack")) return ProductCategoryKind.SLEEVED_BOOSTER;
    return ProductCategoryKind.NEW_RELEASE;
  }
}
