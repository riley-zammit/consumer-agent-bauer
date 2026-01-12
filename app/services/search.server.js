import MiniSearch from "minisearch";
import prisma from "../db.server";

const DEFAULT_CURRENCY = "USD";
const INDEX_TTL_MS = 5 * 60 * 1000;

/**
 * @typedef {Object} BoostRule
 * @property {"vendor"|"productType"|"tags"|"handle"|"title"} field
 * @property {"equals"|"contains"|"starts_with"} op
 * @property {string} value
 * @property {number} weight
 * @property {boolean} enabled
 */

/** @type {Map<string, { miniSearch: any, builtAt: number }>} */
const indexCache = new Map();

function normalizeShopDomain(shopOrUrl) {
  if (!shopOrUrl) return null;
  try {
    if (shopOrUrl.startsWith("http://") || shopOrUrl.startsWith("https://")) {
      return new URL(shopOrUrl).hostname;
    }
    // If it's already a hostname, this will throw; we just fall through.
  } catch {
    // ignore
  }
  return shopOrUrl.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
}

async function getSessionForShop(shop) {
  return prisma.session.findFirst({
    where: { shop },
  });
}

function safeParseRules(rulesJson) {
  try {
    const parsed = JSON.parse(rulesJson || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * @returns {Promise<BoostRule[]>}
 */
async function getBoostRulesForShop(shop) {
  const row = await prisma.searchBoostConfig.findUnique({
    where: { shop },
  });
  return safeParseRules(row?.rulesJson);
}

function getProductFieldValue(product, field) {
  switch (field) {
    case "vendor":
      return product.vendor || "";
    case "productType":
      return product.productType || "";
    case "handle":
      return product.handle || "";
    case "title":
      return product.title || "";
    case "tags":
      return Array.isArray(product.tags) ? product.tags : [];
    default:
      return "";
  }
}

function matchesRule(fieldValue, rule) {
  const needle = (rule.value || "").trim().toLowerCase();
  if (!needle) return false;

  const op = rule.op;

  // tags is array-based
  if (Array.isArray(fieldValue)) {
    const tags = fieldValue.map((t) => (t || "").trim().toLowerCase()).filter(Boolean);
    if (op === "equals") return tags.some((t) => t === needle);
    if (op === "starts_with") return tags.some((t) => t.startsWith(needle));
    return tags.some((t) => t.includes(needle));
  }

  const hay = (fieldValue || "").toString().toLowerCase();
  if (op === "equals") return hay === needle;
  if (op === "starts_with") return hay.startsWith(needle);
  return hay.includes(needle);
}

function computeBoostMultiplier(product, rules) {
  let multiplier = 1;

  for (const rule of rules) {
    if (!rule || rule.enabled === false) continue;
    const fieldValue = getProductFieldValue(product, rule.field);
    if (!matchesRule(fieldValue, rule)) continue;

    const weight = Number(rule.weight);
    if (!Number.isFinite(weight) || weight === 0) continue;

    multiplier *= 1 + weight;
  }

  // Clamp so a bad config doesn't destroy ranking
  if (!Number.isFinite(multiplier)) return 1;
  return Math.min(10, Math.max(0.1, multiplier));
}

async function buildIndexForShop(shop) {
  const session = await getSessionForShop(shop);
  if (!session) {
    const miniSearch = new MiniSearch({
      fields: ["title", "description", "handle", "vendor", "productType", "tags"],
      storeFields: ["id"],
    });
    indexCache.set(shop, { miniSearch, builtAt: Date.now() });
    return miniSearch;
  }

  const products = await prisma.product.findMany({
    where: { sessionId: session.id },
    include: {
      variants: {
        orderBy: { position: "asc" },
        take: 1,
      },
    },
  });

  const miniSearch = new MiniSearch({
    fields: ["title", "description", "handle", "vendor", "productType", "tags"],
    storeFields: [
      "id",
      "handle",
      "title",
      "description",
      "featuredImageUrl",
      "vendor",
      "productType",
      "tags",
      "firstVariantPrice",
    ],
  });

  const docs = products.map((p) => ({
    id: p.id,
    handle: p.handle,
    title: p.title,
    description: p.description,
    vendor: p.vendor || "",
    productType: p.productType || "",
    tags: p.tags || "",
    featuredImageUrl: p.featuredImageUrl || "",
    firstVariantPrice: p.variants?.[0]?.price || "",
  }));

  miniSearch.addAll(docs);
  indexCache.set(shop, { miniSearch, builtAt: Date.now() });
  return miniSearch;
}

async function getIndexForShop(shop) {
  const cached = indexCache.get(shop);
  if (cached && Date.now() - cached.builtAt < INDEX_TTL_MS) return cached.miniSearch;
  return buildIndexForShop(shop);
}

function shapeProductResult(doc) {
  return {
    product_id: doc.id,
    title: doc.title || "",
    description: doc.description || "",
    url: doc.handle ? `/products/${doc.handle}` : "",
    image_url: doc.featuredImageUrl || "",
    variants: [
      {
        currency: DEFAULT_CURRENCY,
        price: doc.firstVariantPrice || "",
      },
    ],
  };
}

/**
 * Local product search exposed to the chat tool `search_products_preferred`.
 * Returns product objects shaped like `search_shop_catalog` so the existing product cards render unchanged.
 */
export async function searchProductsCustom({ shopDomain, query, limit = 10 }) {
  const shop = normalizeShopDomain(shopDomain);
  if (!shop) return [];

  const q = (query || "").trim();
  if (!q) return [];

  const [miniSearch, rules] = await Promise.all([getIndexForShop(shop), getBoostRulesForShop(shop)]);

  const baseResults = miniSearch.search(q, {
    prefix: true,
    fuzzy: 0.2,
    boost: { title: 2 },
  });

  const reranked = baseResults
    .map((r) => {
      const tagsArr = (r.tags || "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const multiplier = computeBoostMultiplier(
        {
          vendor: r.vendor,
          productType: r.productType,
          handle: r.handle,
          title: r.title,
          tags: tagsArr,
        },
        rules
      );
      return { ...r, _finalScore: (r.score || 0) * multiplier };
    })
    .sort((a, b) => (b._finalScore || 0) - (a._finalScore || 0))
    .slice(0, Math.max(1, Math.min(50, Number(limit) || 10)));

  return reranked.map(shapeProductResult);
}



