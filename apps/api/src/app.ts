import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import sensible from "@fastify/sensible";
import Fastify from "fastify";
import { env } from "./config/env.js";
import { registerAdapterRoutes } from "./modules/adapters/routes.js";
import { registerAlertRoutes } from "./modules/alerts/routes.js";
import { registerAnalyticsRoutes } from "./modules/analytics/routes.js";
import { registerAuthGuard } from "./modules/auth/auth.guard.js";
import { registerAuthRoutes } from "./modules/auth/routes.js";
import { registerBotRoutes } from "./modules/bot/routes.js";
import { registerDemoRoutes } from "./modules/demo/routes.js";
import { registerDiscordRoutes } from "./modules/discord/routes.js";
import { registerHealthRoutes } from "./modules/health/routes.js";
import { registerHelperRoutes } from "./modules/helper/routes.js";
import { registerManualStoreLinkRoutes } from "./modules/manual-store-links/routes.js";
import { registerMSRPMappingsRoutes } from "./modules/msrp/routes.js";
import { registerPriceRoutes } from "./modules/price/routes.js";
import { registerPurchaseRoutes } from "./modules/purchase/routes.js";
import { registerReleaseCalendarRoutes } from "./modules/release-calendar/routes.js";
import { registerStoreRoutes } from "./modules/stores/routes.js";
import { registerStoreSafetyRoutes } from "./modules/store-safety/routes.js";
import { registerTodayRoutes } from "./modules/today/routes.js";
import { registerWishlistRoutes } from "./modules/wishlist/routes.js";
import { prismaPlugin } from "./plugins/prisma.js";

export async function buildApp() {
  const app = Fastify({
    bodyLimit: 1_000_000,
    trustProxy: env.NODE_ENV === "production",
    logger: {
      level: env.NODE_ENV === "development" ? "info" : "warn",
      redact: [
        "req.headers.authorization",
        "req.headers.cookie",
        "req.url",
        "req.raw.url",
        "req.body.password",
        "req.body.botToken",
        "req.body.chatId",
        "req.body.webhookUrl",
        "req.body.config",
        "req.body.client_secret",
        "req.body.access_token",
        "req.body.refresh_token",
        "req.body.cardNumber",
        "req.body.cvv",
        "req.body.sessionToken"
      ]
    }
  });

  await app.register(prismaPlugin);
  await app.register(sensible);
  await app.register(helmet, {
    contentSecurityPolicy: false
  });
  await app.register(cookie, { secret: env.SESSION_SECRET });
  await app.register(cors, {
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      const localDevOrigin = /^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin);
      const allowedOrigins = new Set([env.WEB_ORIGIN, env.PUBLIC_APP_URL].filter(Boolean));
      callback(null, env.NODE_ENV === "development" ? localDevOrigin : allowedOrigins.has(origin));
    },
    credentials: true
  });
  await app.register(rateLimit, { max: 120, timeWindow: "1 minute" });

  await registerAuthGuard(app);
  await registerHealthRoutes(app);
  await registerAuthRoutes(app);
  await registerBotRoutes(app);
  await registerAnalyticsRoutes(app);
  await registerAdapterRoutes(app);
  await registerAlertRoutes(app);
  await registerDiscordRoutes(app);
  await registerManualStoreLinkRoutes(app);
  await registerMSRPMappingsRoutes(app);
  await registerPurchaseRoutes(app);
  await registerReleaseCalendarRoutes(app);
  await registerWishlistRoutes(app);
  await registerDemoRoutes(app);
  await registerPriceRoutes(app);
  await registerStoreRoutes(app);
  await registerStoreSafetyRoutes(app);
  await registerTodayRoutes(app);
  await registerHelperRoutes(app);

  return app;
}
