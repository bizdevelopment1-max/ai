/**
 * Korean consulting-copy rules shared by crawlers and public-data builders
 *
 * Raw source excerpts and original-language quotations must remain untouched
 * Presentation fields use short noun-form bullets without sentence periods or
 * declarative endings such as -다 and -습니다
 */
const HANGUL = /[가-힣]/;
const URL_ONLY = /^https?:\/\/\S+$/i;

const ENDINGS = [
  [/하지 않았습니다$/, "하지 않음"],
  [/되지 않았습니다$/, "되지 않음"],
  [/있지 않았습니다$/, "있지 않음"],
  [/있지 않습니다$/, "있지 않음"],
  [/찾지 못했습니다$/, "찾지 못함"],
  [/것으로 보입니다$/, "것으로 전망"],
  [/것으로 보인다$/, "것으로 전망"],
  [/그렇지 않습니다$/, "그렇지 않음"],
  [/아니었습니다$/, "아니었음"],
  [/아닙니다$/, "아님"],
  [/아니다$/, "아님"],
  [/하였습니다$/, "함"],
  [/했습니다$/, "함"],
  [/합니다$/, "함"],
  [/하였다$/, "함"],
  [/했다$/, "함"],
  [/한다$/, "함"],
  [/되었습니다$/, "됨"],
  [/됐습니다$/, "됨"],
  [/되었다$/, "됨"],
  [/됐다$/, "됨"],
  [/됩니다$/, "됨"],
  [/된다$/, "됨"],
  [/있었습니다$/, "있었음"],
  [/있었다$/, "있었음"],
  [/있습니다$/, "있음"],
  [/있다$/, "있음"],
  [/없었습니다$/, "없었음"],
  [/없었다$/, "없었음"],
  [/없습니다$/, "없음"],
  [/없다$/, "없음"],
  [/이었습니다$/, "이었음"],
  [/였습니다$/, "였음"],
  [/이었다$/, "이었음"],
  [/였다$/, "였음"],
  [/입니다$/, "임"],
  [/이다$/, "임"],
  [/보입니다$/, "보임"],
  [/보인다$/, "보임"],
  [/나타났습니다$/, "나타남"],
  [/나타났다$/, "나타남"],
  [/밝혔습니다$/, "밝힘"],
  [/밝혔다$/, "밝힘"],
  [/예상됩니다$/, "예상"],
  [/전망됩니다$/, "전망"],
  [/필요합니다$/, "필요"],
  [/중요합니다$/, "중요"],
  [/가능합니다$/, "가능"],
  [/어렵습니다$/, "어려움"],
  [/쉽습니다$/, "쉬움"],
  [/높습니다$/, "높음"],
  [/낮습니다$/, "낮음"],
  [/많습니다$/, "많음"],
  [/적습니다$/, "적음"],
  [/큽니다$/, "큼"],
  [/작습니다$/, "작음"],
  [/늘린다$/, "확대"],
  [/높인다$/, "제고"],
  [/넓힌다$/, "확대"],
  [/줄인다$/, "축소"],
  [/낮춘다$/, "축소"],
  [/만든다$/, "구축"],
  [/선보인다$/, "공개"],
  [/나타낸다$/, "나타냄"],
  [/받는다$/, "받음"],
  [/않았습니다$/, "않음"],
  [/않습니다$/, "않음"],
  [/않았다$/, "않음"],
  [/않는다$/, "않음"],
  [/드립니다$/, "드림"],
  [/습니다$/, "음"],
  [/는다$/, "음"],
  [/과제다$/, "과제"],
  [/전제다$/, "전제"],
  [/목표다$/, "목표"],
];

// ENDINGS above only lists verbs seen so far; any other -ㅂ니다(formal)/-ㄴ다(plain
// present) verb still needs a correct noun-form ending. Blindly cutting the final
// -다 breaks the stem (e.g. "가져옵니다" -> "가져옵니"), so shift the stem's own
// batchim (ㅂ or ㄴ) to ㅁ instead, which is how Korean actually nominalizes these.
const HANGUL_BASE = 0xac00, HANGUL_LAST = 0xd7a3, JONG_COUNT = 28;
const JONG_NIEUN = 4, JONG_MIEUM = 16, JONG_BIEUP = 17;
const jongseongOf = ch => {
  const code = ch.codePointAt(0);
  return code >= HANGUL_BASE && code <= HANGUL_LAST ? (code - HANGUL_BASE) % JONG_COUNT : -1;
};
const withJongseong = (ch, jong) => String.fromCodePoint(ch.codePointAt(0) - jongseongOf(ch) + jong);
export const nominalizeStatementEnding = clause => {
  if (clause.endsWith("니다") && clause.length >= 3) {
    const stem = clause.slice(0, -2);
    const last = stem.slice(-1);
    return jongseongOf(last) === JONG_BIEUP ? stem.slice(0, -1) + withJongseong(last, JONG_MIEUM) : null;
  }
  if (clause.endsWith("다") && clause.length >= 2) {
    const last = clause.slice(-2, -1);
    if (jongseongOf(last) === JONG_NIEUN) return clause.slice(0, -2) + withJongseong(last, JONG_MIEUM);
  }
  return null;
};

