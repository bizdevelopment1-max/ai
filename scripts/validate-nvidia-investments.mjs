#!/usr/bin/env node
/**
 * NVIDIA 투자 공개 뷰의 금액·근거 불변조건.
 *
 * - NVIDIA 개별 투자액과 전체 라운드 금액을 별도 필드로 강제한다.
 * - 미공개 개별 투자액을 전체 라운드 금액으로 대체하지 못하게 한다.
 * - 모든 공개 거래 문장은 원문 claim과 URL을 요구한다.
 * - 구형 템플릿 추론 필드가 다시 유입되면 배포를 중단한다.
 */
import { readFile } from "node:fs/promises";

const data = JSON.parse(await readFile("nvidia-investments.json", "utf8"));
const portfolio = data.portfolio || [];
const errors = [];
const add = message => errors.push(message);

if (portfolio.length < 100) add(`portfolio too small: ${portfolio.length}`);
if ((data.valueChains || []).length !== 6) add("value-chain count must be 6");

for (const item of portfolio) {
  const prefix = item.name || item.id || "unknown";
  if (!item.relationship?.type) add(`${prefix}: relationship.type missing`);
  if (!item.nvidiaInvestment?.status) add(`${prefix}: nvidiaInvestment.status missing`);
  if (!item.round?.status) add(`${prefix}: round.status missing`);
  if (!item.rationale?.status) add(`${prefix}: rationale.status missing`);
  if (!Array.isArray(item.evidence) || !item.evidence.length) add(`${prefix}: evidence missing`);
  for (const source of item.evidence || []) {
    if (!/^https?:\/\//.test(source.url || "")) add(`${prefix}: invalid evidence URL`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(source.date || "")) add(`${prefix}: invalid evidence date`);
    if (!source.claim || !source.quote || !source.publisher || !source.tier) add(`${prefix}: incomplete evidence span`);
  }

  if (["disclosed", "reported", "planned", "committed"].includes(item.nvidiaInvestment.status)
      && !Number.isFinite(item.nvidiaInvestment.amountUsd)) {
    add(`${prefix}: numeric NVIDIA amount required for ${item.nvidiaInvestment.status}`);
  }
  if (item.nvidiaInvestment.status === "undisclosed"
      && (item.nvidiaInvestment.amountUsd !== null || !/미공개/.test(item.nvidiaInvestment.display || ""))) {
    add(`${prefix}: undisclosed NVIDIA amount must remain null and visibly undisclosed`);
  }
  if (Number.isFinite(item.round.totalAmountUsd) && !/\$/.test(item.round.display || "")) {
    add(`${prefix}: round total display must identify currency`);
  }
  if (Number.isFinite(item.round.totalAmount) && !item.round.currency) {
    add(`${prefix}: non-USD round total requires an explicit currency`);
  }
  if (item.origin === "nventures-catalog"
      && (item.rationale.status !== "not-disclosed" || item.nvidiaInvestment.status !== "undisclosed")) {
    add(`${prefix}: catalog-only record may not synthesize deal facts`);
  }
  if (item.why || item.strategicFit || item.latestEvidence || item.transaction || item.relationType) {
    add(`${prefix}: legacy synthetic investment fields detected`);
  }
}

const runway = portfolio.find(item => item.id === "runway");
if (!runway || runway.round?.totalAmountUsd !== 315_000_000
    || runway.nvidiaInvestment?.status !== "undisclosed" || runway.dealHistory?.length < 2) {
  add("Runway must separate the $315M round from NVIDIA's undisclosed individual amount");
}
const coreweave = portfolio.find(item => item.id === "coreweave");
if (!coreweave || coreweave.nvidiaInvestment?.amountUsd !== 2_000_000_000
    || coreweave.nvidiaInvestment?.status !== "disclosed") {
  add("CoreWeave must retain NVIDIA's disclosed $2B direct investment");
}
const groq = portfolio.find(item => item.id === "groq");
if (!groq || groq.relationship?.equity !== false || groq.nvidiaInvestment?.status !== "not-applicable") {
  add("Groq licensing must not be represented as equity investment");
}
const mistral = portfolio.find(item => item.id === "mistral-ai");
if (!mistral || mistral.round?.totalAmount !== 1_700_000_000 || mistral.round?.currency !== "EUR"
    || mistral.nvidiaInvestment?.status !== "undisclosed") {
  add("Mistral AI must separate the €1.7B round from NVIDIA's undisclosed individual amount");
}
const together = portfolio.find(item => item.id === "together-ai");
if (!together || together.round?.totalAmountUsd !== 800_000_000
    || together.nvidiaInvestment?.status !== "undisclosed" || together.dealHistory?.length < 3) {
  add("Together AI must retain its three sourced rounds without inventing NVIDIA's individual amount");
}

const repeatedRationales = new Map();
for (const item of portfolio.filter(item => item.rationale?.status !== "not-disclosed")) {
  const key = item.rationale.summary.trim();
  repeatedRationales.set(key, (repeatedRationales.get(key) || 0) + 1);
}
for (const [text, count] of repeatedRationales) {
  if (count > 1) add(`repeated sourced rationale (${count}): ${text.slice(0, 60)}`);
}

if (errors.length) {
  console.error(`[nvidia-investments] validation failed (${errors.length})`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

console.log(`[nvidia-investments] validated ${portfolio.length} companies · ${data.metrics?.detailedCount || 0} detailed deals · ${data.metrics?.nvidiaAmountCount || 0} NVIDIA amounts · ${data.metrics?.roundAmountCount || 0} round totals`);
