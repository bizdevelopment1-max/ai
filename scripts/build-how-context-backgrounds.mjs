import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const outputDir = path.resolve("How/assets/context-bg");

const contexts = [
  { slug: "01-decision", title: "사업 질문과 의사결정", type: "question", accent: "7c3aed", accent2: "2563eb" },
  { slug: "02-quality", title: "사이트 Quality와 의사결정 기준", type: "quality", accent: "0072ce", accent2: "14b8a6" },
  { slug: "03-architecture", title: "정보 구조와 화면 계층", type: "layers", accent: "db2777", accent2: "7c3aed" },
  { slug: "04-data-engine", title: "원문 수집과 데이터 파이프라인", type: "pipeline", accent: "00a9e0", accent2: "14b8a6" },
  { slug: "05-company", title: "기업 데이터와 조직", type: "org", accent: "f59e0b", accent2: "db2777" },
  { slug: "06-automation", title: "자동 수집과 반복 갱신", type: "automation", accent: "f59e0b", accent2: "2563eb" },
  { slug: "07-consulting", title: "전략 프레임과 선택", type: "matrix", accent: "14b8a6", accent2: "2563eb" },
  { slug: "08-verification", title: "교차 검증과 근거 확인", type: "shield", accent: "a855f7", accent2: "ec4899" },
  { slug: "09-iteration", title: "보완 요청과 반복 개선", type: "iterate", accent: "10b981", accent2: "00a9e0" },
  { slug: "10-build", title: "구현과 배포", type: "deploy", accent: "2563eb", accent2: "7c3aed" },
  { slug: "11-long-run", title: "장기 과제와 문제 해결", type: "timeline", accent: "ec4899", accent2: "f59e0b" },
  { slug: "12-operating-loop", title: "지속 개선 운영 루프", type: "diamond", accent: "00a9e0", accent2: "10b981" },
  { slug: "13-publish", title: "완료 기준과 공개 운영", type: "finish", accent: "00a9e0", accent2: "a855f7" },
];

const variants = [
  { id: "a", shift: 0, rotate: -4, scale: 1 },
  { id: "b", shift: 84, rotate: 5, scale: 0.94 },
  { id: "c", shift: -52, rotate: 0, scale: 1.08 },
];

function motif(type, accent, accent2) {
  const common = `fill="none" stroke="url(#line)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"`;
  const muted = `fill="none" stroke="#${accent2}" stroke-opacity=".42" stroke-width="3"`;
  const motifs = {
    question: `<path ${common} d="M220 235c0-112 92-188 210-188 122 0 214 72 214 180 0 91-57 132-133 174-58 32-86 65-86 125"/><circle cx="425" cy="655" r="13" fill="#${accent}"/><path ${muted} d="M162 274C94 392 126 556 250 635M676 256c74 116 49 268-62 361"/>`,
    quality: `<path ${common} d="M92 634h656L674 466H166zM166 446h508l-72-160H238zM238 266h364L530 92H310z"/><path ${muted} d="M420 92v542M198 516h444M274 356h292"/><path ${common} d="M332 374l58 57 123-132"/>`,
    layers: `<g ${common}><rect x="118" y="92" width="610" height="150" rx="10"/><rect x="202" y="284" width="610" height="150" rx="10"/><rect x="118" y="476" width="610" height="150" rx="10"/></g><path ${muted} d="M164 168h314M248 360h390M164 552h470"/>`,
    pipeline: `<g ${common}><rect x="72" y="270" width="150" height="118" rx="10"/><rect x="344" y="270" width="150" height="118" rx="10"/><rect x="616" y="270" width="150" height="118" rx="10"/><path d="M222 329h122m150 0h122"/></g><path ${muted} d="M286 190v278M558 190v278"/><circle cx="283" cy="329" r="12" fill="#${accent}"/><circle cx="555" cy="329" r="12" fill="#${accent2}"/>`,
    org: `<g ${common}><rect x="316" y="70" width="210" height="112" rx="12"/><rect x="70" y="456" width="190" height="110" rx="12"/><rect x="325" y="456" width="190" height="110" rx="12"/><rect x="580" y="456" width="190" height="110" rx="12"/><path d="M421 182v136M165 318h510M165 318v138m255-138v138m255-138v138"/></g><circle ${muted} cx="421" cy="318" r="28"/>`,
    automation: `<path ${common} d="M646 247a245 245 0 10 18 211M646 247l-16-124 121 39M203 499l16 124-121-39"/><circle ${muted} cx="421" cy="373" r="146"/><path ${muted} d="M421 290v94l78 48"/><circle cx="421" cy="373" r="18" fill="#${accent}"/>`,
    matrix: `<g ${common}><rect x="114" y="82" width="620" height="552" rx="12"/><path d="M424 82v552M114 358h620"/></g><path ${muted} d="M176 544c120-72 179-189 238-278 62-94 130-110 258-124"/><circle cx="574" cy="202" r="31" fill="#${accent}" fill-opacity=".72"/>`,
    shield: `<path ${common} d="M420 58l280 105v206c0 166-104 265-280 337-176-72-280-171-280-337V163z"/><path ${common} d="M280 374l94 92 191-204"/><path ${muted} d="M420 102v548"/>`,
    iterate: `<path ${common} d="M627 235a247 247 0 11-34-48M627 235l-128-7 69-110"/><path ${muted} d="M254 330l98 100 228-220"/><circle ${muted} cx="420" cy="374" r="151"/>`,
    deploy: `<g ${common}><rect x="82" y="118" width="466" height="376" rx="15"/><path d="M82 204h466M152 275l76 68-76 68m120 0h126"/></g><path ${common} d="M616 474c-62-105-25-221 104-277 89 126 71 244-39 314l-65-37zM625 466l-69 91m133-52 17 86"/><path ${muted} d="M672 234l38 39"/>`,
    timeline: `<path ${common} d="M90 380h672"/><g fill="#${accent}"><circle cx="146" cy="380" r="15"/><circle cx="318" cy="380" r="15"/><circle cx="490" cy="380" r="15"/><circle cx="662" cy="380" r="15"/></g><g ${muted}><rect x="90" y="176" width="150" height="112" rx="10"/><rect x="243" y="470" width="150" height="112" rx="10"/><rect x="415" y="176" width="150" height="112" rx="10"/><rect x="587" y="470" width="150" height="112" rx="10"/></g><path ${muted} d="M146 288v92m172 0v90m172-182v92m172 0v90"/>`,
    diamond: `<path ${common} d="M70 372l170-205 170 205-170 205zM430 372l170-205 170 205-170 205z"/><path ${muted} d="M240 167c88 29 139 74 170 205-29 127-82 175-170 205M600 167c88 29 139 74 170 205-29 127-82 175-170 205"/>`,
    finish: `<circle ${common} cx="420" cy="364" r="278"/><circle ${muted} cx="420" cy="364" r="212"/><path ${common} d="M275 364l98 101 211-230"/><path ${muted} d="M420 86v-48m0 652v-48M142 364H94m652 0h-48"/>`,
  };
  return motifs[type];
}

