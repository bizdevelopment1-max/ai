# 누적 인텔리전스 자동 갱신 운영 지침

공개 화면의 기업·시장·기회·전략 내용은 소스 파일에 직접 작성하지 않습니다.
변동 사실은 수집 원장에 누적하고, 검증을 통과한 레코드만 생성 뷰로 발행합니다.

## 데이터 흐름

1. `config/dashboard-taxonomy.json`: 기업 ID, 분류, 화면 프레임 스키마만 보관
2. 수집 스크립트: 원문 URL, 발행일, 근거 문장, 수치 관측값 누적
3. 검증 스크립트: 출처 독립성, 수치 근거, 신선도, 공개 가능 여부 판정
4. `scripts/build-public-data.mjs`: 공개용 compact view와 `strategy-view.json` 생성
5. `scripts/build-browser-bundle.mjs`: 사실을 포함하지 않는 UI 번들 생성
6. 검토용 데이터 PR 승인 후 `main` 배포

## 수동으로 수정하지 않는 파일

- `overview-view.json`
- `strategy-view.json`
- `news-view.json`
- `market-view.json`
- `research-view.json`
- `data.bundle.js`
- `app.bundle.js`

정정이 필요하면 원문 근거·수집 정책·정규화 또는 검증 로직을 수정한 뒤 전체 생성 절차를 다시 실행합니다.

## 검증

```bash
node scripts/build-public-data.mjs
node scripts/build-browser-bundle.mjs
node scripts/test-visual-readability.mjs
node scripts/test-automation.mjs
node scripts/validate-data-contracts.mjs --stage=publish
node scripts/validate-data-boundaries.mjs
```

`strategy-view.json`은 `companies.json`, `news.json`, `mobile-ai-business-view.json`에서 매번 다시 생성되며 각 카드에 원문 URL과 데이터 계보를 포함해야 합니다.
