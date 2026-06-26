# 🤖 AI 뉴스 대시보드 - 완전 자동화 설정 완료

**상태:** ✅ GitHub Actions 워크플로우 전체 준비 완료
**마지막 업데이트:** 2026-06-26
**저장소:** https://github.com/bizdevelopment1-max/ai

---

## 📋 설정 완료 항목

### ✅ 워크플로우 생성
- [x] `.github/workflows/daily-news.yml` - 06:30 KST 뉴스/주식 크롤
- [x] `.github/workflows/daily-news-update.yml` - 11:40 KST Ha Thai 업데이트 + 인사이트

### ✅ 스크립트 작성
- [x] `scripts/crawl-news.mjs` - AI 뉴스 크롤링
- [x] `scripts/crawl-stocks.mjs` - 주식 정보 크롤링  
- [x] `scripts/update-ha-thai.mjs` - Ha Thai 기사 + 인사이트 자동 생성
- [x] `scripts/generate-insights.mjs` - 인사이트 생성 전용
- [x] `scripts/test-automation.mjs` - 자동화 설정 검증

### ✅ 설정 파일
- [x] `package.json` - npm 스크립트 및 의존성
- [x] `node_modules/` - @anthropic-ai/sdk 설치 완료

### ✅ 문서 작성
- [x] `WORKFLOW_SETUP.md` - 로컬 및 다중 PC 설정 가이드
- [x] `GITHUB_ACTIONS_SETUP.md` - GitHub Actions 테스트 및 트러블슈팅
- [x] `AUTOMATION_SUMMARY.md` - 최종 요약 (현재 문서)

### ⏳ 남은 작업 (필수)
- [ ] GitHub Secrets에 `ANTHROPIC_API_KEY` 설정

---

## 🚀 지금 바로 시작하기

### 1단계: GitHub Secrets 설정 (5분)

```
저장소 → Settings → Secrets and variables → Actions
→ New repository secret
→ ANTHROPIC_API_KEY = sk-ant-...
→ Add secret
```

### 2단계: 자동화 검증

```bash
cd ~/ai
npm run test:automation
```

**예상 출력:**
```
✅ All checks passed! Automation is ready.
```

### 3단계: 워크플로우 수동 실행 (테스트)

```bash
# CLI로 즉시 실행
gh workflow run daily-news-update.yml --ref main

# 또는 웹에서
# 저장소 → Actions → Daily Ha Thai & AI News Update → Run workflow
```

### 4단계: 결과 확인

```bash
# 실행 로그 확인
gh run view --log

# 또는 웹에서
# 저장소 → Actions → 최신 실행 확인
```

---

## 📅 자동 실행 일정

| 시간 | 타임존 | 작업 | 파일 | 빈도 |
|------|--------|------|------|------|
| **06:30** | KST | 뉴스 크롤링 + 주식 업데이트 | `daily-news.yml` | 매일 |
| **11:40** | KST | Ha Thai + 인사이트 | `daily-news-update.yml` | 매일 |

**UTC 시간:**
- 06:30 KST = 21:30 UTC (전날)
- 11:40 KST = 02:40 UTC

---

## 💻 다중 PC 협업 가이드

### PC A (현재 - 당신의 PC)
✅ 워크플로우 설정 완료
✅ 모든 스크립트 생성 완료
⏳ GitHub Secrets 설정만 필요

**다음 단계:**
```bash
# 1. GitHub Secrets 설정 (웹에서)
# 2. 워크플로우 수동 실행 테스트
gh workflow run daily-news-update.yml --ref main

# 3. 결과 확인
gh run view --log
```

### PC B (다른 PC에서)
**처음 설정할 때:**

```bash
# 1. 저장소 클론
git clone https://github.com/bizdevelopment1-max/ai.git
cd ai

# 2. 의존성 설치
npm install

# 3. API 키 설정
export ANTHROPIC_API_KEY="sk-ant-..."

# 4. 자동화 검증
npm run test:automation

# 5. 즉시 실행
npm run update:news
```

**이미 클론된 경우:**

```bash
cd ~/ai

# 최신 코드 가져오기
git pull --rebase origin main

# 의존성 업데이트
npm install

# 스크립트 실행
npm run update:news
```

---

## 🔧 NPM 스크립트 커맨드

```bash
# 자동화 설정 검증
npm run test:automation

# Ha Thai 기사 + 인사이트 생성
npm run update:news

# 인사이트만 생성
npm run generate:insights

# 뉴스 크롤링
npm run crawl:news

# 주식 정보 크롤링
npm run crawl:stocks
```

---

