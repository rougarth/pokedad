import type { AuditAction, MSRPMappingConfidence, MSRPMappingStatus, Prisma, PrismaClient, ProductCategory } from "@prisma/client";
import { AlertStatus, PriceStatus, StockStatus, evaluateAcceptablePrice } from "@pokedad-radar/shared";
import { AuditService } from "../../services/audit.service.js";
import type { ProductSearchResult } from "../adapters/types.js";

export interface MSRPMappingDto {
  id: string;
  storeKey: string;
  retailerSku?: string | null;
  retailerProductId?: string | null;
  productName: string;
  productUrl?: string | null;
  imageUrl?: string | null;
  currentPriceCents?: number | null;
  detectedKeywords: string[];
  suggestedCategoryId?: string | null;
  suggestedCategoryLabel?: string | null;
  mappedCategoryId?: string | null;
  mappedCategoryLabel?: string | null;
  msrpCents?: number | null;
  acceptedMaxPriceCents?: number | null;
  confidence: MSRPMappingConfidence;
  status: MSRPMappingStatus;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SuggestionResult {
  detectedKeywords: string[];
  suggestedCategoryKind?: string;
  suggestedCategoryId?: string;
  suggestedCategoryLabel?: string;
  confidence: MSRPMappingConfidence;
  msrpCents?: number | null;
  acceptedMaxPriceCents?: number | null;
}

type MappingWithRelations = Prisma.ProductMSRPMappingGetPayload<{
  include: {
    suggestedCategory: true;
    mappedCategory: true;
  };
}>;

const suggestionRules = [
  { kind: "POKEMON_CENTER_ETB", label: "Pokemon Center ETB", terms: ["pokemon center elite trainer box", "pokemon center etb"], confidence: "HIGH" },
  { kind: "BOOSTER_BUNDLE", label: "Booster Bundle", terms: ["booster bundle"], confidence: "HIGH" },
  { kind: "ELITE_TRAINER_BOX", label: "Elite Trainer Box", terms: ["elite trainer box", " etb"], confidence: "HIGH" },
  { kind: "ULTRA_PREMIUM_COLLECTION", label: "UPC", terms: ["ultra premium collection", " upc"], confidence: "HIGH" },
  { kind: "PREMIUM_COLLECTION", label: "Premium Collection", terms: ["premium collection"], confidence: "HIGH" },
  { kind: "COLLECTION_BOX", label: "Collection Box", terms: ["collection box"], confidence: "MEDIUM" },
  { kind: "MINI_TIN", label: "Mini Tin", terms: ["mini tin"], confidence: "HIGH" },
  { kind: "TIN", label: "Tin", terms: [" tin"], confidence: "MEDIUM" },
  { kind: "SLEEVED_BOOSTER", label: "Sleeved Booster", terms: ["sleeved booster", "sleeved pack"], confidence: "HIGH" },
  { kind: "BOOSTER_BOX", label: "Booster Box", terms: ["booster box"], confidence: "HIGH" }
] as const;

function iso(value: Date): string {
  return value.toISOString();
}

export function normalizedProductKey(name: string, productUrl?: string | null): string {
  const base = `${name} ${productUrl ?? ""}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return base.slice(0, 180) || "unknown-product";
}

export class MSRPMappingService {
  private readonly audit: AuditService;

  constructor(private readonly prisma: PrismaClient) {
    this.audit = new AuditService(prisma);
  }

  async list(ownerId: string, status?: MSRPMappingStatus): Promise<MSRPMappingDto[]> {
    const mappings = await this.prisma.productMSRPMapping.findMany({
      where: { ownerId, ...(status ? { status } : {}) },
      include: { suggestedCategory: true, mappedCategory: true },
      orderBy: { updatedAt: "desc" }
    });
    return mappings.map((mapping) => this.toDto(mapping));
  }

  async get(ownerId: string, id: string): Promise<MSRPMappingDto | null> {
    const mapping = await this.prisma.productMSRPMapping.findFirst({
      where: { id, ownerId },
      include: { suggestedCategory: true, mappedCategory: true }
    });
    return mapping ? this.toDto(mapping) : null;
  }

  async suggestForName(ownerId: string, productName: string): Promise<SuggestionResult> {
    const normalized = ` ${productName.toLowerCase()} `;
    const categories = await this.prisma.productCategory.findMany();
    for (const rule of suggestionRules) {
      const matched = rule.terms.filter((term) => normalized.includes(term));
      if (matched.length === 0) {
        continue;
      }
      const category = categories.find((item) => item.kind === rule.kind);
      const price = category ? await this.priceForCategory(ownerId, category) : { msrpCents: null, acceptedMaxPriceCents: null };
      return {
        detectedKeywords: matched.map((term) => term.trim()),
        suggestedCategoryKind: rule.kind,
        suggestedCategoryId: category?.id,
        suggestedCategoryLabel: category?.label ?? rule.label,
        confidence: rule.confidence,
        ...price
      };
    }
    return { detectedKeywords: [], confidence: "LOW" };
  }

  async createOrUpdateCandidate(ownerId: string, input: {
    storeKey: string;
    retailerSku?: string | null;
    retailerProductId?: string | null;
    productName: string;
    productUrl?: string | null;
    imageUrl?: string | null;
    currentPriceCents?: number | null;
    status?: MSRPMappingStatus;
    notes?: string | null;
  }): Promise<MSRPMappingDto> {
    const suggestion = await this.suggestForName(ownerId, input.productName);
    const status = input.status ?? (suggestion.suggestedCategoryId ? "SUGGESTED" : "UNMAPPED");
    const key = normalizedProductKey(input.productName, input.productUrl);
    const existing = await this.findExisting(ownerId, input.storeKey, input.retailerSku, key);
    const data = {
      retailerSku: input.retailerSku ?? null,
      retailerProductId: input.retailerProductId ?? null,
      productName: input.productName,
      normalizedProductKey: key,
      productUrl: input.productUrl ?? null,
      imageUrl: input.imageUrl ?? null,
      currentPriceCents: input.currentPriceCents ?? null,
      detectedKeywords: suggestion.detectedKeywords,
      suggestedCategoryId: suggestion.suggestedCategoryId ?? null,
      msrpCents: suggestion.msrpCents ?? null,
      acceptedMaxPriceCents: suggestion.acceptedMaxPriceCents ?? null,
      confidence: suggestion.confidence,
      status,
      notes: input.notes ?? null
    } satisfies Prisma.ProductMSRPMappingUncheckedUpdateInput;

    const mapping = existing
      ? await this.prisma.productMSRPMapping.update({
        where: { id: existing.id },
        data,
        include: { suggestedCategory: true, mappedCategory: true }
      })
      : await this.prisma.productMSRPMapping.create({
        data: {
          ownerId,
          storeKey: input.storeKey,
          ...data
        },
        include: { suggestedCategory: true, mappedCategory: true }
      });

    await this.log(ownerId, existing ? "MSRP_SUGGESTION_GENERATED" : "MSRP_MAPPING_CANDIDATE_CREATED", existing ? `MSRP suggestion refreshed for ${mapping.productName}.` : `MSRP mapping candidate created for ${mapping.productName}.`, {
      mappingId: mapping.id,
      storeKey: input.storeKey,
      retailerSku: input.retailerSku,
      status: mapping.status,
      confidence: mapping.confidence,
      suggestedCategoryId: mapping.suggestedCategoryId
    });

    return this.toDto(mapping);
  }

  async applyMappedPrice(ownerId: string, result: ProductSearchResult, retailerProductId?: string | null): Promise<ProductSearchResult> {
    const mapping = await this.findMapped(ownerId, result.storeKey, result.sku ?? result.externalId, normalizedProductKey(result.name, result.productUrl), retailerProductId);
    if (!mapping || !mapping.msrpCents || result.priceCents == null) {
      return result;
    }
    const evaluated = evaluateAcceptablePrice({
      priceCents: result.priceCents,
      msrpCents: mapping.msrpCents,
      customMaxPriceCents: mapping.acceptedMaxPriceCents,
      sellerAccepted: result.sellerAccepted
    });
    return {
      ...result,
      msrpCents: mapping.msrpCents,
      maxAcceptedPriceCents: evaluated.acceptedMaxPriceCents,
      priceStatus: evaluated.priceStatus
    };
  }

  async map(ownerId: string, id: string, input: { categoryId: string; notes?: string | null; acceptedMaxPriceCents?: number | null }): Promise<MSRPMappingDto | null> {
    const category = await this.prisma.productCategory.findUnique({ where: { id: input.categoryId } });
    if (!category) {
      throw new Error("Product category not found.");
    }
    const price = await this.priceForCategory(ownerId, category, input.acceptedMaxPriceCents);
    const mapping = await this.prisma.productMSRPMapping.update({
      where: { id, ownerId },
      data: {
        mappedCategoryId: category.id,
        msrpCents: price.msrpCents,
        acceptedMaxPriceCents: price.acceptedMaxPriceCents,
        confidence: "MANUAL",
        status: "MAPPED",
        notes: input.notes ?? undefined
      },
      include: { suggestedCategory: true, mappedCategory: true }
    }).catch(() => null);
    if (!mapping) {
      return null;
    }
    await this.recalculateForMapping(ownerId, mapping);
    await this.log(ownerId, "MSRP_MAPPING_ACCEPTED", `MSRP mapping accepted for ${mapping.productName}.`, {
      mappingId: mapping.id,
      mappedCategoryId: category.id,
      msrpCents: price.msrpCents,
      acceptedMaxPriceCents: price.acceptedMaxPriceCents
    });
    return this.toDto(mapping);
  }

  async ignore(ownerId: string, id: string): Promise<MSRPMappingDto | null> {
    return this.setStatus(ownerId, id, "IGNORED", "MSRP_MAPPING_IGNORED", "MSRP mapping ignored.");
  }

  async needsReview(ownerId: string, id: string): Promise<MSRPMappingDto | null> {
    return this.setStatus(ownerId, id, "NEEDS_REVIEW", "MSRP_MAPPING_MARKED_NEEDS_REVIEW", "MSRP mapping marked needs review.");
  }

  async patch(ownerId: string, id: string, input: Partial<{
    notes: string | null;
    status: MSRPMappingStatus;
    mappedCategoryId: string | null;
    acceptedMaxPriceCents: number | null;
  }>): Promise<MSRPMappingDto | null> {
    const mapping = await this.prisma.productMSRPMapping.update({
      where: { id, ownerId },
      data: {
        notes: input.notes,
        status: input.status,
        mappedCategoryId: input.mappedCategoryId,
        acceptedMaxPriceCents: input.acceptedMaxPriceCents
      },
      include: { suggestedCategory: true, mappedCategory: true }
    }).catch(() => null);
    if (!mapping) return null;
    await this.log(ownerId, "MSRP_MAPPING_CHANGED", `MSRP mapping changed for ${mapping.productName}.`, { mappingId: id, patch: input });
    return this.toDto(mapping);
  }

  async categories(ownerId: string): Promise<Array<{ id: string; kind: string; label: string; msrpCents?: number | null; acceptedMaxPriceCents?: number | null }>> {
    const categories = await this.prisma.productCategory.findMany({ orderBy: { label: "asc" } });
    return Promise.all(categories.map(async (category) => {
      const price = await this.priceForCategory(ownerId, category);
      return { id: category.id, kind: category.kind, label: category.label, ...price };
    }));
  }

  private async recalculateForMapping(ownerId: string, mapping: MappingWithRelations): Promise<void> {
    if (!mapping.retailerProductId || !mapping.msrpCents) {
      return;
    }
    const checks = await this.prisma.stockCheckResult.findMany({
      where: { retailerProductId: mapping.retailerProductId, store: { ownerId } },
      orderBy: { checkedAt: "desc" },
      take: 10
    });
    for (const check of checks) {
      if (check.priceCents == null) continue;
      const evaluated = evaluateAcceptablePrice({
        priceCents: check.priceCents,
        msrpCents: mapping.msrpCents,
        customMaxPriceCents: mapping.acceptedMaxPriceCents,
        sellerAccepted: check.sellerAccepted
      });
      const updated = await this.prisma.stockCheckResult.update({
        where: { id: check.id },
        data: {
          msrpCents: mapping.msrpCents,
          acceptedMaxPriceCents: evaluated.acceptedMaxPriceCents,
          accepted: evaluated.accepted,
          priceStatus: evaluated.priceStatus,
          skipReason: evaluated.skipReason,
          alertStatus: evaluated.accepted ? AlertStatus.READY : check.alertStatus
        }
      });
      await this.log(ownerId, "MSRP_PRICE_RECALCULATED", `Price status recalculated after MSRP mapping for ${mapping.productName}.`, {
        mappingId: mapping.id,
        stockCheckResultId: check.id,
        priceStatus: evaluated.priceStatus
      });
      if (evaluated.accepted) {
        const duplicate = await this.prisma.alertEvent.findFirst({
          where: {
            createdAt: { gte: new Date(Date.now() - 6 * 60 * 60 * 1000) },
            stockCheckResult: {
              retailerProductId: mapping.retailerProductId,
              priceCents: check.priceCents,
              stockStatus: check.stockStatus
            }
          }
        });
        if (duplicate) {
          await this.log(ownerId, "MSRP_MAPPING_DUPLICATE_ALERT_SUPPRESSED", `Duplicate alert suppressed after mapping for ${mapping.productName}.`, {
            mappingId: mapping.id,
            stockCheckResultId: check.id
          });
        } else {
          await this.prisma.alertEvent.create({
            data: {
              ownerId,
              stockCheckResultId: updated.id,
              type: "ACCEPTABLE_PRICE_FOUND",
              templateType: updated.priceStatus === "MSRP_MATCH" ? "MSRP_MATCH_FOUND" : "ACCEPTED_PRICE_FOUND",
              title: updated.priceStatus === "MSRP_MATCH" ? "MSRP Match Found" : "Accepted Price Found",
              priority: updated.priceStatus === "MSRP_MATCH" ? "URGENT" : "HIGH",
              status: "PENDING",
              message: `${mapping.productName} is now mapped and accepted at $${(check.priceCents / 100).toFixed(2)}. Open product: ${mapping.productUrl ?? "unknown"}`
            }
          });
          await this.log(ownerId, "MSRP_MAPPING_ALERT_CREATED", `Alert created after MSRP mapping for ${mapping.productName}.`, {
            mappingId: mapping.id,
            stockCheckResultId: check.id
          });
        }
      }
    }
  }

  private async setStatus(ownerId: string, id: string, status: MSRPMappingStatus, action: AuditAction, summary: string): Promise<MSRPMappingDto | null> {
    const mapping = await this.prisma.productMSRPMapping.update({
      where: { id, ownerId },
      data: { status },
      include: { suggestedCategory: true, mappedCategory: true }
    }).catch(() => null);
    if (!mapping) return null;
    await this.log(ownerId, action, `${summary} ${mapping.productName}`, { mappingId: id, status });
    return this.toDto(mapping);
  }

  private async findExisting(ownerId: string, storeKey: string, retailerSku: string | null | undefined, key: string) {
    return this.prisma.productMSRPMapping.findFirst({
      where: {
        ownerId,
        storeKey,
        OR: [
          ...(retailerSku ? [{ retailerSku }] : []),
          { normalizedProductKey: key }
        ]
      }
    });
  }

  private async findMapped(ownerId: string, storeKey: string, retailerSku: string | null | undefined, key: string, retailerProductId?: string | null) {
    return this.prisma.productMSRPMapping.findFirst({
      where: {
        ownerId,
        storeKey,
        status: "MAPPED",
        OR: [
          ...(retailerSku ? [{ retailerSku }] : []),
          ...(retailerProductId ? [{ retailerProductId }] : []),
          { normalizedProductKey: key }
        ]
      }
    });
  }

  private async priceForCategory(ownerId: string, category: ProductCategory, acceptedMaxOverride?: number | null): Promise<{ msrpCents?: number | null; acceptedMaxPriceCents?: number | null }> {
    const msrp = await this.prisma.productMSRP.findFirst({
      where: { OR: [{ ownerId }, { ownerId: null }], categoryId: category.id },
      orderBy: { effectiveFrom: "desc" }
    });
    const rule = await this.prisma.priceRule.findFirst({
      where: {
        ownerId,
        enabled: true,
        OR: [
          { categoryId: category.id },
          { scope: "CATEGORY", target: { contains: category.label, mode: "insensitive" } }
        ]
      },
      orderBy: { updatedAt: "desc" }
    });
    const msrpCents = msrp?.msrpCents ?? rule?.msrpCents ?? null;
    return {
      msrpCents,
      acceptedMaxPriceCents: acceptedMaxOverride ?? rule?.customMaxPriceCents ?? (msrpCents == null ? null : msrpCents + (rule?.allowedMarkupCents ?? 0))
    };
  }

  private toDto(mapping: MappingWithRelations): MSRPMappingDto {
    return {
      id: mapping.id,
      storeKey: mapping.storeKey,
      retailerSku: mapping.retailerSku,
      retailerProductId: mapping.retailerProductId,
      productName: mapping.productName,
      productUrl: mapping.productUrl,
      imageUrl: mapping.imageUrl,
      currentPriceCents: mapping.currentPriceCents,
      detectedKeywords: mapping.detectedKeywords,
      suggestedCategoryId: mapping.suggestedCategoryId,
      suggestedCategoryLabel: mapping.suggestedCategory?.label,
      mappedCategoryId: mapping.mappedCategoryId,
      mappedCategoryLabel: mapping.mappedCategory?.label,
      msrpCents: mapping.msrpCents,
      acceptedMaxPriceCents: mapping.acceptedMaxPriceCents,
      confidence: mapping.confidence,
      status: mapping.status,
      notes: mapping.notes,
      createdAt: iso(mapping.createdAt),
      updatedAt: iso(mapping.updatedAt)
    };
  }

  private async log(ownerId: string, action: AuditAction, summary: string, metadata?: Record<string, unknown>): Promise<void> {
    await this.audit.log({ action, summary, actorUserId: ownerId, metadata });
  }
}
