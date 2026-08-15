const DISPLAY_REPLACEMENTS = [
  [/Samsung Electronics MX/gi, "자사 모바일 사업"],
  [/Samsung MX/gi, "자사 모바일 사업"],
  [/MX\s*사업부/gi, "모바일 사업부"],
  [/Galaxy AI/gi, "자사 단말 AI"],
  [/Galaxy Store/gi, "자사 앱스토어"],
  [/Galaxy Watch/gi, "자사 워치"],
  [/Galaxy Ring/gi, "자사 링"],
  [/Galaxy Camera/gi, "자사 카메라"],
  [/Galaxy NPU/gi, "자사 NPU"],
  [/Samsung Account/gi, "자사 계정"],
  [/Samsung Health/gi, "자사 헬스 플랫폼"],
  [/Samsung Wallet/gi, "자사 월렛"],
  [/Samsung Members/gi, "자사 사용자 커뮤니티"],
  [/Samsung Phone/gi, "자사 단말"],
  [/One UI/gi, "자사 UI"],
  [/Knox Vault/gi, "자사 보안 금고"],
  [/Knox Suite/gi, "자사 보안 제품군"],
  [/Knox/gi, "자사 보안 플랫폼"],
  [/SmartThings/gi, "자사 연결 플랫폼"],
  [/\bDeX\b/g, "자사 데스크톱 모드"],
  [/\bSVIC\b/gi, "사내 벤처투자"],
  [/삼성전자/g, "자사"],
  [/삼성/g, "자사"],
  [/Samsung/gi, "자사"],
  [/갤럭시/g, "자사 단말"],
  [/Galaxy/gi, "자사 단말"],
  [/\bMX\b/gi, "모바일 사업"],
];

const MACHINE_VALUE_KEYS = new Set([
  "id", "signalId", "eventClusterId", "stableKey", "mode", "from", "to", "with",
  "url", "sourceUrl", "evidenceUrl", "corroboratingUrl", "verificationUrl", "resolvedUrl",
]);

export const neutralizePublicText = value => DISPLAY_REPLACEMENTS
  .reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), String(value ?? ""));

export const sanitizePublicCopy = (value, key = "") => {
  if (typeof value === "string") return MACHINE_VALUE_KEYS.has(key) ? value : neutralizePublicText(value);
  if (Array.isArray(value)) return value.map(item => sanitizePublicCopy(item, key));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([childKey, childValue]) => [childKey, sanitizePublicCopy(childValue, childKey)]));
};

export const containsRestrictedDisplayTerm = value => {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? "");
  return /삼성|samsung|갤럭시|galaxy|\bmx\b/i.test(text);
};

export const hasRestrictedPublicCopy = (value, key = "") => {
  if (typeof value === "string") return !MACHINE_VALUE_KEYS.has(key) && containsRestrictedDisplayTerm(value);
  if (Array.isArray(value)) return value.some(item => hasRestrictedPublicCopy(item, key));
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(([childKey, childValue]) => hasRestrictedPublicCopy(childValue, childKey));
};
