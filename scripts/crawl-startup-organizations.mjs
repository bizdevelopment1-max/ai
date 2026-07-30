#!/usr/bin/env node
/**
 * Enriches every startup record with the same profile / organization /
 * executiveTeam schema used by the main company portfolio.
 *
 * Evidence policy:
 * - company identity must match the startup's official website domain;
 * - people are accepted only from an official-domain page or a Wikidata entity
 *   whose P856 official website matches that domain;
 * - education, employers and direct LinkedIn IDs come only from structured
 *   source claims;
 * - a sparse or unavailable refresh retains the last verified snapshot and
 *   never creates a person, role, school or employer with model inference.
 */
import { readFile, writeFile } from "node:fs/promises";

const DATA_FILE = "startups.json";
const UA = "AI-Strategy-Research/1.0 (+https://bizdevelopment1-max.github.io/ai/)";
const API = "https://www.wikidata.org/w/api.php";
const FORCE = /^(1|true|yes)$/i.test(String(process.env.STARTUP_ORG_REFRESH_FORCE || ""));
const MISSING_DEPTH_ONLY = /^(1|true|yes)$/i.test(String(process.env.STARTUP_ORG_MISSING_DEPTH_ONLY || ""));
const REFRESH_BUDGET = Math.max(1, Number(process.env.STARTUP_ORG_REFRESH_BUDGET || 36));
const MAX_AGE_DAYS = Math.max(1, Number(process.env.STARTUP_ORG_MAX_AGE_DAYS || 21));
const CONCURRENCY = Math.max(1, Math.min(10, Number(process.env.STARTUP_ORG_CONCURRENCY || 6)));
const MAX_EXECUTIVES = 12;
const NOW = new Date().toISOString();

