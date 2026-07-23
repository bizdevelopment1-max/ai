# 신사업 발굴 하네스 (newbiz-discovery)

harness-100 **카테고리 4: 비즈니스 & 전략**의 #43 startup-launcher + #44 market-research를
하나의 오케스트레이션 하네스로 통합한 Claude Code 에이전트 구성. 글로벌 스마트폰 제조사
무선사업부(온디바이스 AI·단말)의 **신사업 발굴** 관점으로 설계했다.

## 구성 (1 오케스트레이터 + 9 하위 에이전트)

| 역할 | 에이전트 | 모듈 | 프레임워크 |
|---|---|---|---|
| 오케스트레이터 | `newbiz-orchestrator` | 전체 조율·게이트·합성 | 파이프라인 |
| 시장조사 #44 | `industry-analyst` | 산업 | TAM/SAM/SOM · 밸류체인 |
| 시장조사 #44 | `competition-analyst` | 경쟁 | Porter's 5 Forces |
| 시장조사 #44 | `consumer-analyst` | 소비자 | JTBD · 페르소나 · WTP |
| 시장조사 #44 | `trend-analyst` | 트렌드 | PEST · S-curve |
| 사업화 #43 | `idea-validator` | 아이디어 검증 | 리스키스트 가정 · 킬 조건 |
| 사업화 #43 | `bm-designer` | BM | BMC 9블록 |
| 사업화 #43 | `mvp-planner` | MVP | MVP 캔버스 · 최소검증지표 |
| 사업화 #43 | `pitch-builder` | 피칭 | 1-pager 피치 |
| 사업화 #43 | `opportunity-prioritizer` | 우선순위·목표 | RICE · OKR |

## 실행 흐름

```
Intake(도메인/시드) → [Phase1 시장조사 4개 병렬] → 시장매력도 게이트(High/Mid/Low)
   → [Phase2 사업화: 검증→BMC→(MVP∥피치)→RICE·OKR] → 신사업 기회 브리프(경영진 보고용)
```

- Phase 1의 4개 시장조사 에이전트는 **병렬** 실행 → 벽시계 시간 단축.
- 게이트가 **Low**면 세그먼트 재정의를 제안하고 조기 종료(자원 낭비 방지).
- Phase 2는 순차 + MVP/피치 부분 병렬. 마지막에 오케스트레이터가 정합성을 적대적 검증 후 합성.

## 사용법

```
# 오케스트레이터에게 도메인/시드 아이디어를 주면 전체 파이프라인을 조율한다
Agent(subagent_type: "newbiz-orchestrator",
      prompt: "온디바이스 AI 헬스 신사업 기회를 발굴·평가해줘")

# 개별 모듈만 단독 실행도 가능
Agent(subagent_type: "competition-analyst", prompt: "AI 이어버드 시장 경쟁 구조 분석")
```

스킬 정의: `.claude/skills/newbiz-discovery/SKILL.md`

## 산출 정책
정량 우선(근거·연도) · 개조식·명사형 종결·마침표 지양 · MECE · **사명(삼성·MX·갤럭시) 미표기**.