function background(context, variant, index) {
  const seed = index * 37 + variant.shift;
  const particles = Array.from({ length: 24 }, (_, point) => {
    const x = 38 + ((point * 211 + seed * 17) % 1510);
    const y = 34 + ((point * 137 + seed * 29) % 820);
    const r = 1 + ((point + index) % 4);
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="#${point % 3 ? context.accent : context.accent2}" opacity="${point % 2 ? ".26" : ".42"}"/>`;
  }).join("");
  const rails = Array.from({ length: 7 }, (_, rail) => {
    const y = 110 + rail * 104 + ((seed + rail * 13) % 28);
    return `<path d="M760 ${y} C980 ${y - 92}, 1260 ${y + 96}, 1590 ${y - 12}" stroke="#${rail % 2 ? context.accent : context.accent2}" stroke-opacity=".11" stroke-width="2" fill="none"/>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900" role="img" aria-labelledby="title">
  <title id="title">${context.title} 배경 ${variant.id.toUpperCase()}</title>
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#020713"/><stop offset=".48" stop-color="#06172f"/><stop offset="1" stop-color="#16091f"/></linearGradient>
    <linearGradient id="line" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#${context.accent}"/><stop offset="1" stop-color="#${context.accent2}"/></linearGradient>
    <radialGradient id="halo"><stop stop-color="#${context.accent}" stop-opacity=".34"/><stop offset="1" stop-color="#${context.accent}" stop-opacity="0"/></radialGradient>
    <pattern id="grid" width="80" height="80" patternUnits="userSpaceOnUse"><path d="M80 0H0V80" fill="none" stroke="#a8c8ff" stroke-opacity=".055"/></pattern>
    <filter id="glow"><feGaussianBlur stdDeviation="11" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <rect width="1600" height="900" fill="url(#bg)"/><rect width="1600" height="900" fill="url(#grid)"/>
  <ellipse cx="1240" cy="430" rx="520" ry="460" fill="url(#halo)" opacity=".72"/>
  ${rails}${particles}
  <g transform="translate(${760 + variant.shift} 70) rotate(${variant.rotate} 420 370) scale(${variant.scale})" opacity=".78" filter="url(#glow)">${motif(context.type, context.accent, context.accent2)}</g>
  <g opacity=".12" fill="none" stroke="#${context.accent2}"><circle cx="1240" cy="430" r="340"/><circle cx="1240" cy="430" r="390"/><circle cx="1240" cy="430" r="440"/></g>
  <path d="M0 760C430 650 745 854 1080 736c220-78 365-39 520 13V900H0z" fill="#${context.accent}" opacity=".035"/>
</svg>`;
}

if (!outputDir.endsWith(path.join("How", "assets", "context-bg"))) {
  throw new Error(`refusing to rebuild unexpected directory: ${outputDir}`);
}
await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });
for (const [index, context] of contexts.entries()) {
  for (const variant of variants) {
    const target = path.join(outputDir, `${context.slug}-${variant.id}.svg`);
    await writeFile(target, background(context, variant, index + 1), "utf8");
  }
}

console.log(`generated ${contexts.length * variants.length} context backgrounds in ${outputDir}`);
