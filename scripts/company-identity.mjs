/**
 * Canonical company identity and startup-universe partitioning.
 *
 * Company records arrive from several independent sources.  Identity is
 * resolved from official domains and disclosed operator/legal names before
 * display priority is applied.  A company is retained once; secondary lists
 * become source/portfolio metadata on that canonical record.
 */
const clean = value => String(value || "").normalize("NFKC").replace(/\s+/g, " ").trim();
const legalWords = new Set([
  "ai", "app", "apps", "inc", "incorporated", "llc", "ltd", "limited", "corp", "corporation",
  "company", "co", "opco", "pbc", "plc", "gmbh", "sa", "sas", "platform", "platforms",
  "technology", "technologies", "labs", "lab",
]);

export const canonicalHost = value => {
  const raw = clean(value);
  if (!raw) return "";
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return url.hostname.toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
  } catch {
    return "";
  }
};

export const organizationRoot = value => clean(value)
  .toLocaleLowerCase()
  .replace(/&/g, " and ")
  .replace(/[()[\]{}]/g, " ")
  .replace(/[^\p{L}\p{N}]+/gu, " ")
  .split(" ")
  .filter(word => word && !legalWords.has(word))
  .join("");

const domainSignals = record => [...new Set([
  canonicalHost(record?.domain),
  canonicalHost(record?.profile?.officialWebsite),
  canonicalHost(record?.officialWebsite),
  canonicalHost(record?.productUrl),
].filter(Boolean))];

const nameSignals = record => [...new Set([
  organizationRoot(record?.name),
  organizationRoot(record?.publisher),
  organizationRoot(record?.operator),
  organizationRoot(record?.legalName),
  organizationRoot(record?.profile?.operator),
  organizationRoot(record?.profile?.legalName),
].filter(value => value.length >= 4))];

const brandExtensions = [
  "cloud", "deepmind", "labs", "notebook", "research", "studio", "systems", "technologies",
];

const compatibleRoot = (left, right) => {
  if (left === right) return true;
  if (Math.min(left.length, right.length) < 5) return false;
  const [shorter, longer] = left.length <= right.length ? [left, right] : [right, left];
  if (!longer.startsWith(shorter)) return false;
  const extension = longer.slice(shorter.length);
  return brandExtensions.some(token => extension.startsWith(token));
};

