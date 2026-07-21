import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function metadataIsMock(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const metadata = value as Record<string, unknown>;
  return metadata.mock === true
    || metadata.demo === true
    || /mock|demo/i.test(String(metadata.source ?? ""));
}

function textIsMock(...values: Array<string | null | undefined>): boolean {
  return values.some((value) => /(^|[\s/_-])(mock|demo)([\s/_-]|$)/i.test(value ?? ""));
}

async function main(): Promise<void> {
  const stockChecks = await prisma.stockCheckResult.findMany({
    select: {
      id: true,
      retailerProductId: true,
      rawMetadata: true,
      retailerProduct: { select: { externalId: true, productUrl: true } }
    }
  });
  const mockStockChecks = stockChecks.filter((item) => metadataIsMock(item.rawMetadata)
    || textIsMock(item.retailerProduct.externalId, item.retailerProduct.productUrl));
  const mockStockCheckIds = new Set(mockStockChecks.map((item) => item.id));

  const mappings = await prisma.productMSRPMapping.findMany({
    select: { id: true, retailerProductId: true, retailerSku: true, productUrl: true, notes: true }
  });
  const mockMappingIds = mappings
    .filter((item) => textIsMock(item.retailerSku, item.productUrl, item.notes))
    .map((item) => item.id);

  const alertEvents = await prisma.alertEvent.findMany({
    select: { id: true, stockCheckResultId: true, title: true, message: true }
  });
  const mockAlertEventIds = alertEvents
    .filter((event) => (event.stockCheckResultId && mockStockCheckIds.has(event.stockCheckResultId)) || textIsMock(event.title, event.message))
    .map((event) => event.id);

  const retailerProducts = await prisma.retailerProduct.findMany({
    select: { id: true, externalId: true, productUrl: true }
  });
  const candidateProductIds = new Set([
    ...mockStockChecks.map((item) => item.retailerProductId),
    ...mappings.filter((item) => mockMappingIds.includes(item.id)).map((item) => item.retailerProductId).filter((id): id is string => Boolean(id)),
    ...retailerProducts.filter((item) => textIsMock(item.externalId, item.productUrl)).map((item) => item.id)
  ]);

  await prisma.$transaction(async (tx) => {
    if (mockAlertEventIds.length) await tx.alertEvent.deleteMany({ where: { id: { in: mockAlertEventIds } } });
    if (mockMappingIds.length) await tx.productMSRPMapping.deleteMany({ where: { id: { in: mockMappingIds } } });
    if (mockStockCheckIds.size) await tx.stockCheckResult.deleteMany({ where: { id: { in: [...mockStockCheckIds] } } });

    for (const productId of candidateProductIds) {
      const [checks, mappingsForProduct, rules] = await Promise.all([
        tx.stockCheckResult.count({ where: { retailerProductId: productId } }),
        tx.productMSRPMapping.count({ where: { retailerProductId: productId } }),
        tx.priceRule.count({ where: { retailerProductId: productId } })
      ]);
      if (checks === 0 && mappingsForProduct === 0 && rules === 0) {
        await tx.retailerProduct.deleteMany({ where: { id: productId } });
      }
    }

    await tx.store.updateMany({
      where: { lastSuccessfulCheckAt: { not: null }, stockChecks: { none: {} } },
      data: { lastSuccessfulCheckAt: null }
    });
  });

  console.log(JSON.stringify({
    removedStockChecks: mockStockCheckIds.size,
    removedMappings: mockMappingIds.length,
    removedAlertEvents: mockAlertEventIds.length,
    reviewedRetailerProducts: candidateProductIds.size
  }));
}

main()
  .catch((error) => {
    console.error("Mock data cleanup failed:", error instanceof Error ? error.message : "Unknown error");
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
