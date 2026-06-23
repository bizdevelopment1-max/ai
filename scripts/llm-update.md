# 다른 PC의 Claude Code CLI로 'AI 인텔리전스 일일 업데이트'

이 저장소(AI Intelligence Dashboard)를 **로컬 Claude(구독)** 로 매일 갱신하는 작업 지침입니다.
GitHub Action(API 키 없음)은 raw 뉴스 수집까지만 하고, **요약·신규 뉴스·최신화는 이 CLI가 담당**합니다.

작업은 3가지입니다: **(A) 기존 기사 3줄 요약 → (B) 신규 뉴스·인사이트 추가 → (C) 오래된 수치 최신화.**

---

## 전역 규칙 (반드시 준수)

- **3줄 개조식**: 모든 기사 `summary`는 정확히 3줄. 각 줄 `· `로 시작, 명사형 종결("~함/~음/~임/~필요"), **마침표 없음**.
  - 1줄=핵심 사실 / 2줄=수치·배경 / 3줄=**온디바이스 AI·AI 에이전트·스마트폰/노트북 단말 사업 관점의 시사점**.
- **출처 줄 금지**: 요약 본문에 매체명(예: 비즈니스 인사이더)을 넣지 말 것. 출처는 `source` 필드에만.
- **금칙어**: `삼성/Samsung/MX/Galaxy/갤럭시`를 화면 노출 텍스트(기사·인사이트·요약)에 **절대** 쓰지 말 것.
- **사실 기반(할루시네이션 금지)**: 수치는 WebSearch로 검증하고 `source`/`날짜`를 명시. 불확실하면 "추정"/"보도"로 표기, 미확정 밸류는 범위로.
- **단위 통일**: 금액은 `$` (예: $852B, $47B). 원화/위안/유로는 `$` 환산 병기.
- 톤: 과장 없이, 임원 브리핑체.

---

## (A) 기존 크롤 기사 요약 — `news.json`

`news.json`에서 `"needsLLM": true` 이거나 `summary`가 3줄 미만인 기사를 모두 처리:
1. `descEn`(원문)·`titleEn`을 근거로, 필요하면 `url`을 WebFetch해 본문 보강.
2. 위 전역 규칙대로 `summary`를 3줄로 재작성, `title`(한글 제목)도 어색하면 다듬기.
3. 처리한 기사는 `"needsLLM": false`로.

## (B) 신규 뉴스·인사이트 추가 — `data.js`

1. **WebSearch로 최근 3~5일 AI 주요 뉴스**를 조사(모델 출시·펀딩·M&A·실적·규제·온디바이스/에이전트 동향 등).
2. 아직 `data.js`의 `ARTICLES`에 없는 **새 기사 2~5건**을 추가:
   - 형식: `{ date:"YYYY-MM-DD", co:"<기존 회사명 또는 ''>", cat:"native|bigtech|startup", source:"<매체>", title:"<한글 제목>", summary:"· …\n· …\n· …", tag:"<Product|Funding|M&A|Earnings|IPO|Market|People 등>", url:"<원문 URL>" }`
   - 최신순으로 자연스러운 위치(해당 섹션 상단)에 삽입.
3. 전략적으로 중요한 건은 `INSIGHTS` 배열에도 1~2건 추가(`{ title, desc, icon, src }`, 단말 관점 시사점 포함).

## (C) 오래된 내용 최신화 — `data.js`

1. `KPIS`, 회사 `valuation/metric/value`, `REVENUE`·`REVENUE_QUARTERLY`·`FUNDING`·`STOCKS` 등에서 **구버전 수치**를 WebSearch로 검증해 최신값으로 갱신(각 `src`/날짜도 갱신).
2. "협의 중→클로즈", "분기 실적 갱신", "신규 라운드" 등 변경된 사실 반영.
3. 바뀐 수치가 여러 곳(기업카드·차트·기사·인사이트)에 있으면 **모두 일관되게** 수정.

---

## 검증 → 커밋 (반드시)

```bash
# data.js 로드 확인
node -e "global.window={};require('./data.js');console.log('data.js OK')"
# 금칙어 확인(아무것도 안 나와야 함; CSS 폰트의 SamsungOne은 제외)
grep -rn "삼성\|Samsung\|Galaxy\|갤럭시" data.js | grep -v SamsungOne
# 기사 모두 3줄인지 확인
node -e "global.window={};require('./data.js');const a=window.DASH.ARTICLES;console.log('>3줄:',a.filter(x=>x.summary.split('\n').filter(Boolean).length>3).length)"

git add news.json data.js
git commit -m "chore: AI 인텔리전스 일일 업데이트(요약·신규 뉴스·최신화) — local Claude CLI"
git push
```

> data.js를 수정했다면 위 검증을 통과한 뒤에만 커밋할 것. 로드 실패/금칙어 발견 시 수정 후 재검증.

---

## 한 줄 실행 명령(다른 PC)

```bash
cd ai && git pull --rebase && claude -p "scripts/llm-update.md 를 읽고 그 지침대로 (A)news.json 요약, (B)WebSearch로 최신 AI 뉴스·인사이트 추가, (C)오래된 수치 최신화를 수행한 뒤, 검증 통과 시 커밋·푸시해줘" --permission-mode acceptEdits
```

무인 자동화(cron)는 `--permission-mode acceptEdits` 대신 `--dangerously-skip-permissions` 사용.