export function sameCompany(left, right) {
  const leftDomains = domainSignals(left);
  const rightDomains = domainSignals(right);
  if (leftDomains.some(a => rightDomains.some(b => a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`)))) return true;
  const leftNames = nameSignals(left);
  const rightNames = nameSignals(right);
  return leftNames.some(a => rightNames.some(b => compatibleRoot(a, b)));
}

export const canonicalCompanyId = record => {
  const root = nameSignals(record)[0] || domainSignals(record)[0] || "company";
  return root.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "") || "company";
};

const canonicalUrl = value => {
  try {
    const url = new URL(String(value || ""));
    url.hash = "";
    url.search = "";
    return url.href.replace(/\/+$/, "");
  } catch {
    return String(value || "").replace(/[?#].*$/, "").replace(/\/+$/, "");
  }
};

const uniqueBy = (rows, keyOf) => {
  const seen = new Set();
  return rows.filter(row => {
    const key = keyOf(row);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const bestDepthRecord = records => [...records].sort((left, right) => {
  const depth = value => Number(value?.coverage?.organization?.executiveCount
    || value?.organization?.executiveTeam?.length || 0) * 10
    + Number(value?.coverage?.profile?.score || 0);
  return depth(right) - depth(left);
})[0] || {};

const latestOf = records => records.map(record => record.latest).filter(item => item?.url)
  .sort((left, right) => String(right.date || "").localeCompare(String(left.date || "")))[0] || null;

const mergeStartupRecords = (primary, records, section, canonicalName) => {
  const depth = bestDepthRecord(records);
  const institutional = records.filter(record => record.institution || record.cohorts?.length);
  const products = uniqueBy(institutional.map(record => ({
    name: record.name,
    domain: record.domain || "",
    publisher: record.publisher || "",
    cohorts: [...new Set(record.cohorts || [])],
    sourceLinks: record.sourceLinks || [],
  })), product => `${organizationRoot(product.name)}|${canonicalHost(product.domain)}`);
  const histories = uniqueBy(records.flatMap(record => [
    ...(record.history || []),
    ...(record.latest?.url ? [record.latest] : []),
  ]).filter(item => item?.url), item => canonicalUrl(item.url))
    .sort((left, right) => String(right.date || "").localeCompare(String(left.date || "")))
    .slice(0, 16);
  const sourceLinks = uniqueBy(records.flatMap(record => record.sourceLinks || [])
    .filter(source => source?.url), source => canonicalUrl(source.url));
  const matchedNames = [...new Set(records.map(record => clean(record.name)).filter(Boolean))];
  const latest = latestOf(records);
  return {
    ...primary,
    name: canonicalName,
    canonicalId: canonicalCompanyId({ ...primary, name: canonicalName }),
    displaySection: section,
    matchedNames,
    ...(depth.profile ? { profile: depth.profile } : {}),
    ...(depth.organization ? { organization: depth.organization } : {}),
    ...(depth.coverage ? { coverage: depth.coverage } : {}),
    ...(latest ? { latest } : {}),
    ...(histories.length ? { history: histories } : {}),
    ...(sourceLinks.length ? { sourceLinks } : {}),
    ...(institutional[0]?.institution ? { institution: institutional[0].institution } : {}),
    ...(products.length ? {
      a16z: {
        institution: institutional[0]?.institution || null,
        cohorts: [...new Set(products.flatMap(product => product.cohorts))],
        products,
        sourceLinks,
      },
    } : {}),
  };
};

const groupEntries = entries => {
  const groups = [];
  for (const entry of entries) {
    const matches = [];
    for (let index = 0; index < groups.length; index++) {
      if (groups[index].some(other => sameCompany(entry.record, other.record))) matches.push(index);
    }
    if (!matches.length) {
      groups.push([entry]);
      continue;
    }
    const target = matches.shift();
    groups[target].push(entry);
    for (const index of matches.reverse()) groups[target].push(...groups.splice(index, 1)[0]);
  }
  return groups;
};

const sectionRank = { tracked: 0, large: 1, small: 2, institutional: 3 };

export function canonicalizeStartupSnapshot(snapshot, trackedCompanies = []) {
  // A canonical snapshot is already the output, not another raw input.  This
  // guard keeps scheduled no-op runs idempotent and preserves tracked
  // portfolio references that were intentionally removed from display lists.
  if (snapshot?.schemaVersion === 3 && snapshot?.companyRegistry
    && !companyRegistryHasDuplicates(snapshot, trackedCompanies)) return snapshot;
  const inputs = [
    ...trackedCompanies.map(record => ({ section: "tracked", record })),
    ...(snapshot?.large || []).map(record => ({ section: "large", record })),
    ...(snapshot?.small || []).map(record => ({ section: "small", record })),
    ...(snapshot?.institutional || []).map(record => ({ section: "institutional", record })),
  ].filter(entry => clean(entry.record?.name));
  const groups = groupEntries(inputs);
  const output = { large: [], small: [], institutional: [] };
  const trackedReferences = [];
  let duplicateRecordsMerged = 0;

  for (const group of groups) {
    group.sort((left, right) => sectionRank[left.section] - sectionRank[right.section]);
    const tracked = group.find(entry => entry.section === "tracked");
    const startupEntries = group.filter(entry => entry.section !== "tracked");
    if (!startupEntries.length) continue;
    duplicateRecordsMerged += Math.max(0, startupEntries.length - (tracked ? 0 : 1));
    const primary = startupEntries[0];
    const canonicalName = tracked?.record?.name || primary.record.name;
    const merged = mergeStartupRecords(primary.record, startupEntries.map(entry => entry.record), primary.section, canonicalName);
    if (tracked) {
      trackedReferences.push({
        canonicalId: canonicalCompanyId(tracked.record),
        name: canonicalName,
        matchedNames: merged.matchedNames,
        sourceSections: [...new Set(startupEntries.map(entry => entry.section))],
        portfolioClass: primary.section,
        vertical: merged.vertical || "",
        category: merged.cat || "",
        institution: merged.institution || null,
        a16z: merged.a16z || null,
        startupSummary: {
          currentBusiness: merged.businessModel || merged.overview || merged.currentBusiness || "",
          revenueModel: merged.revenue || merged.revenueModel || "",
          strategyDirection: merged.partnership || merged.acqAngle || merged.strategyDirection || "",
        },
      });
      continue;
    }
    output[primary.section].push(merged);
  }

  for (const section of Object.keys(output)) {
    output[section].sort((left, right) => String(left.name).localeCompare(String(right.name)));
  }
  // A schema-v3 snapshot has already removed product aliases owned by tracked
  // companies from its visible arrays. If a later organization refresh
  // exposes a new duplicate and forces re-canonicalization, those historical
  // tracked references are not reconstructible from the visible rows alone.
  // Retain their full institutional/product evidence instead of silently
  // shrinking source coverage.
  for (const reference of snapshot?.companyRegistry?.trackedReferences || []) {
    const key = reference.canonicalId || canonicalCompanyId(reference);
    if (!key || trackedReferences.some(current =>
      (current.canonicalId || canonicalCompanyId(current)) === key)) continue;
    trackedReferences.push(reference);
  }
  const visible = [...output.large, ...output.small, ...output.institutional];
  const a16zCompanies = visible.filter(record => record.a16z || record.institution).length
    + trackedReferences.filter(record => record.a16z || record.institution).length;
  const visibleInputCount = (snapshot?.large || []).length + (snapshot?.small || []).length
    + (snapshot?.institutional || []).length;
  const rawStartupRecords = Math.max(visibleInputCount, Number(snapshot?.companyRegistry?.rawStartupRecords || 0));
  duplicateRecordsMerged += Math.max(0, Number(snapshot?.companyRegistry?.duplicateRecordsMerged || 0));
  return {
    ...snapshot,
    schemaVersion: 3,
    large: output.large,
    small: output.small,
    institutional: output.institutional,
    companyRegistry: {
      schemaVersion: 1,
      method: "official-domain+operator-legal-name+canonical-display-priority",
      priority: ["tracked", "large", "small", "institutional"],
      rawStartupRecords,
      uniqueDisplayedCompanies: visible.length,
      duplicateRecordsMerged,
      trackedReferences,
      a16zUniqueCompanies: a16zCompanies,
      generatedAt: snapshot?.generatedAt || new Date().toISOString(),
    },
    institutionalSource: {
      ...(snapshot?.institutionalSource || {}),
      uniqueCount: a16zCompanies,
      displayedInA16zOnly: output.institutional.length,
    },
  };
}

export function companyRegistryHasDuplicates(snapshot, trackedCompanies = []) {
  const rows = [
    ...trackedCompanies,
    ...(snapshot?.large || []),
    ...(snapshot?.small || []),
    ...(snapshot?.institutional || []),
  ];
  return rows.some((record, index) => rows.slice(index + 1).some(other => sameCompany(record, other)));
}
