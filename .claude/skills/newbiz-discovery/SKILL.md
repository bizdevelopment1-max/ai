---
name: newbiz-discovery
description: 신사업 발굴 하네스 — 오케스트레이션 에이전트가 시장조사(산업→경쟁→소비자→트렌드)와 사업화(아이디어검증→BM→MVP→피칭)를 하위 에이전트로 분해·조율해 단말(온디바이스 AI) 사업 관점의 신사업 기회 브리프를 만든다. "신사업 발굴", "시장 조사", "TAM/SAM/SOM", "Porter's 5 Forces", "BMC", "RICE", "OKR", "사업 기회 우선순위", "startup-launcher", "market-research" 요청 시 사용.
---

# 신사업 발굴 하네스 (newbiz-discovery)

harness-100의 **카테고리 4: 비즈니스 & 전략** 중 #43 startup-launcher + #44 market-research를
하나의 오케스트레이션 하네스로 통합했다. 글로벌 스마트폰 제조사 무선사업부(온디바이스 AI·단말)의
**신사업 발굴** 관점에서, 하나의 오케스트레이터가 9개 하위 에이전트를 단계적으로 조율한다.

## 파이프라인 (오케스트레이터 → 하위 에이전트)

```
[Intake] 도메인/시드 아이디어 + 단말 사업 제약
   │
   ├─ Phase 1 · 시장 조사 (#44 market-research) ── 병렬
   │    ├─ industry-analyst      산업 구조·규모      → TAM / SAM / SOM · 밸류체인
   │    ├─ competition-analyst   경쟁 강도           → Porter's 5 Forces
   │    ├─ consumer-analyst      소비자·수요         → JTBD · 페르소나 · WTP
   │    └─ trend-analyst         트렌드·미래 신호    → PEST · S-curve · 규제/기술 신호
   │        ▼ (시장 매력도 종합 — 게이트: 낮으면 재정의/조기 종료)
   │
   └─ Phase 2 · 사업화 (#43 startup-launcher · 5 에이전트)
        ├─ idea-validator        아이디어 검증       → 가설·근거·킬 조건
        ├─ bm-designer           비즈니스 모델       → BMC (9블록)
        ├─ mvp-planner           MVP 정의            → MVP 캔버스 · 성공지표
        ├─ pitch-builder         피칭                → 경영진/투자 1-pager
        └─ opportunity-prioritizer 우선순위·목표     → RICE 스코어 · OKR
   │
[Synthesis] 신사업 기회 브리프(경영진 보고용) — 시장매력도·경쟁·BMC·RICE·OKR 종합
```

## 프레임워크 매핑 (모듈 = 하위 에이전트 = 프레임워크)

| 모듈 | 하위 에이전트 | 프레임워크 |
|---|---|---|
| 산업 | industry-analyst | **TAM/SAM/SOM**, 산업 밸류체인 |
| 경쟁 | competition-analyst | **Porter's 5 Forces** |
| 소비자 | consumer-analyst | JTBD, 페르소나, WTP(지불의사) |
| 트렌드 | trend-analyst | PEST, 기술 S-curve, 규제 신호 |
| 아이디어 | idea-validator | 가설-근거-킬조건(리스키스트 가정) |
| BM | bm-designer | **BMC (Business Model Canvas)** |
| MVP | mvp-planner | MVP 캔버스, 최소검증지표 |
| 피칭 | pitch-builder | 문제-해법-시장-BM-요청 피치 |
| 우선순위 | opportunity-prioritizer | **RICE**(Reach·Impact·Confidence·Effort) + **OKR** |

## 오케스트레이터 사용법

1. 사용자의 도메인/시드 아이디어를 받는다(예: "온디바이스 AI 헬스 신사업").
2. `newbiz-orchestrator` 에이전트를 실행한다 — 오케스트레이터가 Phase 1 하위 에이전트를 **병렬**로 띄우고,
   시장 매력도를 종합해 게이트를 통과하면 Phase 2를 순차 실행한 뒤 최종 브리프를 합성한다.
3. 각 하위 에이전트는 `.claude/agents/`에 정의돼 있으며, 구조화된(마크다운 표/개조식) 결과를 반환한다.

## 산출 규칙 (프로젝트 정책 준수)

- **정량 우선**: TAM/SAM/SOM·성장률·RICE 점수 등 수치는 근거(출처·연도)와 함께 제시. 추정은 "추정"으로 명시.
- **개조식·명사형 종결**(~함/~음/~임), 문장 끝 마침표 지양. 근거 없는 과장 금지.
- **사명 미표기**: 삼성·MX·갤럭시·Galaxy 등 자사 식별 표현을 산출물에 쓰지 않는다("단말 제조사/무선사업부" 관점만).
- **MECE**: 모듈·항목은 상호배타·전체포괄로 정리.