const normalizeClause = value => {
  let clause = String(value || "").trim().replace(/^[·\s]+|[·\s]+$/g, "");
  const closing = clause.match(/(["'”’]+)$/)?.[1] || "";
  if (closing) clause = clause.slice(0, -closing.length).trimEnd();
  clause = clause.replace(/[。.!?！？]+$/g, "").trim();
  for (const [pattern, replacement] of ENDINGS) {
    if (pattern.test(clause)) {
      clause = clause.replace(pattern, replacement);
      break;
    }
  }
  // Deterministic final gate: no Korean presentation clause may retain a
  // declarative -다 ending even when a previously unseen verb is generated
  if (/다$/u.test(clause)) clause = (nominalizeStatementEnding(clause) || clause.replace(/다$/u, "")).trim();
  return `${clause}${closing}`;
};

export function bulletizeKorean(value) {
  const source = String(value ?? "");
  if (!source || !HANGUL.test(source) || URL_ONLY.test(source.trim())) return source;

  const normalized = source
    .replace(/\b(\d{4})\.(\d{1,2})\.(\d{1,2})\b/g, "$1-$2-$3")
    .replace(/\bU\.S\./gi, "US")
    .replace(/\bU\.K\./gi, "UK")
    .replace(/\bE\.U\./gi, "EU")
    .replace(/([가-힣])([.!?。！？]+)(["'”’]?)(?=\s|$|라고|이라며|라는)/g, "$1$3 · ")
    .replace(/([가-힣])\s*[:：]\s+/g, "$1 · ")
    .replace(/。/g, " · ");

  return normalized.split("\n").map(line =>
    line.split(/\s+·\s+/).map(normalizeClause).filter(Boolean).join(" · ")
  ).join("\n").replace(/[ \t]{2,}/g, " ").trim();
}

export function hasKoreanProseEnding(value) {
  return String(value || "").split(/\n|\s+·\s+/).some(part => {
    const clause = part.trim();
    // A bare 니 as the very last character never occurs in correct 개조식
    // Korean — it only appears when a -ㅂ니다 ending was cut without shifting
    // the stem's batchim (e.g. "가져옵니다" -> "가져옵니"). Treat it the same
    // as an un-nominalized declarative ending so it fails this gate.
    return /[가-힣](?:다|습니다|ㅂ니다)[.!?。！？]*["'”’]*\s*$/u.test(clause)
      || /[가-힣]니["'”’]*\s*$/u.test(clause);
  });
}

export function hasKoreanSentencePeriod(value) {
  const text = String(value || "");
  if (!HANGUL.test(text)) return false;
  const withoutDates = text.replace(/\b\d{4}\.\d{1,2}\.\d{1,2}\b/g, "");
  return /[가-힣][.!?。！？]+["'”’]?(?=\s|$|라고|이라며|라는)/u.test(withoutDates);
}

export function normalizeLocalizedRecord(item) {
  if (!item || typeof item !== "object") return item;
  const out = { ...item };
  const textKeys = ["title", "titleKo", "desc", "signal", "quant", "summary"];
  for (const key of textKeys) {
    if (typeof out[key] === "string") out[key] = bulletizeKorean(out[key]);
  }
  for (const key of ["summaryLinesKo"]) {
    if (Array.isArray(out[key])) out[key] = out[key].map(bulletizeKorean);
  }
  if (out.localization && typeof out.localization === "object") {
    out.localization = {
      ...out.localization,
      title: bulletizeKorean(out.localization.title),
      summaryLines: Array.isArray(out.localization.summaryLines)
        ? out.localization.summaryLines.map(bulletizeKorean) : out.localization.summaryLines,
    };
  }
  return out;
}
