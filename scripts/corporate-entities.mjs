import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const clean = value => String(value || "").normalize("NFKC").replace(/\s+/g, " ").trim();
const keyOf = value => clean(value).toLocaleLowerCase().replace(/[^a-z0-9가-힣]+/g, "");
let cached = null;

export function loadCorporateEntities() {
  if (cached) return cached;
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  cached = JSON.parse(readFileSync(resolve(root, "config/corporate-entities.json"), "utf8"));
  return cached;
}

export function buildCorporateIndex(registry = loadCorporateEntities()) {
  const byAlias = new Map();
  const byTicker = new Map();
  for (const entity of registry.entities || []) {
    const parent = { entity, subsidiary: null };
    [entity.canonicalName, entity.legalName, entity.primaryDomain, entity.canonicalId, ...(entity.aliases || [])]
      .map(keyOf).filter(Boolean).forEach(alias => byAlias.set(alias, parent));
    if (entity.ticker) byTicker.set(entity.ticker, parent);
    for (const subsidiary of entity.subsidiaries || []) {
      const relationship = { entity, subsidiary };
      [subsidiary.name, subsidiary.legalName, subsidiary.primaryDomain, subsidiary.canonicalId, ...(subsidiary.aliases || [])]
        .map(keyOf).filter(Boolean).forEach(alias => byAlias.set(alias, relationship));
    }
  }
  return { byAlias, byTicker };
}

export function corporateRelationship(value, ticker = "", registry = loadCorporateEntities()) {
  const index = buildCorporateIndex(registry);
  return index.byTicker.get(ticker) || index.byAlias.get(keyOf(value)) || null;
}

export function consolidatedCompanyName(value, registry = loadCorporateEntities()) {
  return corporateRelationship(value, "", registry)?.entity?.canonicalName || clean(value);
}

export function corporateStructureFor(value, ticker = "", registry = loadCorporateEntities()) {
  const relationship = corporateRelationship(value, ticker, registry);
  if (!relationship) return null;
  const { entity, subsidiary } = relationship;
  return {
    canonicalId: entity.canonicalId,
    parentName: entity.canonicalName,
    legalName: entity.legalName,
    entityType: entity.entityType,
    ticker: entity.ticker || "",
    primaryDomain: entity.primaryDomain,
    brandDomains: entity.brandDomains || [],
    businessSegments: entity.businessSegments || [],
    subsidiaries: (entity.subsidiaries || []).map(item => ({
      name: item.name,
      legalName: item.legalName || "",
      relationship: item.relationship,
      effectiveDate: item.effectiveDate,
      countingPolicy: item.countingPolicy,
      primaryDomain: item.primaryDomain,
      sourceUrl: item.sourceUrl,
      transactionValue: item.transactionValue,
      transactionValueStatus: item.transactionValueStatus || "",
    })),
    aiRevenueExposure: entity.aiRevenueExposure || null,
    aggregationPolicy: relationship.subsidiary?.countingPolicy || "parent",
    relationship: subsidiary ? {
      parentName: entity.canonicalName,
      relationship: subsidiary.relationship,
      effectiveDate: subsidiary.effectiveDate,
      sourceUrl: subsidiary.sourceUrl,
    } : null,
    lastVerifiedAt: entity.lastVerifiedAt,
    sources: entity.sources || [],
  };
}