## 🛠️ CLI로 LLM 활용 (Claude)

**직접 명령어로 분석하기:**

```bash
# Ha Thai 기사 개선 제안
claude -p "
news.json의 Ha Thai 기사를 분석하고 요약을 개선해줘.
현재 문제: 제목과 요약이 동일
개선안: 경력 배경, OpenAI 역할, 업계 영향 (3줄)
" --model opus-4-8

# 최신 AI 뉴스 요약
claude -p "
다음 뉴스에서 중요한 인사이트 3개를 추출해줘:

$(cat news.json | jq -r '.[] | select(.date > \"2026-06-20\") | \"- \(.title)\"')

형식: JSON 배열 (headline, rootCause, soWhat)
" --model opus-4-8

# 인사이트 생성 검증
claude -p "
다음 인사이트들이 전략적으로 의미 있는가?

$(cat insights.json | jq -r '.cards[] | \"- \(.headline) (score: \(.score))\"')

평가: 유효성, 중요도, 개선안
" --model opus-4-8
```

---

## 📊 모니터링

### 웹 대시보드
```
https://github.com/bizdevelopment1-max/ai/actions
```

### CLI 모니터링
```bash
# 워크플로우 목록
gh workflow list

# 최근 실행 확인
gh run list --workflow daily-news-update.yml -L 10

# 실시간 모니터링
gh run watch

# 로그 확인
gh run view <RUN_ID> --log
```

### Git 로그 확인
```bash
# 자동 커밋 기록
git log --oneline --grep="chore: update" -10

# 변경 사항 확인
git log -p news.json -1
```

---

## 🚨 트러블슈팅

### 워크플로우가 실행되지 않음

**1. GitHub Secrets 확인**
```bash
# 설정 확인
https://github.com/bizdevelopment1-max/ai/settings/secrets/actions
```

**2. 워크플로우 파일 확인**
```bash
cat .github/workflows/daily-news-update.yml | grep -A 5 "permissions:"
# 출력에 "contents: write"가 있는지 확인
```

**3. 수동 실행 테스트**
```bash
gh workflow run daily-news-update.yml --ref main -v
```

### 스크립트 실행 오류

**1. API 키 설정 확인**
```bash
echo $ANTHROPIC_API_KEY
# 값이 보이면 OK
```

**2. 의존성 확인**
```bash
npm install
npm list @anthropic-ai/sdk
```

**3. 스크립트 직접 실행**
```bash
node scripts/update-ha-thai.mjs 2>&1 | tee debug.log

# 에러 분석
claude -p "$(cat debug.log)" --model opus-4-8
```

---

## 📈 성공 지표

자동화가 정상 작동하면:

✅ GitHub Actions에서 초록색 체크 마크
✅ 매일 06:30, 11:40에 자동 커밋
✅ `news.json` 자동 업데이트
✅ `insights.json` 자동 생성
✅ 웹사이트에 최신 뉴스/인사이트 표시

---

## 🎯 다음 단계

### 즉시 (오늘)
1. GitHub Secrets에 `ANTHROPIC_API_KEY` 설정
2. 워크플로우 수동 실행 테스트
3. `npm run test:automation` 검증

### 단기 (1주)
1. 자동 워크플로우 정상 작동 확인
2. 뉴스/인사이트 품질 검토
3. 필요시 프롬프트 조정

### 장기 (지속)
1. 매일 06:30, 11:40 자동 실행
2. 웹사이트 대시보드 업데이트
3. 정기적 품질 모니터링

---

## 📞 빠른 참조

| 상황 | 명령어 |
|------|--------|
| 설정 검증 | `npm run test:automation` |
| 즉시 업데이트 | `npm run update:news` |
| 워크플로우 실행 | `gh workflow run daily-news-update.yml --ref main` |
| 로그 확인 | `gh run view --log` |
| 최근 커밋 | `git log --oneline -5` |
| 변경사항 확인 | `git diff HEAD~1 news.json` |

---

## 🎉 완료!

모든 자동화 설정이 준비되었습니다.

**남은 작업:** GitHub Secrets에 API 키 설정 (5분)

그 다음은 모든 것이 **자동으로 작동**합니다! 🚀

---

**문서:**
- 📖 [로컬 & 다중 PC 설정](WORKFLOW_SETUP.md)
- 📖 [GitHub Actions 테스트 & 트러블슈팅](GITHUB_ACTIONS_SETUP.md)
- 📖 [이 문서 - 최종 요약](AUTOMATION_SUMMARY.md)

**저장소:**
https://github.com/bizdevelopment1-max/ai
