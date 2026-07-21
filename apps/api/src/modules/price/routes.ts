import type { FastifyInstance } from "fastify";
import { evaluateAcceptablePrice } from "@pokedad-radar/shared";
import { z } from "zod";

const evaluatePriceSchema = z.object({
  priceCents: z.number().int().nonnegative(),
  msrpCents: z.number().int().nonnegative().nullable().optional(),
  customMaxPriceCents: z.number().int().nonnegative().nullable().optional(),
  toleranceCents: z.number().int().nonnegative().nullable().optional(),
  sellerAccepted: z.boolean().optional()
});

export async function registerPriceRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/v1/price/evaluate", async (request) => {
    const input = evaluatePriceSchema.parse(request.body);
    return evaluateAcceptablePrice(input);
  });
}
