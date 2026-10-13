// Officially confirmed leadership changes for tracked companies.
//
// Rosters are carried forward from the cumulative company ledger, so a role
// that changed after it was first curated would otherwise stay on the site
// indefinitely. config/leadership-changes.json records only changes backed by
// an official announcement or established reporting, and every refresh
// applies them once their effective date has passed.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export const LEADERSHIP_CHANGES_FILE = "config/leadership-changes.json";

const personKey = value => String(value || "").normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
const isDay = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));

export function loadLeadershipChanges({ root = process.cwd(), today = new Date().toISOString().slice(0, 10) } = {}) {
  let source = {};
  try { source = JSON.parse(readFileSync(resolve(root, LEADERSHIP_CHANGES_FILE), "utf8")); } catch {}
  const byCompany = new Map();
  for (const change of source.changes || []) {
    const sources = (change.sources || []).filter(item => /^https?:\/\//.test(String(item.url || "")));
    if (!change.company || !isDay(change.effectiveFrom) || change.effectiveFrom > today || !sources.length) continue;
    if (!byCompany.has(change.company)) byCompany.set(change.company, []);
    byCompany.get(change.company).push({ ...change, sources });
  }
  for (const list of byCompany.values()) list.sort((left, right) => left.effectiveFrom.localeCompare(right.effectiveFrom));

  // Applies changes in effective-date order: a departed person leaves the
  // roster, and a changed or new role carries the type of its primary source
  // (an official announcement or established press reporting) and loses any
  // verification that was earned for the previous role.
  const applyRoster = (company, roster = []) => {
    const changes = byCompany.get(company) || [];
    if (!changes.length) return roster;
    const rows = roster.map(person => ({ ...person }));
    for (const change of changes) {
      const [primary] = change.sources;
      for (const person of change.people || []) {
        const index = rows.findIndex(row => personKey(row.name) === personKey(person.name));
        if (person.status === "departed") {
          if (index >= 0) rows.splice(index, 1);
          continue;
        }
        if (!person.role) continue;
        const current = index >= 0 ? rows[index] : { name: person.name };
        const roleChanged = personKey(current.role) !== personKey(person.role);
        const updated = {
          ...current,
          name: person.name,
          role: person.role,
          roleSourceType: primary.tier === "official" ? "official-announcement" : "press-report",
          roleSourceUrl: primary.url,
          roleEffectiveFrom: change.effectiveFrom,
          ...(roleChanged || index < 0 ? { verification: "unverified", verificationUrl: primary.url, verifiedAt: "" } : {}),
        };
        if (index >= 0) rows[index] = updated;
        else rows.push(updated);
      }
    }
    return rows;
  };

  const profileCeo = company => {
    const changes = byCompany.get(company) || [];
    for (let index = changes.length - 1; index >= 0; index -= 1) {
      if (changes[index].profile?.ceo) return changes[index].profile.ceo;
    }
    return "";
  };

  return { applyRoster, profileCeo, companies: [...byCompany.keys()] };
}
