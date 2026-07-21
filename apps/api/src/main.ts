import { env } from "./config/env.js";
import { buildApp } from "./app.js";
import { BestBuyAdapter } from "./modules/adapters/bestbuy/bestbuy.adapter.js";
import { BestBuyScanScheduler } from "./modules/adapters/bestbuy/bestbuy-scheduler.service.js";

const app = await buildApp();
const bestBuyScheduler = new BestBuyScanScheduler(app.prisma, new BestBuyAdapter(env.BEST_BUY_API_KEY));
app.addHook("onClose", async () => bestBuyScheduler.stop());

try {
  await app.listen({ host: env.API_HOST, port: env.API_PORT });
  await bestBuyScheduler.start();
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