const clean = value => String(value || "")
  .replace(/&nbsp;|&#160;/gi, " ")
  .replace(/&amp;/gi, "&")
  .replace(/&#0*39;|&apos;/gi, "'")
  .replace(/&quot;/gi, "\"")
  .replace(/\s+/g, " ")
  .trim();
const clip = (value, size = 420) => {
  const text = clean(value);
  return text.length > size ? `${text.slice(0, size - 1)}…` : text;
};
const validHttp = value => /^https?:\/\//i.test(String(value || ""));
const canonicalHost = value => {
  try { return new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`).hostname.toLowerCase().replace(/^www\./, ""); }
  catch { return ""; }
};
const sameDomain = (left, right) => {
  const a = canonicalHost(left);
  const b = canonicalHost(right);
  return !!a && !!b && (a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`));
};
const personKey = value => clean(value).toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
const ageDays = value => {
  const time = Date.parse(value || "");
  return Number.isFinite(time) ? Math.max(0, (Date.now() - time) / 86_400_000) : 999;
};
const pct = (present, total) => Math.round((present / Math.max(total, 1)) * 100);
const tierOf = role => {
  const value = clean(role);
  if (/founder|co-founder|chair|board/i.test(value)) return "founder-board";
  if (/chief executive|\bceo\b|president/i.test(value)) return "executive-lead";
  if (/\bC[A-Z]O\b|chief |general counsel/i.test(value)) return "c-suite";
  return "functional-executive";
};
const directLinkedIn = (value, type = "person") => {
  const raw = clean(value);
  if (!raw) return "";
  const expectedPath = type === "company" ? "company" : "in";
  const pathMatch = raw.match(/^https?:\/\/(?:(?:www|[a-z]{2})\.)?linkedin\.com\/(in|company)\/([^/?#]+)\/?$/i);
  if (pathMatch && pathMatch[1].toLowerCase() !== expectedPath) return "";
  const id = pathMatch?.[2] || raw.replace(/^https?:\/\/(?:(?:www|[a-z]{2})\.)?linkedin\.com\/(?:in|company)\//i, "").replace(/[/?#].*$/, "");
  if (!/^[A-Za-z0-9._%-]{2,100}$/.test(id) || /^(?:https?|www|company|linkedin)$/i.test(id)) return "";
  return `https://www.linkedin.com/${type === "company" ? "company" : "in"}/${id}`;
};
const recordKey = record => canonicalHost(record?.domain) || clean(record?.name).toLowerCase();
const sourceUrlForRecord = record => {
  const linked = (record?.sourceLinks || []).map(item => item.url).find(url => validHttp(url) && sameDomain(url, record?.domain));
  if (linked) return linked;
  const productWebsite = (record?.sourceLinks || []).map(item => item.url).find(url =>
    validHttp(url) && !/(?:a16z\.com|apps\.apple\.com|play\.google\.com)\//i.test(url));
  return productWebsite || (record?.domain ? `https://${record.domain}/` : "");
};
const businessOf = record => clean(
  record?.currentBusiness || record?.businessModel || record?.overview || record?.description || record?.pageTitle || record?.vertical,
);
const isPresent = value => {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === "object") return Object.keys(value).length > 0;
  return value !== undefined && value !== null && clean(value) !== "";
};
const mergePresent = (...objects) => objects.reduce((merged, object) => {
  for (const [key, value] of Object.entries(object || {})) {
    if (isPresent(value)) merged[key] = value;
  }
  return merged;
}, {});

async function fetchJson(url, timeout = 20_000) {
  let lastError = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const response = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(timeout),
    });
    if (response.ok) return response.json();
    lastError = new Error(`${response.status} ${url}`);
    if (response.status !== 429 && response.status < 500) throw lastError;
    const advertised = Number(response.headers.get("retry-after") || 0) * 1_000;
    const waitMs = Math.min(12_000, Math.max(advertised, 1_200 * (attempt + 1)));
    await new Promise(resolve => setTimeout(resolve, waitMs));
  }
  throw lastError || new Error(`Wikidata request failed: ${url}`);
}

async function mapConcurrent(items, concurrency, fn) {
  const output = new Array(items.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < items.length) {
      const index = cursor++;
      try { output[index] = await fn(items[index], index); }
      catch (error) { output[index] = { error: error.message }; }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return output;
}

async function searchWikidata(record) {
  const query = encodeURIComponent(clean(record.publisher || record.name));
  const url = `${API}?action=wbsearchentities&search=${query}&language=en&uselang=en&limit=5&format=json&origin=*`;
  const result = await fetchJson(url);
  return (result.search || []).map(item => item.id).filter(Boolean);
}

async function marketplaceOfficialUrl(record) {
  const direct = sourceUrlForRecord(record);
  if (direct) return direct;
  const apple = (record?.sourceLinks || []).map(item => item.url)
    .find(url => /apps\.apple\.com\/.+\/id\d+/i.test(String(url || "")));
  const appId = String(apple || "").match(/\/id(\d+)/i)?.[1];
  if (!appId) return "";
  try {
    const country = String(apple).match(/apps\.apple\.com\/([a-z]{2})\//i)?.[1] || "us";
    const lookup = await fetchJson(`https://itunes.apple.com/lookup?id=${appId}&country=${country}`);
    const sellerUrl = clean(lookup?.results?.[0]?.sellerUrl);
    return validHttp(sellerUrl) ? sellerUrl : "";
  } catch {
    return "";
  }
}

async function getEntities(ids) {
  const unique = [...new Set(ids)].filter(Boolean);
  const entities = {};
  for (let start = 0; start < unique.length; start += 25) {
    const batch = unique.slice(start, start + 25);
    const url = `${API}?action=wbgetentities&ids=${batch.join("|")}&props=claims|labels|descriptions|info&languages=en|ko|fr|de|es|it&languagefallback=1&format=json&origin=*`;
    try {
      const result = await fetchJson(url, 25_000);
      Object.assign(entities, result.entities || {});
    } catch (error) {
      console.warn(`[startup-org] structured source batch skipped: ${error.message.split(" ")[0]}`);
    }
  }
  return entities;
}

const claims = (entity, property) => (entity?.claims?.[property] || [])
  .filter(claim => claim?.mainsnak?.snaktype === "value" && claim.mainsnak.datavalue);
const claimValues = (entity, property) => claims(entity, property).map(claim => claim.mainsnak.datavalue.value);
const entityIds = (entity, property) => claimValues(entity, property).map(value => value?.id).filter(Boolean);
const stringValues = (entity, property) => claimValues(entity, property).map(value => clean(value)).filter(Boolean);
const labelOf = entity => clean(
  entity?.labels?.en?.value
  || entity?.labels?.ko?.value
  || Object.values(entity?.labels || {})[0]?.value
  || "",
);
const timeValue = value => {
  const match = clean(value?.time).match(/^([+-]?\d{4,})-(\d{2})-(\d{2})/);
  if (!match) return "";
  const [, year, month, day] = match;
  if (month === "00") return year.replace(/^\+/, "");
  if (day === "00") return `${year.replace(/^\+/, "")}-${month}`;
  return `${year.replace(/^\+/, "")}-${month}-${day}`;
};
const quantityValue = value => {
  const amount = Number(String(value?.amount || "").replace("+", ""));
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount).toLocaleString("en-US") : "";
};
const pointInTime = claim => {
  const value = claim?.qualifiers?.P585?.[0]?.datavalue?.value;
  return timeValue(value);
};
const latestQuantity = (entity, property) => claims(entity, property)
  .map(claim => ({ value: quantityValue(claim.mainsnak.datavalue.value), asOf: pointInTime(claim) }))
  .filter(item => item.value)
  .sort((a, b) => String(b.asOf).localeCompare(String(a.asOf)))[0] || null;
const officialWebsites = entity => stringValues(entity, "P856").filter(validHttp);
const matchingEntity = (record, ids, entityMap) => ids.map(id => entityMap[id]).find(entity =>
  officialWebsites(entity).some(url => sameDomain(url, record.domain)));

const decodeHtml = html => clean(String(html || "")
  .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
  .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]+>/g, " "));
const extractTitle = html => clean((String(html).match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]);
const extractDescription = html => clean((
  String(html).match(/<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([^"']+)["']/i)
  || String(html).match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["'](?:description|og:description)["']/i)
  || [])[1]);

async function fetchOfficialPage(url) {
  if (!validHttp(url)) return null;
  try {
    const direct = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
    });
    let response = direct;
    let retrievalVia = "direct";
    if (!direct.ok && [403, 429].includes(direct.status)) {
      const target = new URL(url);
      const reader = await fetch(`https://r.jina.ai/http://${target.host}${target.pathname}${target.search}`, {
        headers: { "User-Agent": UA, Accept: "text/plain" },
        signal: AbortSignal.timeout(20_000),
      });
      if (reader.ok) {
        response = reader;
        retrievalVia = "jina-reader";
      }
    }
    if (!response.ok) return null;
    const raw = await response.text();
    if (raw.length < 300) return null;
    const markdown = retrievalVia === "jina-reader";
    return {
      url,
      resolvedUrl: direct.url || url,
      checkedAt: NOW,
      lastModified: direct.headers.get("last-modified") || "",
      retrievalVia,
      title: markdown ? clean((raw.match(/^Title:\s*(.+)$/mi) || [])[1]) : extractTitle(raw),
      description: markdown ? "" : extractDescription(raw),
      text: markdown ? clean(raw) : decodeHtml(raw),
      html: markdown ? "" : raw,
    };
  } catch {
    return null;
  }
}

function relevantOfficialLinks(page, domain) {
  if (!page?.html) return [];
  const rows = [];
  const seen = new Set();
  const re = /<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of page.html.matchAll(re)) {
    const label = decodeHtml(match[2]);
    let url;
    try { url = new URL(match[1], page.resolvedUrl || page.url).href; } catch { continue; }
    if (!sameDomain(url, domain)) continue;
    const pathname = new URL(url).pathname;
    if (!/(?:\/|^)(?:about(?:-us)?|company|team|leadership|management|who-we-are|our-story)(?:\/|$)/i.test(pathname)) continue;
    if (/(?:blog|news|resource|customer|case-stud|use-case|press|event)/i.test(pathname)) continue;
    url = url.replace(/#.*$/, "");
    if (seen.has(url)) continue;
    seen.add(url);
    rows.push(url);
  }
  return rows.slice(0, 2);
}

function jsonLdObjects(html) {
  const rows = [];
  for (const match of String(html || "").matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(match[1].replace(/^\s*<!--|-->\s*$/g, ""));
      const visit = value => {
        if (Array.isArray(value)) return value.forEach(visit);
        if (!value || typeof value !== "object") return;
        rows.push(value);
        if (value["@graph"]) visit(value["@graph"]);
      };
      visit(parsed);
    } catch {}
  }
  return rows;
}

const typesOf = value => (Array.isArray(value?.["@type"]) ? value["@type"] : [value?.["@type"]]).map(clean);
const sameAsValues = value => (Array.isArray(value?.sameAs) ? value.sameAs : [value?.sameAs]).map(clean).filter(validHttp);
const nameFrom = value => clean(typeof value === "string" ? value : value?.name);
const addressFrom = value => {
  if (!value) return "";
  if (typeof value === "string") return clean(value);
  return [value.addressLocality, value.addressRegion, value.addressCountry].map(nameFrom).filter(Boolean).join(", ");
};
const employeesFrom = value => {
  const employee = value?.numberOfEmployees;
  if (Number.isFinite(Number(employee))) return Number(employee).toLocaleString("en-US");
  const amount = employee?.value || employee?.maxValue || employee?.minValue;
  return Number.isFinite(Number(amount)) ? Number(amount).toLocaleString("en-US") : "";
};
const rolePattern = "(?:Founder(?:\\s*&\\s*CEO)?|Co-Founder(?:\\s*(?:,|&|and)\\s*(?:CEO|CTO|CPO|COO|Design|Engineering))?|Chief\\s+(?:Executive|Technology|Product|Operating|Financial|Revenue|Marketing|Scientific|AI)\\s+Officer|CEO|CTO|CPO|COO|CFO|President|Chair(?:man|woman|person)?|VP\\s+(?:Engineering|Product|AI|Research))";
const namePattern = "[A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ'’.-]+(?:\\s+[A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ'’.-]+){1,4}";
const personNameStopWords = /^(?:CEO|CTO|CPO|COO|CFO|CMO|CRO|CSO|MD|PhD|Founder|Director|Manager|Individual|Admin|President|Chair|Chief|Officer|Leadership|Executive|Team)$/i;
const plausiblePerson = name => {
  const value = clean(name);
  if (!new RegExp(`^${namePattern}$`).test(value)) return false;
  const words = value.split(/\s+/);
  if (words.length > 4
    || words.some(word => word.length > 1 && word === word.toUpperCase())
    || /[.:]|\bCo-?$|\b(?:Our|We|AI|Founder|Co-Founder|Engineering|Product|Design|Customer|Success|Investors?|Advisory|Board|Model|Privacy|Education|Systems|Security|Secureworks|Former|Previously|Company|Pitch|Hiring|Partner|Member|Vice)\b/i.test(value)) return false;
  if (words.some(word => personNameStopWords.test(word.replace(/[.,]/g, "")))) return false;
  return !/Our Team|The Team|About Us|Leadership Team|Executive Team|Chief Executive Officer/i.test(value);
};
const trustedLeadershipPath = value => {
  try {
    const pathname = new URL(value).pathname;
    return /(?:\/|^)(?:about(?:-us)?|company|team|leadership|management|who-we-are|our-story)(?:\/|$)/i.test(pathname)
      && !/(?:blog|news|resource|customer|case-stud|use-case|press|event)/i.test(pathname);
  } catch {
    return false;
  }
};
const reliableExtractedPerson = person => person?.sourceType !== "official-page-extraction"
  || (trustedLeadershipPath(person.verificationUrl) && plausiblePerson(person.name) && plausibleRole(person.role));
const normalizedRole = role => clean(role)
  .replace(/\bChief Executive Officer\b/i, "CEO")
  .replace(/\bChief Technology Officer\b/i, "CTO")
  .replace(/\bChief Product Officer\b/i, "CPO")
  .replace(/\bChief Operating Officer\b/i, "COO")
  .replace(/\bChief Financial Officer\b/i, "CFO")
  .replace(/\bCEO\s*(?:,|&|and)\s*(Co-?Founder|Founder)\b/i, "$1 · CEO")
  .replace(/\b(Co-?Founder|Founder)\s*(?:,|&|and)\s*CEO\b/i, "$1 · CEO");
const plausibleRole = role => {
  const value = normalizedRole(role);
  if (!value || value.length > 100 || /[{};]|\/\*|\*\//.test(value)) return false;
  return new RegExp(`^(?:${rolePattern})(?:\\s*(?:,|·|&|and|/)\\s*(?:${rolePattern}))*$`, "i").test(value);
};

function peopleFromOfficialPage(page) {
  const people = [];
  const push = (name, role, extra = {}) => {
    const personName = clean(name).replace(/,?\s+(?:MD|PhD|MBA|JD)\.?$/i, "");
    const personRole = normalizedRole(role);
    if (!plausiblePerson(personName) || !plausibleRole(personRole)) return;
    people.push({
      name: personName,
      role: personRole,
      tier: tierOf(personRole),
      sourceType: "official-page-extraction",
      verification: "official-role-match",
      verificationUrl: page.resolvedUrl || page.url,
      verifiedAt: page.checkedAt,
      ...extra,
    });
  };
  for (const object of jsonLdObjects(page.html)) {
    if (!typesOf(object).some(type => /person/i.test(type))) continue;
    const linkedIn = sameAsValues(object).find(url => /linkedin\.com\/in\//i.test(url));
    const directProfile = directLinkedIn(linkedIn);
    push(object.name, object.jobTitle || object.roleName, {
      li: directProfile,
      linkedinVerification: directProfile ? "official-jsonld-direct-profile" : "",
      edu: [object.alumniOf].flat().map(nameFrom).filter(Boolean).join(" · "),
      sourceType: "official-jsonld",
    });
  }
  if (!trustedLeadershipPath(page.resolvedUrl || page.url)) return people.slice(0, MAX_EXECUTIVES);
  for (const match of String(page.html || "").matchAll(/"name"\s*:\s*"([^"\\]{3,80})"[\s\S]{0,280}?"(?:position|jobTitle|role)"\s*:\s*"([^"\\]{2,120})"/gi)) {
    push(match[1], match[2]);
  }
  for (const match of String(page.html || "").matchAll(new RegExp(
    `>\\s*(${namePattern})(?:,?\\s+(?:MD|PhD|MBA|JD)\\.?)?\\s*<\\/[^>]+>\\s*<[^>]+>\\s*([^<]{0,100}(?:${rolePattern})[^<]{0,100})\\s*<\\/`,
    "gi",
  ))) {
    push(decodeHtml(match[1]), decodeHtml(match[2]));
  }
  for (const match of page.text.matchAll(new RegExp(`\\b(${namePattern})\\s*(?:,|\\||-|–|—)?\\s*(${rolePattern})\\b`, "gi"))) {
    push(match[1], match[2]);
  }
  for (const match of page.text.matchAll(new RegExp(`\\b(${rolePattern})\\s*(?::|,|-|–|—)?\\s*(${namePattern})\\b`, "gi"))) {
    push(match[2], match[1]);
  }
  const seen = new Set();
  return people.filter(person => {
    const key = personKey(person.name);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, MAX_EXECUTIVES);
}

function officialStructuredProfile(pages) {
  const profile = {};
  const leadership = [];
  let mission = "";
  let companyLinkedIn = "";
  for (const page of pages) {
    if (!mission) mission = clip(page.description, 360);
    for (const object of jsonLdObjects(page.html)) {
      const isOrg = typesOf(object).some(type => /organization|corporation|business/i.test(type));
      if (!isOrg) continue;
      profile.legalName ||= clean(object.legalName || object.name);
      profile.founded ||= clean(object.foundingDate);
      profile.hq ||= addressFrom(object.address || object.location);
      profile.headcount ||= employeesFrom(object);
      const officialWebsite = clean(object.url);
      if (validHttp(officialWebsite) && sameDomain(officialWebsite, page.url)) profile.officialWebsite ||= officialWebsite;
      mission ||= clip(object.description, 360);
      const founders = [object.founder, object.founders].flat().filter(Boolean);
      founders.forEach(founder => {
        const linkedIn = sameAsValues(founder).find(url => /linkedin\.com\/in\//i.test(url));
        const directProfile = directLinkedIn(linkedIn);
        const name = nameFrom(founder);
        if (name) leadership.push({
          name,
          role: "Founder",
          tier: "founder-board",
          li: directProfile,
          linkedinVerification: directProfile ? "official-jsonld-direct-profile" : "",
          sourceType: "official-jsonld",
          verification: "official-role-match",
          verificationUrl: page.resolvedUrl || page.url,
          verifiedAt: page.checkedAt,
        });
      });
      const linkedIn = sameAsValues(object).find(url => /linkedin\.com\/company\//i.test(url));
      if (linkedIn) companyLinkedIn = directLinkedIn(linkedIn, "company");
    }
    leadership.push(...peopleFromOfficialPage(page));
    if (!companyLinkedIn) {
      const linkedIn = String(page.html || "").match(/https:\/\/(?:(?:www|[a-z]{2})\.)?linkedin\.com\/company\/[A-Za-z0-9._%-]+\/?/i)?.[0];
      companyLinkedIn = directLinkedIn(linkedIn, "company");
    }
  }
  return { profile, leadership, mission, companyLinkedIn };
}

function mergePeople(...groups) {
  const rows = new Map();
  for (const person of groups.flat()) {
    const key = personKey(person?.name);
    if (!key) continue;
    const current = rows.get(key) || {};
    const officialWins = /official/.test(person.verification || "") || /official/.test(person.sourceType || "");
    rows.set(key, officialWins ? { ...current, ...person } : { ...person, ...current });
  }
  const merged = [...rows.values()]
    .filter(person => clean(person.name) && clean(person.role) && !/^Q\d+$/i.test(clean(person.name)))
    .map(person => ({ ...person, tier: person.tier || tierOf(person.role) }))
    .sort((a, b) => {
      const rank = { "founder-board": 0, "executive-lead": 1, "c-suite": 2, "functional-executive": 3 };
      return (rank[a.tier] ?? 9) - (rank[b.tier] ?? 9) || a.name.localeCompare(b.name);
    });
  const deduped = [];
  const sourceRank = value => ({ "official-page-extraction": 3, "official-jsonld": 2, "wikidata-domain-match": 1 }[value] || 0);
  for (const person of merged) {
    const words = clean(person.name).split(/\s+/);
    const first = personKey(words[0]);
    const last = personKey(words.at(-1));
    const nearIndex = deduped.findIndex(other => {
      const otherWords = clean(other.name).split(/\s+/);
      const otherFirst = personKey(otherWords[0]);
      const otherLast = personKey(otherWords.at(-1));
      const firstOverlap = first.length >= 4 && otherFirst.length >= 4
        && Math.abs(first.length - otherFirst.length) <= 3
        && (first.startsWith(otherFirst) || otherFirst.startsWith(first));
      const founderOverlap = /founder/i.test(person.role) && /founder/i.test(other.role);
      return last && last === otherLast && firstOverlap && founderOverlap;
    });
    if (nearIndex < 0) {
      deduped.push(person);
      continue;
    }
    const current = deduped[nearIndex];
    const preferred = sourceRank(person.sourceType) >= sourceRank(current.sourceType) ? person : current;
    const fallback = preferred === person ? current : person;
    deduped[nearIndex] = mergePresent(fallback, preferred, {
      role: /\bCEO\b|chief executive/i.test(person.role) ? person.role : current.role,
      tier: tierOf(/\bCEO\b|chief executive/i.test(person.role) ? person.role : current.role),
    });
  }
  return deduped.slice(0, MAX_EXECUTIVES);
}

function wikidataProfile(record, entity, entityMap) {
  if (!entity) return { profile: {}, leadership: [], mission: "", officialPages: [] };
  const founderIds = entityIds(entity, "P112");
  const ceoIds = entityIds(entity, "P169");
  const hqIds = entityIds(entity, "P159");
  const peopleIds = [...new Set([...founderIds, ...ceoIds])];
  const employee = latestQuantity(entity, "P1128");
  const founding = claimValues(entity, "P571").map(timeValue).filter(Boolean)[0] || "";
  const websites = officialWebsites(entity);
  const leadership = peopleIds.map(id => {
    const person = entityMap[id];
    if (!person) return null;
    const founder = founderIds.includes(id);
    const ceo = ceoIds.includes(id);
    const education = entityIds(person, "P69").map(ref => labelOf(entityMap[ref])).filter(Boolean);
    const employers = entityIds(person, "P108").map(ref => labelOf(entityMap[ref])).filter(Boolean);
    const linkedInId = stringValues(person, "P6634")[0] || "";
    const directProfile = directLinkedIn(linkedInId);
    const role = founder && ceo ? "Founder · CEO" : founder ? "Founder" : "CEO";
    return {
      name: labelOf(person),
      role,
      tier: tierOf(role),
      edu: education.slice(0, 4).join(" · "),
      career: employers.slice(0, 4).join(" · "),
      li: directProfile,
      linkedinVerification: directProfile ? "wikidata-property-direct-profile" : "",
      sourceType: "wikidata-domain-match",
      verification: "knowledge-graph-domain-match",
      verificationUrl: `https://www.wikidata.org/wiki/${id}`,
      verifiedAt: NOW,
      sourceModifiedAt: person.modified || "",
    };
  }).filter(Boolean);
  const companyLinkedInId = stringValues(entity, "P4264")[0] || "";
  const profile = {
    legalName: labelOf(entity),
    founded: founding,
    ceo: leadership.find(person => /\bCEO\b/i.test(person.role))?.name || "",
    hq: hqIds.map(id => labelOf(entityMap[id])).filter(Boolean).join(" · "),
    headcount: employee?.value || "",
    headcountAsOf: employee?.asOf || "",
    officialWebsite: websites.find(url => sameDomain(url, record.domain)) || websites[0] || sourceUrlForRecord(record),
    linkedin: directLinkedIn(companyLinkedInId, "company"),
    sourceAsOf: NOW.slice(0, 10),
  };
  return {
    profile,
    leadership,
    mission: clip(entity.descriptions?.en?.value, 360),
    officialPages: [{
      category: "structured-company-identity",
      title: "Wikidata company entity",
      url: `https://www.wikidata.org/wiki/${entity.id}`,
      status: "domain-matched",
      checkedAt: NOW,
      sourceModifiedAt: entity.modified || "",
    }],
  };
}

function retainedSnapshot(record) {
  return {
    profile: record.profile || {},
    organization: record.organization || {},
    coverage: record.coverage || {},
  };
}

function normalizeStoredDepth(record) {
  const organization = record.organization || {};
  const storedPeople = (organization.executiveTeam || organization.leadership || []).filter(reliableExtractedPerson);
  const executiveTeam = mergePeople(storedPeople).map(person => {
    const li = directLinkedIn(person.li);
    const normalized = { ...person };
    const verified = /^(curated-direct-profile|official-jsonld-direct-profile|wikidata-property-direct-profile)$/.test(person.linkedinVerification || "")
      || (li && person.verification === "knowledge-graph-domain-match")
      || (li && person.verification === "official-role-match" && /official-(?:jsonld|page-extraction)/.test(person.sourceType || ""));
    if (li && verified) {
      normalized.li = li;
      normalized.linkedinVerification ||= person.verification === "knowledge-graph-domain-match"
        ? "wikidata-property-direct-profile" : "official-jsonld-direct-profile";
    } else {
      delete normalized.li;
      delete normalized.linkedinVerification;
    }
    return normalized;
  });
  const verifiedExecutiveCount = executiveTeam.filter(person =>
    person.verification === "official-role-match" || person.verification === "knowledge-graph-domain-match").length;
  const directLinkedInCount = executiveTeam.filter(person => person.li && person.linkedinVerification).length;
  const profile = {
    ...(record.profile || {}),
    legalName: record.profile?.legalName || record.publisher || record.name || "",
    operator: record.profile?.operator || record.publisher || "",
    business: Array.isArray(record.profile?.business) && record.profile.business.length
      ? record.profile.business : [businessOf(record)].filter(Boolean),
  };
  return {
    ...record,
    profile,
    organization: {
      ...organization,
      leadership: executiveTeam,
      executiveTeam,
      officialPages: Array.isArray(organization.officialPages) ? organization.officialPages : [],
    },
    coverage: {
      ...(record.coverage || {}),
      profile: record.coverage?.profile || { present: 1, total: 7, score: 14 },
      organization: {
        ...(record.coverage?.organization || {}),
        executiveCount: executiveTeam.length,
        verifiedExecutiveCount,
        directLinkedInCount,
      },
    },
  };
}

function buildEnrichment(record, wikidata, officialPages, officialSeed = "") {
  const prior = retainedSnapshot(record);
  const official = officialStructuredProfile(officialPages);
  const leadership = mergePeople(
    wikidata.leadership || [],
    prior.organization?.leadership || [],
    official.leadership || [],
  );
  const profile = {
    ...mergePresent(prior.profile, wikidata.profile, official.profile),
    business: [businessOf(record), ...((prior.profile?.business || []).filter(Boolean))]
      .filter((value, index, rows) => value && rows.indexOf(value) === index)
      .slice(0, 5),
  };
  profile.ceo = leadership.find(person => /\bCEO\b|chief executive/i.test(person.role))?.name || profile.ceo || "";
  profile.officialWebsite ||= officialPages[0]?.resolvedUrl || officialPages[0]?.url || officialSeed || sourceUrlForRecord(record);
  profile.linkedin = official.companyLinkedIn || profile.linkedin || "";
  const hasFreshEvidence = officialPages.length > 0 || (wikidata.officialPages || []).length > 0 || validHttp(officialSeed);
  profile.sourceAsOf = hasFreshEvidence ? NOW.slice(0, 10) : profile.sourceAsOf || "";
  profile.sourceUrls = [...new Set([
    ...(prior.profile?.sourceUrls || []),
    ...(wikidata.officialPages || []).map(page => page.url),
    ...officialPages.map(page => page.resolvedUrl || page.url),
    officialSeed,
    ...(record.sourceLinks || []).map(item => item.url),
  ].filter(validHttp))].slice(0, 8);

  const executiveTeam = mergePeople(leadership);
  const officialMatched = executiveTeam.filter(person => person.verification === "official-role-match").length;
  const directProfiles = executiveTeam.filter(person => directLinkedIn(person.li) && person.linkedinVerification).length;
  const organization = {
    ...(prior.organization || {}),
    mission: official.mission || wikidata.mission || prior.organization?.mission || "",
    leadership,
    executiveTeam,
    officialPages: [
      ...(prior.organization?.officialPages || []),
      ...(wikidata.officialPages || []),
      ...(officialSeed && !officialPages.length ? [{
        category: "marketplace-publisher-website",
        title: "Marketplace-linked publisher website",
        url: officialSeed,
        status: "publisher-linked",
        checkedAt: NOW,
      }] : []),
      ...officialPages.map(page => ({
        category: /about|company|team|leadership/i.test(page.resolvedUrl || page.url) ? "company-leadership" : "company-home",
        title: page.title,
        url: page.resolvedUrl || page.url,
        status: "reachable",
        checkedAt: page.checkedAt,
        lastModified: page.lastModified,
        retrievalVia: page.retrievalVia,
      })),
    ].filter((page, index, rows) => page.url && rows.findIndex(other => other.url === page.url) === index).slice(0, 8),
    sourceMode: "official-domain+wikidata-domain-match+retained-verified-snapshot",
    updatedAt: hasFreshEvidence ? NOW : prior.organization?.updatedAt || "",
  };
  const profileChecks = [
    profile.legalName, profile.founded, profile.ceo, profile.hq,
    profile.headcount, profile.business.length, profile.officialWebsite,
  ];
  const orgChecks = [
    organization.mission,
    executiveTeam.some(person => /founder|co-founder/i.test(person.role)),
    executiveTeam.some(person => /\bCEO\b|chief executive/i.test(person.role)),
    executiveTeam.some(person => /\bCTO\b|chief technology/i.test(person.role)),
    executiveTeam.length >= 3,
    directProfiles >= 1,
  ];
  const coverage = {
    profile: {
      present: profileChecks.filter(Boolean).length,
      total: profileChecks.length,
      score: pct(profileChecks.filter(Boolean).length, profileChecks.length),
    },
    organization: {
      present: orgChecks.filter(Boolean).length,
      total: orgChecks.length,
      score: pct(orgChecks.filter(Boolean).length, orgChecks.length),
      executiveCount: executiveTeam.length,
      verifiedExecutiveCount: officialMatched,
      directLinkedInCount: directProfiles,
      officialSourceStatus: officialPages.length ? "official-source-reachable"
        : wikidata.officialPages?.length ? "knowledge-graph-domain-match"
          : officialSeed ? "marketplace-publisher-linked" : "retained-snapshot",
    },
    sourceMode: "official-domain+structured-knowledge-graph",
    checkedAt: NOW,
  };
  return { profile, organization, coverage };
}

async function main() {
  const data = JSON.parse(await readFile(DATA_FILE, "utf8"));
  const allRecords = [...(data.large || []), ...(data.small || []), ...(data.institutional || [])];
  const unique = new Map();
  for (const record of allRecords) {
    const key = recordKey(record);
    if (!key) continue;
    const current = unique.get(key);
    if (!current || (record.profile?.business || []).length > (current.profile?.business || []).length) unique.set(key, record);
  }
  const candidates = [...unique.values()]
    .filter(record => MISSING_DEPTH_ONLY
      ? Number(record.coverage?.organization?.executiveCount || 0) === 0
      : FORCE || !record.coverage?.checkedAt || ageDays(record.coverage.checkedAt) >= MAX_AGE_DAYS)
    .sort((a, b) => {
      const aDepth = Number(a.coverage?.organization?.executiveCount || 0);
      const bDepth = Number(b.coverage?.organization?.executiveCount || 0);
      return aDepth - bDepth || ageDays(b.coverage?.checkedAt) - ageDays(a.coverage?.checkedAt) || a.name.localeCompare(b.name);
    })
    .slice(0, FORCE || MISSING_DEPTH_ONLY ? unique.size : REFRESH_BUDGET);

  console.log(`[startup-org] refreshing ${candidates.length}/${unique.size} unique startup domains`);
  const officialSeeds = await mapConcurrent(candidates, Math.min(5, CONCURRENCY), marketplaceOfficialUrl);
  const effectiveCandidates = candidates.map((record, index) => {
    const officialSeed = typeof officialSeeds[index] === "string" ? officialSeeds[index] : "";
    return officialSeed && !record.domain
      ? { ...record, domain: canonicalHost(officialSeed), resolvedOfficialWebsite: officialSeed }
      : { ...record, resolvedOfficialWebsite: officialSeed || sourceUrlForRecord(record) };
  });
  const searchRows = await mapConcurrent(effectiveCandidates, Math.min(3, CONCURRENCY), searchWikidata);
  const candidateIds = searchRows.flatMap(row => Array.isArray(row) ? row : []);
  const candidateEntities = await getEntities(candidateIds);
  const companyMatches = new Map();
  candidates.forEach((record, index) => {
    const ids = Array.isArray(searchRows[index]) ? searchRows[index] : [];
    const entity = matchingEntity(effectiveCandidates[index], ids, candidateEntities);
    if (entity) companyMatches.set(recordKey(record), entity);
  });

  const relatedIds = [];
  for (const entity of companyMatches.values()) {
    relatedIds.push(...entityIds(entity, "P112"), ...entityIds(entity, "P169"), ...entityIds(entity, "P159"));
  }
  const firstRelated = await getEntities(relatedIds);
  const backgroundIds = [];
  for (const entity of Object.values(firstRelated)) {
    backgroundIds.push(...entityIds(entity, "P69"), ...entityIds(entity, "P108"));
  }
  const secondRelated = await getEntities(backgroundIds);
  const entityMap = { ...candidateEntities, ...firstRelated, ...secondRelated };

  const enrichments = new Map();
  await mapConcurrent(candidates, CONCURRENCY, async (record, index) => {
    const effectiveRecord = effectiveCandidates[index];
    const homeUrl = effectiveRecord.resolvedOfficialWebsite || sourceUrlForRecord(effectiveRecord);
    const home = await fetchOfficialPage(homeUrl);
    const pages = home ? [home] : [];
    const relevant = home ? relevantOfficialLinks(home, effectiveRecord.domain) : [];
    if (!relevant.length && effectiveRecord.domain) {
      try { relevant.push(new URL("/about", homeUrl || `https://${effectiveRecord.domain}/`).href); } catch {}
    }
    for (const url of relevant.slice(0, 2)) {
      if (pages.some(page => page.resolvedUrl === url || page.url === url)) continue;
      const page = await fetchOfficialPage(url);
      if (page) pages.push(page);
    }
    const entity = companyMatches.get(recordKey(record));
    const wiki = wikidataProfile(effectiveRecord, entity, entityMap);
    enrichments.set(recordKey(record), buildEnrichment(record, wiki, pages, effectiveRecord.resolvedOfficialWebsite || ""));
  });

  const apply = rows => (rows || []).map(record => {
    const enrichment = enrichments.get(recordKey(record));
    return normalizeStoredDepth(enrichment ? { ...record, ...enrichment } : record);
  });
  data.large = apply(data.large);
  data.small = apply(data.small);
  data.institutional = apply(data.institutional);
  const refreshedUnique = new Map();
  for (const record of [...data.large, ...data.small, ...data.institutional]) {
    const key = recordKey(record);
    const current = refreshedUnique.get(key);
    if (!current || (record.organization?.executiveTeam || []).length > (current.organization?.executiveTeam || []).length) {
      refreshedUnique.set(key, record);
    }
  }
  const refreshedRows = [...refreshedUnique.values()];
  data.generatedAt = NOW;
  data.organizationMethodology = "official-domain-jsonld-and-team-pages+wikidata-P856-domain-match+retained-verified-snapshot";
  data.organizationRefresh = {
    checkedAt: NOW,
    refreshed: candidates.length,
    uniqueCompanies: unique.size,
    officialPages: refreshedRows.reduce((sum, item) => sum + (item.organization?.officialPages || []).filter(page => page.status === "reachable").length, 0),
    executiveProfiles: refreshedRows.reduce((sum, item) => sum + Number(item.coverage?.organization?.executiveCount || 0), 0),
    directLinkedInProfiles: refreshedRows.reduce((sum, item) => sum + Number(item.coverage?.organization?.directLinkedInCount || 0), 0),
  };
  await writeFile(DATA_FILE, `${JSON.stringify(data)}\n`);
  console.log(`[startup-org] wrote ${candidates.length} refreshed companies · ${data.organizationRefresh.executiveProfiles} executive nodes · ${data.organizationRefresh.directLinkedInProfiles} direct LinkedIn profiles`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
