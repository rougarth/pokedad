import "dotenv/config";
import argon2 from "argon2";
import { PrismaClient } from "@prisma/client";
import { env } from "../src/config/env.js";
import { SecretsService } from "../src/security/secrets.service.js";

const prisma = new PrismaClient();

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000);
const mappingKey = (name: string, url?: string) => `${name} ${url ?? ""}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 180);

const categorySeeds = [
  ["BOOSTER_BUNDLE", "Booster Bundle", 2699],
  ["ELITE_TRAINER_BOX", "Elite Trainer Box", 4999],
  ["POKEMON_CENTER_ETB", "Pokemon Center ETB", 5999],
  ["BOOSTER_BOX", "Booster Box", 16164],
  ["COLLECTION_BOX", "Collection Box", 1999],
  ["PREMIUM_COLLECTION", "Premium Collection", 3999],
  ["ULTRA_PREMIUM_COLLECTION", "Ultra Premium Collection", 11999],
  ["MINI_TIN", "Mini Tin", 999],
  ["TIN", "Tin", 1499],
  ["SLEEVED_BOOSTER", "Sleeved Booster", 499],
  ["NEW_RELEASE", "New Release Product", null]
] as const;

const storeSeeds = [
  ["Target", "target", "https://www.target.com", "https://www.target.com/login", "https://www.target.com/cart", "LOGGED_IN", true, "OPEN_ONLY", 500, null],
  ["Best Buy", "best-buy", "https://www.bestbuy.com", "https://www.bestbuy.com/identity/signin", "https://www.bestbuy.com/cart", "LOGGED_IN", true, "OPEN_ONLY", 500, null],
  ["Pokemon Center", "pokemon-center", "https://www.pokemoncenter.com", "https://www.pokemoncenter.com/login", "https://www.pokemoncenter.com/cart", "QUEUE_DETECTED", true, "OPEN_ONLY", 1000, "Queue detected. Helper stopped and requires manual action."],
  ["Walmart", "walmart", "https://www.walmart.com", "https://www.walmart.com/account/login", "https://www.walmart.com/cart", "LOGIN_EXPIRED", true, "OPEN_ONLY", 500, "Login expired for browser helper."],
  ["GameStop", "gamestop", "https://www.gamestop.com", "https://www.gamestop.com/login", "https://www.gamestop.com/cart", "NOT_LOGGED_IN", false, "DISABLED", 500, null],
  ["Sam's Club", "sams-club", "https://www.samsclub.com", "https://www.samsclub.com/login", "https://www.samsclub.com/cart", "LOGGED_IN", true, "OPEN_ONLY", 800, null],
  ["Costco", "costco", "https://www.costco.com", "https://www.costco.com/LogonForm", "https://www.costco.com/CheckoutCartDisplayView", "UNKNOWN", false, "DISABLED", 800, "Monitoring disabled."],
  ["BJ's", "bjs", "https://www.bjs.com", "https://www.bjs.com/login", "https://www.bjs.com/cart", "NOT_LOGGED_IN", false, "DISABLED", 800, null],
  ["Amazon", "amazon", "https://www.amazon.com", "https://www.amazon.com/ap/signin", "https://www.amazon.com/gp/cart/view.html", "UNKNOWN", true, "OPEN_ONLY", 0, "Skipped third-party marketplace result."],
  ["Barnes & Noble", "barnes-noble", "https://www.barnesandnoble.com", "https://www.barnesandnoble.com/account/login", "https://www.barnesandnoble.com/cart", "LOGGED_IN", true, "OPEN_ONLY", 500, null],
  ["Dick's Sporting Goods", "dicks-sporting-goods", "https://www.dickssportinggoods.com", "https://www.dickssportinggoods.com/Login", "https://www.dickssportinggoods.com/cart", "UNKNOWN", true, "OPEN_ONLY", 500, null],
  ["Ace Hardware", "ace-hardware", "https://www.acehardware.com", "https://www.acehardware.com/login", "https://www.acehardware.com/cart", "NOT_LOGGED_IN", false, "DISABLED", 300, null]
] as const;

const productSeeds = [
  ["Mega Evolution Booster Bundle", "BOOSTER_BUNDLE", "store-target", "#157f7b", "Target", true, "https://www.target.com/demo-booster-bundle"],
  ["Journey Together Elite Trainer Box", "ELITE_TRAINER_BOX", "store-best-buy", "#b98522", "Best Buy", true, "https://www.bestbuy.com/demo-etb"],
  ["Pokemon Center Elite Trainer Box", "POKEMON_CENTER_ETB", "store-pokemon-center", "#6d5bd0", "Pokemon Center", true, "https://www.pokemoncenter.com/demo-pc-etb"],
  ["Ultra Premium Collection", "ULTRA_PREMIUM_COLLECTION", "store-walmart", "#17201a", "ToyResale Outlet", false, "https://www.walmart.com/demo-upc"],
  ["Ex Collection Box", "COLLECTION_BOX", "store-gamestop", "#c2413b", "GameStop", true, "https://www.gamestop.com/demo-collection-box"],
  ["Premium Figure Collection", "PREMIUM_COLLECTION", "store-sams-club", "#2563eb", "Sam's Club", true, "https://www.samsclub.com/demo-premium"],
  ["Mini Tin Display", "MINI_TIN", "store-costco", "#16a34a", "Costco", true, "https://www.costco.com/demo-mini-tin"],
  ["Collector Tin", "TIN", "store-bjs", "#0f766e", "BJ's", true, "https://www.bjs.com/demo-tin"],
  ["Sleeved Booster Pack", "SLEEVED_BOOSTER", "store-amazon", "#ea580c", "Amazon.com", true, "https://www.amazon.com/demo-sleeved"],
  ["Booster Box", "BOOSTER_BOX", "store-dicks-sporting-goods", "#7c3aed", "Dick's Sporting Goods", true, "https://www.dickssportinggoods.com/demo-booster-box"],
  ["New Release Build & Battle Stadium", "NEW_RELEASE", "store-barnes-noble", "#0891b2", "Barnes & Noble", true, "https://www.barnesandnoble.com/demo-new-release"]
] as const;

async function main() {
  const email = env.ADMIN_EMAIL.toLowerCase();
  const passwordHash = await argon2.hash(env.ADMIN_PASSWORD, { type: argon2.argon2id });
  const user = await prisma.user.upsert({
    where: { email },
    create: { email, displayName: "PokeDad Admin", passwordHash },
    update: { displayName: "PokeDad Admin", passwordHash }
  });

  const discordConnection = await prisma.appSetting.findUnique({ where: { ownerId_key: { ownerId: user.id, key: "discordOAuthConnection" } } });
  const discordConnectionValue = discordConnection?.value && typeof discordConnection.value === "object" && !Array.isArray(discordConnection.value) ? discordConnection.value as Record<string, unknown> : null;
  const protectedDiscordChannelId = typeof discordConnectionValue?.alertChannelId === "string" ? discordConnectionValue.alertChannelId : null;
  const protectedDiscordChannel = protectedDiscordChannelId ? await prisma.alertChannel.findFirst({ where: { id: protectedDiscordChannelId, ownerId: user.id } }) : null;
  const protectedSecretId = protectedDiscordChannel?.encryptedSecretId ?? null;

  await prisma.alertEvent.deleteMany({
    where: {
      OR: [
        { alertChannel: { ownerId: user.id } },
        { stockCheckResult: { store: { ownerId: user.id } } }
      ]
    }
  });
  await prisma.cartAssistAttempt.deleteMany({ where: { stockCheckResult: { store: { ownerId: user.id } } } });
  await prisma.stockCheckResult.deleteMany({ where: { store: { ownerId: user.id } } });
  await prisma.actionItemState.deleteMany({ where: { userId: user.id } });
  await prisma.releaseCalendarItem.deleteMany({ where: { ownerId: user.id } });
  await prisma.manualStoreLink.deleteMany({ where: { ownerId: user.id } });
  await prisma.wishlistItem.deleteMany({ where: { ownerId: user.id } });
  await prisma.priceRule.deleteMany({ where: { ownerId: user.id } });
  await prisma.productWatchRule.deleteMany({ where: { ownerId: user.id } });
  await prisma.productMSRP.deleteMany({ where: { ownerId: user.id } });
  await prisma.alertChannel.deleteMany({ where: { ownerId: user.id, ...(protectedDiscordChannelId ? { id: { not: protectedDiscordChannelId } } : {}) } });
  await prisma.encryptedSecret.deleteMany({ where: { ownerId: user.id, ...(protectedSecretId ? { id: { not: protectedSecretId } } : {}) } });
  await prisma.appSetting.deleteMany({ where: { ownerId: user.id, key: { not: "discordOAuthConnection" } } });
  await prisma.productMSRPMapping.deleteMany({ where: { ownerId: user.id } });
  await prisma.auditLog.deleteMany({ where: { actorUserId: user.id } });
  await prisma.store.deleteMany({ where: { ownerId: user.id } });

  const categories = new Map<string, string>();
  for (const [kind, label] of categorySeeds) {
    const category = await prisma.productCategory.upsert({
      where: { kind },
      create: { kind, label },
      update: { label }
    });
    categories.set(kind, category.id);
  }

  for (const [kind, , msrpCents] of categorySeeds) {
    if (msrpCents != null) {
      await prisma.productMSRP.create({
        data: {
          ownerId: user.id,
          categoryId: categories.get(kind),
          msrpCents
        }
      });
    }
  }

  const stores = new Map<string, { id: string; cartUrl: string }>();
  for (const [name, slug, baseUrl, loginUrl, cartUrl, sessionState, monitoringEnabled, cartAssistMode, defaultToleranceCents, lastError] of storeSeeds) {
    const store = await prisma.store.create({
      data: {
        id: `store-${slug}`,
        ownerId: user.id,
        name,
        slug,
        baseUrl,
        loginUrl,
        cartUrl,
        monitoringEnabled,
        cartAssistEnabled: cartAssistMode !== "DISABLED",
        cartAssistMode,
        sellerPolicy: "OFFICIAL_ONLY",
        defaultToleranceCents,
        adapterSafetyLevel: "OPEN_ONLY",
        lastSuccessfulCheckAt: hoursAgo(Math.random() * 4 + 0.1),
        lastError,
        sessionStatus: {
          create: {
            state: sessionState,
            checkedAt: hoursAgo(0.25),
            message: lastError
          }
        }
      }
    });
    stores.set(store.id, { id: store.id, cartUrl });
  }

  await prisma.appSetting.create({
    data: {
      ownerId: user.id,
      key: "radarRules",
      value: {
        monitorAllSealed: true,
        selectedCategories: categorySeeds.map(([kind]) => kind),
        monitorNewReleases: true,
        ignoreSingles: true,
        ignoreThirdPartySellers: true,
        shippingPreferred: true,
        pickupPreferred: true,
        pickupZip: "19019",
        pickupRadiusMiles: 25,
        quantityWantedPerProduct: 1,
        maxQuantityPerStoreProduct: 1
      }
    }
  });

  await prisma.appSetting.create({
    data: {
      ownerId: user.id,
      key: "alertTemplateSettings",
      value: {
        compactMobileAlerts: true,
        includeProductImage: true,
        includeMsrpDetails: true,
        includeOpenProductLink: true
      }
    }
  });

  await prisma.appSetting.create({
    data: {
      ownerId: user.id,
      key: "bestBuyScanConfig",
      value: {
        enabled: true,
        scheduledScanEnabled: false,
        scanIntervalSeconds: 1800,
        searchTerms: [
          "pokemon cards",
          "pokemon tcg",
          "pokemon booster",
          "pokemon elite trainer box",
          "pokemon booster bundle",
          "pokemon collection box",
          "pokemon tin",
          "pokemon premium collection",
          "pokemon upc"
        ],
        maxResultsPerScan: 20,
        minimumDelayBetweenApiCallsMs: 1500,
        onlyOfficialBestBuySeller: true,
        onlyPokemonTcgSealedProducts: true,
        applyPriceRules: true,
        createLiveFindCandidates: true,
        sendAlertsForAcceptedPrices: true,
        sendAlertsAutomatically: true,
        sendScanFailureAlerts: false,
        ignoreOverLimitProducts: true,
        ignoreUnknownSuspiciousProducts: true,
        alertOnUnknownMsrp: false,
        autoSuggestMsrpCategory: true,
        alertCooldownMinutes: 360
      }
    }
  });

  await prisma.appSetting.create({
    data: {
      ownerId: user.id,
      key: "bestBuyScanStatus",
      value: {
        status: "IDLE",
        locked: false,
        lastRequestCount: 0,
        lastProductsCheckedCount: 0,
        lastMatchCount: 0,
        lastResultCount: 0,
        lastAcceptedCount: 0,
        lastOverLimitCount: 0,
        lastUnknownMsrpCount: 0,
        lastMappingCandidateCreatedCount: 0,
        lastAlertCount: 0,
        lastSuppressedDuplicateCount: 0
      }
    }
  });

  await prisma.appSetting.create({
    data: {
      ownerId: user.id,
      key: "bestBuySchedulerState",
      value: { status: "STOPPED", active: false }
    }
  });

  await prisma.productWatchRule.create({
    data: {
      ownerId: user.id,
      name: "All sealed Pokemon TCG products",
      monitorAllSealed: true,
      monitorNewReleases: true,
      ignoreSingles: true,
      ignoreThirdParty: true,
      fulfillmentPreference: "EITHER",
      pickupZip: "19019",
      pickupRadiusMiles: 25
    }
  });

  const priceRules = [
    ["Global fair-price default", "GLOBAL", "All sealed products", null, 500, null, null, null, null],
    ["Booster Bundle cap", "CATEGORY", "Booster Bundle", 2699, 800, 3499, null, 800, null],
    ["ETB cap", "CATEGORY", "Elite Trainer Box", 4999, 1000, 5999, null, 1000, null],
    ["Pokemon Center ETB override", "PRODUCT", "Pokemon Center ETB", 5999, 1000, 6999, null, null, 6999],
    ["UPC cap", "CATEGORY", "Ultra Premium Collection", 11999, 1000, 12999, null, 1000, null],
    ["Collection Box cap", "CATEGORY", "Collection Box", 1999, 500, 2499, null, 500, null],
    ["Premium Collection cap", "CATEGORY", "Premium Collection", 3999, 1000, 4999, null, 1000, null],
    ["Membership store exception", "STORE", "Sam's Club / Costco / BJ's", null, 800, null, 800, null, null]
  ] as const;

  for (const [label, scope, target, msrpCents, allowedMarkupCents, maxAcceptedPriceCents, storeSpecificToleranceCents, categorySpecificToleranceCents, productSpecificOverrideCents] of priceRules) {
    await prisma.priceRule.create({
      data: {
        ownerId: user.id,
        label,
        scope,
        target,
        msrpCents,
        allowedMarkupCents,
        customMaxPriceCents: maxAcceptedPriceCents,
        toleranceCents: allowedMarkupCents,
        storeSpecificToleranceCents,
        categorySpecificToleranceCents,
        productSpecificOverrideCents,
        enabled: true
      }
    });
  }

  const wishlistSeeds = [
    {
      name: "Prismatic Evolutions Booster Bundle",
      setName: "Prismatic Evolutions",
      kind: "BOOSTER_BUNDLE",
      priority: "URGENT",
      alertBehavior: "ALERT_IMMEDIATELY",
      desiredQuantity: 2,
      maxPriceCents: 3499,
      allowedMarkupCents: 800,
      keywords: ["prismatic evolutions", "booster bundle"],
      notes: "Top hunt item. Alert immediately when the price is acceptable."
    },
    {
      name: "Pokemon Center ETB",
      setName: null,
      kind: "POKEMON_CENTER_ETB",
      priority: "URGENT",
      alertBehavior: "ALERT_IMMEDIATELY",
      desiredQuantity: 1,
      maxPriceCents: 6999,
      allowedMarkupCents: 1000,
      keywords: ["pokemon center etb", "pokemon center elite trainer box"],
      notes: "Urgent, official Pokemon Center-style ETB target."
    },
    {
      name: "Booster Bundle",
      setName: null,
      kind: "BOOSTER_BUNDLE",
      priority: "HIGH",
      alertBehavior: "ALERT_IMMEDIATELY",
      desiredQuantity: 2,
      maxPriceCents: 3499,
      allowedMarkupCents: 800,
      keywords: ["booster bundle"],
      notes: "High priority sealed product."
    },
    {
      name: "Elite Trainer Box",
      setName: null,
      kind: "ELITE_TRAINER_BOX",
      priority: "HIGH",
      alertBehavior: "ALERT_IMMEDIATELY",
      desiredQuantity: 1,
      maxPriceCents: 5999,
      allowedMarkupCents: 1000,
      keywords: ["elite trainer box", "etb"],
      notes: "High priority ETB rule."
    },
    {
      name: "Premium Collection",
      setName: null,
      kind: "PREMIUM_COLLECTION",
      priority: "NORMAL",
      alertBehavior: "DASHBOARD_ONLY",
      desiredQuantity: 1,
      maxPriceCents: 4999,
      allowedMarkupCents: 1000,
      keywords: ["premium collection"],
      notes: "Show in dashboard first."
    },
    {
      name: "Collection Box",
      setName: null,
      kind: "COLLECTION_BOX",
      priority: "NORMAL",
      alertBehavior: "DASHBOARD_ONLY",
      desiredQuantity: 1,
      maxPriceCents: 2499,
      allowedMarkupCents: 500,
      keywords: ["collection box", "collection item"],
      notes: "Normal priority dashboard item."
    },
    {
      name: "Tin / Mini Tin",
      setName: null,
      kind: "TIN",
      priority: "NORMAL",
      alertBehavior: "DASHBOARD_ONLY",
      desiredQuantity: 1,
      maxPriceCents: 1799,
      allowedMarkupCents: 300,
      keywords: ["tin", "mini tin"],
      notes: "Normal priority tins."
    },
    {
      name: "Loose or single card listings",
      setName: null,
      kind: null,
      priority: "IGNORE",
      alertBehavior: "DO_NOT_ALERT",
      desiredQuantity: null,
      maxPriceCents: null,
      allowedMarkupCents: null,
      keywords: ["loose", "single", "singles", "card lot", "marketplace lot"],
      notes: "Ignore loose cards and singles."
    },
    {
      name: "Overpriced marketplace listings",
      setName: null,
      kind: null,
      priority: "IGNORE",
      alertBehavior: "DO_NOT_ALERT",
      desiredQuantity: null,
      maxPriceCents: null,
      allowedMarkupCents: null,
      keywords: ["marketplace", "third party", "resale", "reseller"],
      notes: "Ignore marketplace-like listings."
    },
    ...[
      "Journey Together",
      "Surging Sparks",
      "Twilight Masquerade",
      "Temporal Forces",
      "Paldean Fates",
      "151",
      "Crown Zenith",
      "Obsidian Flames",
      "Scarlet & Violet",
      "Sword & Shield"
    ].map((setName) => ({
      name: `${setName} set tracker`,
      setName,
      kind: null,
      priority: "NORMAL",
      alertBehavior: "REVIEW_FIRST",
      desiredQuantity: null,
      maxPriceCents: null,
      allowedMarkupCents: null,
      keywords: [setName],
      notes: "Editable set tracking seed."
    }))
  ] as const;

  const wishlistItems = new Map<string, string>();
  for (const item of wishlistSeeds) {
    const wishlistItem = await prisma.wishlistItem.create({
      data: {
        ownerId: user.id,
        name: item.name,
        setName: item.setName,
        categoryId: item.kind ? categories.get(item.kind) : null,
        priority: item.priority,
        alertBehavior: item.alertBehavior,
        desiredQuantity: item.desiredQuantity,
        maxPriceCents: item.maxPriceCents,
        allowedMarkupCents: item.allowedMarkupCents,
        keywords: [...item.keywords].map((keyword) => keyword.toLowerCase()),
        isActive: true,
        notes: item.notes
      }
    });
    wishlistItems.set(item.name, wishlistItem.id);
  }

  const manualStoreLinkSeeds = [
    ["target", "Target Pokemon cards search", "https://www.target.com/s?searchTerm=pokemon+cards", "SEARCH", "HIGH", "Prismatic Evolutions Booster Bundle", "Prismatic Evolutions", "BOOSTER_BUNDLE", "Manual reference only. Check mornings."],
    ["walmart", "Walmart Pokemon cards search", "https://www.walmart.com/search?q=pokemon%20cards", "SEARCH", "HIGH", "Booster Bundle", null, "BOOSTER_BUNDLE", "Prefer official seller only when opening manually."],
    ["best-buy", "Best Buy Pokemon cards search", "https://www.bestbuy.com/site/searchpage.jsp?st=pokemon%20cards", "SEARCH", "HIGH", "Booster Bundle", null, "BOOSTER_BUNDLE", "Manual link while API approval is pending."],
    ["pokemon-center", "Pokemon Center TCG category", "https://www.pokemoncenter.com/category/trading-card-game", "CATEGORY", "URGENT", "Pokemon Center ETB", null, "POKEMON_CENTER_ETB", "If queue appears, handle manually."],
    ["gamestop", "GameStop Pokemon cards search", "https://www.gamestop.com/search/?q=pokemon%20cards", "SEARCH", "NORMAL", "Elite Trainer Box", null, "ELITE_TRAINER_BOX", "Manual search only."],
    ["costco", "Costco Pokemon search", "https://www.costco.com/CatalogSearch?keyword=pokemon", "SEARCH", "NORMAL", "Premium Collection", null, "PREMIUM_COLLECTION", "Membership store; manual reference only."],
    ["sams-club", "Sam's Club Pokemon search", "https://www.samsclub.com/s/pokemon", "SEARCH", "NORMAL", "Premium Collection", null, "PREMIUM_COLLECTION", "Manual reference only."],
    ["bjs", "BJ's Pokemon search", "https://www.bjs.com/search/pokemon", "SEARCH", "NORMAL", "Tin / Mini Tin", null, "TIN", "Manual reference only."],
    ["amazon", "Amazon Pokemon TCG search", "https://www.amazon.com/s?k=pokemon+tcg", "SEARCH", "NORMAL", "Sleeved Booster", null, "SLEEVED_BOOSTER", "Manual opening only; verify seller yourself."],
    ["barnes-noble", "Barnes & Noble Pokemon cards search", "https://www.barnesandnoble.com/s/pokemon%20cards", "SEARCH", "NORMAL", "Collection Box", null, "COLLECTION_BOX", "Manual reference only."]
  ] as const;

  const storeDisplayNames = new Map(storeSeeds.map(([name, slug]) => [slug, name]));
  const manualStoreLinks = new Map<string, string>();
  for (const [storeKey, title, url, linkType, priority, wishlistName, setName, categoryKind, notes] of manualStoreLinkSeeds) {
    const link = await prisma.manualStoreLink.create({
      data: {
        ownerId: user.id,
        storeKey,
        storeDisplayName: storeDisplayNames.get(storeKey) ?? storeKey,
        title,
        url,
        linkType,
        priority,
        wishlistItemId: wishlistName ? wishlistItems.get(wishlistName) ?? null : null,
        setName,
        categoryId: categoryKind ? categories.get(categoryKind) : null,
        notes,
        isActive: true
      }
    });
    manualStoreLinks.set(title, link.id);
  }

  const daysFromNow = (days: number, hour = 9) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    date.setHours(hour, 0, 0, 0);
    return date;
  };

  const releaseSeeds = [
    {
      title: "Prismatic Evolutions Booster Bundle",
      setName: "Prismatic Evolutions",
      productName: "Booster Bundle",
      categoryKind: "BOOSTER_BUNDLE",
      releaseDate: daysFromNow(7, 9),
      priority: "URGENT",
      status: "UPCOMING",
      wishlistName: "Prismatic Evolutions Booster Bundle",
      linkTitles: ["Target Pokemon cards search", "Walmart Pokemon cards search", "Best Buy Pokemon cards search", "Pokemon Center TCG category"],
      notes: "Demo/manual release reminder. Confirm official retailer and price manually."
    },
    {
      title: "Pokemon Center ETB launch watch",
      setName: "Prismatic Evolutions",
      productName: "Pokemon Center ETB",
      categoryKind: "POKEMON_CENTER_ETB",
      releaseDate: daysFromNow(10, 10),
      priority: "URGENT",
      status: "WATCHING",
      wishlistName: "Pokemon Center ETB",
      linkTitles: ["Pokemon Center TCG category", "Target Pokemon cards search"],
      notes: "Manual/open-only. If queue or human verification appears, handle it yourself."
    },
    {
      title: "New Collection Box",
      setName: "Journey Together",
      productName: "Collection Box",
      categoryKind: "COLLECTION_BOX",
      releaseDate: daysFromNow(17, 9),
      priority: "NORMAL",
      status: "PLANNED",
      wishlistName: "Collection Box",
      linkTitles: ["Walmart Pokemon cards search", "GameStop Pokemon cards search", "Barnes & Noble Pokemon cards search"],
      notes: "Normal-priority manual launch reminder."
    },
    {
      title: "Mini Tin wave",
      setName: "Surging Sparks",
      productName: "Mini Tin",
      categoryKind: "MINI_TIN",
      releaseDate: daysFromNow(24, 8),
      priority: "NORMAL",
      status: "UPCOMING",
      wishlistName: "Tin / Mini Tin",
      linkTitles: ["Costco Pokemon search", "Sam's Club Pokemon search", "BJ's Pokemon search"],
      notes: "Membership store links are manual reference only."
    },
    {
      title: "Booster Bundle restock watch",
      setName: "151",
      productName: "Booster Bundle",
      categoryKind: "BOOSTER_BUNDLE",
      releaseDate: daysFromNow(3, 7),
      priority: "HIGH",
      status: "WATCHING",
      wishlistName: "Booster Bundle",
      linkTitles: ["Best Buy Pokemon cards search", "Walmart Pokemon cards search", "Amazon Pokemon TCG search"],
      notes: "Restock watch entry; no retailer request is made by reminders."
    }
  ] as const;

  for (const seed of releaseSeeds) {
    await prisma.releaseCalendarItem.create({
      data: {
        ownerId: user.id,
        title: seed.title,
        setName: seed.setName,
        productName: seed.productName,
        categoryId: categories.get(seed.categoryKind),
        releaseDate: seed.releaseDate,
        timezone: "America/New_York",
        priority: seed.priority,
        status: seed.status,
        wishlistItemId: wishlistItems.get(seed.wishlistName) ?? null,
        notes: seed.notes,
        isActive: true,
        discordReminder: true,
        reminderOffsets: ["SEVEN_DAYS", "ONE_DAY", "ONE_HOUR", "AT_RELEASE"],
        manualLinks: {
          create: seed.linkTitles
            .map((title) => manualStoreLinks.get(title))
            .filter((id): id is string => Boolean(id))
            .map((manualStoreLinkId) => ({ manualStoreLinkId }))
        }
      }
    });
  }

  const products = new Map<string, string>();
  for (const [name, kind, storeId, imageColor, sellerName, sellerIsOfficial, productUrl] of productSeeds) {
    const retailerProduct = await prisma.retailerProduct.create({
      data: {
        storeId,
        categoryId: categories.get(kind),
        externalId: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        productUrl,
        imageUrl: imageColor,
        name,
        sellerName,
        sellerIsOfficial,
        marketplaceListing: !sellerIsOfficial,
        suspicious: false
      }
    });
    products.set(name, retailerProduct.id);
  }

  const mappingSeeds = [
    {
      productName: "Best Buy Pokemon Booster Bundle",
      retailerSku: "bb-demo-booster-bundle",
      productUrl: "https://www.bestbuy.com/demo-booster-bundle",
      imageUrl: "#157f7b",
      currentPriceCents: 3299,
      detectedKeywords: ["booster bundle"],
      suggestedKind: "BOOSTER_BUNDLE",
      status: "SUGGESTED",
      confidence: "HIGH"
    },
    {
      productName: "Best Buy Pokemon Elite Trainer Box",
      retailerSku: "bb-demo-etb",
      productUrl: "https://www.bestbuy.com/demo-etb",
      imageUrl: "#b98522",
      currentPriceCents: 4999,
      detectedKeywords: ["elite trainer box"],
      suggestedKind: "ELITE_TRAINER_BOX",
      status: "SUGGESTED",
      confidence: "HIGH"
    },
    {
      productName: "Pokemon Trading Card Game Mystery Collection",
      retailerSku: "bb-demo-mystery-collection",
      productUrl: "https://www.bestbuy.com/demo-mystery-collection",
      imageUrl: "#64748b",
      currentPriceCents: 4499,
      detectedKeywords: ["collection"],
      suggestedKind: null,
      status: "NEEDS_REVIEW",
      confidence: "LOW"
    },
    {
      productName: "Pokemon Loose Card Marketplace Lot",
      retailerSku: "bb-demo-loose-lot",
      productUrl: "https://www.bestbuy.com/demo-loose-lot",
      imageUrl: "#991b1b",
      currentPriceCents: 9999,
      detectedKeywords: [],
      suggestedKind: null,
      status: "IGNORED",
      confidence: "LOW"
    }
  ] as const;

  for (const seed of mappingSeeds) {
    const suggestedCategoryId = seed.suggestedKind ? categories.get(seed.suggestedKind) : null;
    const msrpCents = seed.suggestedKind === "BOOSTER_BUNDLE" ? 2699 : seed.suggestedKind === "ELITE_TRAINER_BOX" ? 4999 : null;
    const acceptedMaxPriceCents = seed.suggestedKind === "BOOSTER_BUNDLE" ? 3499 : seed.suggestedKind === "ELITE_TRAINER_BOX" ? 5999 : null;
    await prisma.productMSRPMapping.create({
      data: {
        ownerId: user.id,
        storeKey: "best-buy",
        retailerSku: seed.retailerSku,
        retailerProductId: seed.productName.includes("Elite Trainer") ? products.get("Journey Together Elite Trainer Box") : null,
        productName: seed.productName,
        normalizedProductKey: mappingKey(seed.productName, seed.productUrl),
        productUrl: seed.productUrl,
        imageUrl: seed.imageUrl,
        currentPriceCents: seed.currentPriceCents,
        detectedKeywords: [...seed.detectedKeywords],
        suggestedCategoryId,
        msrpCents,
        acceptedMaxPriceCents,
        confidence: seed.confidence,
        status: seed.status
      }
    });
  }

  const checks = [
    ["Mega Evolution Booster Bundle", "store-target", 3499, 2699, 3499, true, true, "ACCEPTED_MARKUP", "IN_STOCK", true, true, "NONE", "PRICE_ACCEPTED", "READY", 0.08],
    ["Pokemon Center Elite Trainer Box", "store-pokemon-center", 6999, 5999, 6999, true, true, "ACCEPTED_MARKUP", "IN_STOCK", true, false, "QUEUE_DETECTED", "QUEUE_DETECTED", "SENT", 0.2],
    ["Journey Together Elite Trainer Box", "store-best-buy", 4999, 4999, 5999, true, true, "MSRP_MATCH", "PREORDER", true, null, "NONE", "PRODUCT_FOUND", "SENT", 0.7],
    ["Ultra Premium Collection", "store-walmart", 15999, 11999, 12999, false, false, "THIRD_PARTY_SKIPPED", "IN_STOCK", true, false, "THIRD_PARTY_SELLER", "SKIPPED", "SUPPRESSED", 1.8],
    ["Premium Figure Collection", "store-sams-club", 4799, 3999, 4999, true, true, "ACCEPTED_MARKUP", "IN_STOCK", true, true, "NONE", "CART_READY", "SENT", 2.1],
    ["New Release Build & Battle Stadium", "store-barnes-noble", 5999, null, null, true, true, "UNKNOWN_MSRP", "UNKNOWN", null, null, "NONE", "NOT_ATTEMPTED", "NOT_SENT", 4.5],
    ["Mini Tin Display", "store-costco", 1299, 999, 1799, true, false, "ACCEPTED_MARKUP", "OUT_OF_STOCK", false, false, "STORE_DISABLED", "SKIPPED", "NOT_SENT", 20]
  ] as const;

  for (const [productName, storeId, priceCents, msrpCents, acceptedMaxPriceCents, sellerAccepted, accepted, priceStatus, stockStatus, shippingAvailable, pickupAvailable, skipReason, cartStatus, alertStatus, checkedHoursAgo] of checks) {
    const check = await prisma.stockCheckResult.create({
      data: {
        storeId,
        retailerProductId: products.get(productName)!,
        checkedAt: hoursAgo(checkedHoursAgo),
        priceCents,
        msrpCents,
        acceptedMaxPriceCents,
        accepted,
        sellerName: productSeeds.find(([name]) => name === productName)?.[4],
        sellerAccepted,
        priceStatus,
        alertStatus,
        stockStatus,
        shippingAvailable,
        pickupAvailable,
        skipReason,
        rawMetadata: productName === "Mini Tin Display" ? { soldOutAt: hoursAgo(18).toISOString() } : {}
      }
    });

    if (cartStatus !== "NOT_ATTEMPTED") {
      const cartStatusValue: string = cartStatus;
      const manualStop = cartStatusValue === "QUEUE_DETECTED" || cartStatusValue === "CAPTCHA_DETECTED" || cartStatusValue === "HUMAN_CHECK_REQUIRED";
      await prisma.cartAssistAttempt.create({
        data: {
          stockCheckResultId: check.id,
          status: cartStatus,
          requestedQuantity: 1,
          productUrl: productSeeds.find(([name]) => name === productName)![6],
          cartUrl: stores.get(storeId)?.cartUrl,
          stopReason: manualStop ? `${cartStatus} detected. System stopped and requires manual user action.` : cartStatus === "SKIPPED" ? "Skipped by safety or seller rule." : null,
          lastMessage: manualStop
            ? "Manual action required before any further helper action."
            : cartStatus === "CART_READY"
              ? "Demo cart-ready state. Checkout remains manual."
              : "Open-only helper can open product/cart; no checkout automation.",
          createdAt: hoursAgo(checkedHoursAgo),
          updatedAt: hoursAgo(Math.max(checkedHoursAgo - 0.02, 0.01))
        }
      });
    }

    if (alertStatus === "SENT" || alertStatus === "READY") {
      await prisma.alertEvent.create({
        data: {
          ownerId: user.id,
          stockCheckResultId: check.id,
          type: "ACCEPTABLE_PRICE_FOUND",
          templateType: priceStatus === "MSRP_MATCH" ? "MSRP_MATCH_FOUND" : "ACCEPTED_PRICE_FOUND",
          title: priceStatus === "MSRP_MATCH" ? "MSRP Match Found" : "Accepted Price Found",
          priority: priceStatus === "MSRP_MATCH" ? "URGENT" : "HIGH",
          status: alertStatus === "SENT" ? "SENT" : "PENDING",
          message: `${productName} found at an acceptable demo price.`,
          sentAt: alertStatus === "SENT" ? hoursAgo(Math.max(checkedHoursAgo - 0.01, 0.01)) : null
        }
      });
    }
  }

  const secrets = new SecretsService();
  const alertChannels = [
    ["TELEGRAM", "Dad phone Telegram", { botToken: "000000000:phase7-demo-token-not-valid", chatId: "demo-chat-id" }, "Bot token ****** configured; chat ID ****** configured"],
    ["DISCORD_WEBHOOK", "Family restock channel", { webhookUrl: "https://discord.com/api/webhooks/000000000/demo-not-valid" }, "Webhook ****** configured"]
  ] as const;

  for (const [type, label, config, destinationHint] of alertChannels) {
    const encrypted = secrets.encrypt(JSON.stringify(config));
    const secret = await prisma.encryptedSecret.create({
      data: {
        ownerId: user.id,
        name: `${type.toLowerCase()}_demo_secret`,
        ...encrypted
      }
    });
    await prisma.alertChannel.create({
      data: {
        ownerId: user.id,
        type,
        label,
        enabled: false,
        encryptedSecretId: secret.id,
        destinationHint
      }
    });
  }

  await prisma.auditLog.createMany({
    data: [
      { actorUserId: user.id, action: "HELPER_CONNECTED", summary: "Local helper heartbeat received without session data.", metadata: { safetyLevel: "OPEN_ONLY" } },
      { actorUserId: user.id, action: "CART_ASSIST_STOPPED", summary: "Pokemon Center queue detected; manual action required.", metadata: { status: "QUEUE_DETECTED" } },
      { actorUserId: user.id, action: "ALERT_SENT", summary: "Acceptable price alert sent for Booster Bundle.", metadata: { channel: "Telegram" } }
    ]
  });

  console.log(`Seeded PokeDad Radar demo data for ${email}`);
  console.log(`Default local password: ${env.ADMIN_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
