// Guards for executives read from the text of a company's own web page.
//
// Team and about pages often list investors, advisors or customers as
// "<Name>, CEO" followed by their own company, and the text pattern then
// reads the neighbouring company name as part of the person's name
// ("Warby Parker Kevin Weil" as CPO). One page cannot name two people for
// the same exclusive office, so a page that does is treated as such a list
// and none of its text-extracted people are kept. Rows from any other
// source (curated, filings, JSON-LD, Wikidata) pass through unchanged.

export const PAGE_EXTRACTION = "official-page-extraction";

// Section labels and place names that the capitalised-word name pattern
// picks up in front of, or instead of, a real name.
export const NON_PERSON_NAME_WORD = /\b(?:Launched|Advisors?|Angels?|Backed|Backers?|Investors?|United|Kingdom|States|Emirates)\b/i;

const key = value => String(value || "").normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();

const EXCLUSIVE_OFFICES = [
  ["ceo", /\bCEO\b|chief executive/i],
  ["cto", /\bCTO\b|chief technology/i],
  ["cfo", /\bCFO\b|chief financial/i],
  ["coo", /\bCOO\b|chief operating/i],
  ["cpo", /\bCPO\b|chief product/i],
  ["cmo", /\bCMO\b|chief marketing/i],
  ["cro", /\bCRO\b|chief revenue/i],
];

export function unreliableExtractedNames(people = []) {
  const dropped = new Set();
  const byPage = new Map();
  for (const person of people) {
    if (person?.sourceType !== PAGE_EXTRACTION) continue;
    if (NON_PERSON_NAME_WORD.test(String(person.name || ""))) dropped.add(key(person.name));
    const page = String(person.verificationUrl || "");
    if (!byPage.has(page)) byPage.set(page, []);
    byPage.get(page).push(person);
  }
  for (const rows of byPage.values()) {
    const holders = new Map();
    for (const person of rows) {
      for (const [office, pattern] of EXCLUSIVE_OFFICES) {
        if (!pattern.test(String(person.role || ""))) continue;
        if (!holders.has(office)) holders.set(office, new Set());
        holders.get(office).add(key(person.name));
      }
    }
    if ([...holders.values()].some(names => names.size > 1)) rows.forEach(person => dropped.add(key(person.name)));
  }
  return dropped;
}

export function reliablePageExtractions(people = []) {
  const dropped = unreliableExtractedNames(people);
  return dropped.size
    ? people.filter(person => person?.sourceType !== PAGE_EXTRACTION || !dropped.has(key(person.name)))
    : people;
}

export const isUnreliableName = (dropped, name) => dropped.has(key(name));
