import type { FastifyInstance } from "fastify";
import { SellerPolicy, StoreSessionState } from "@pokedad-radar/shared";

const defaultStores = [
  ["Target", "target", "https://www.target.com"],
  ["Best Buy", "best-buy", "https://www.bestbuy.com"],
  ["Pokemon Center", "pokemon-center", "https://www.pokemoncenter.com"],
  ["Walmart", "walmart", "https://www.walmart.com"],
  ["GameStop", "gamestop", "https://www.gamestop.com"],
  ["Sam's Club", "sams-club", "https://www.samsclub.com"],
  ["Costco", "costco", "https://www.costco.com"],
  ["BJ's", "bjs", "https://www.bjs.com"],
  ["Amazon Official", "amazon-official", "https://www.amazon.com"],
  ["Barnes & Noble", "barnes-noble", "https://www.barnesandnoble.com"],
  ["Dick's Sporting Goods", "dicks-sporting-goods", "https://www.dickssportinggoods.com"],
  ["Ace Hardware", "ace-hardware", "https://www.acehardware.com"]
] as const;

export async function registerStoreRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/stores", async () => ({
    stores: defaultStores.map(([name, slug, baseUrl]) => ({
      name,
      slug,
      baseUrl,
      sessionState: StoreSessionState.UNKNOWN,
      monitoringEnabled: false,
      cartAssistEnabled: false,
      sellerPolicy: SellerPolicy.OFFICIAL_ONLY,
      adapterSafetyLevel: "OPEN_ONLY"
    }))
  }));
}

