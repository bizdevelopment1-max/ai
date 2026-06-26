# 🚀 GitHub Actions 워크플로우 설정 & 테스트 가이드

## ✅ 현재 상태

✅ 모든 워크플로우 파일 생성 완료
✅ 모든 스크립트 생성 완료
✅ `package.json` 생성 및 의존성 설치 완료
⏳ GitHub Secrets 설정 필요 (ANTHROPIC_API_KEY)

---

## 🔑 GitHub Secrets 설정 (필수)

워크플로우가 Claude API를 사용하기 위해 필수입니다.

### 단계 1: GitHub 저장소 접속
```
https://github.com/bizdevelopment1-max/ai
```

### 단계 2: Settings → Secrets and variables → Actions
```
저장소 → Settings → Secrets and variables → Actions → New repository secret
```

### 단계 3: 다음 정보 입력

| Key | Value |
|-----|-------|
| `ANTHROPIC_API_KEY` | `sk-ant-...` (당신의 API 키) |

**저장**을 클릭합니다.

---

## 🧪 워크플로우 테스트 (웹)

### 1️⃣ 자동 테스트 - 수동 트리거

GitHub 웹에서:
```
저장소 → Actions → Daily Ha Thai & AI News Update → Run workflow → Run workflow
```

또는 CLI:
```bash
gh workflow run daily-news-update.yml --ref main
```

### 2️⃣ 실행 결과 확인

```bash
# 최신 실행 목록
gh run list --workflow daily-news-update.yml --limit 5

# 최신 실행 상세 보기
gh run view --log

# 실시간 모니터링
gh run watch
```

---

## 💻 로컬 테스트 (CLI)

### 1️⃣ API 키 설정

```bash
# 임시로 설정 (현재 세션에만)
export ANTHROPIC_API_KEY="sk-ant-..."

# 또는 영구적으로 설정 (권장)
# Windows PowerShell:
$env:ANTHROPIC_API_KEY = "sk-ant-..."

# macOS/Linux:
echo 'export ANTHROPIC_API_KEY="sk-ant-..."' >> ~/.bashrc
source ~/.bashrc
```

### 2️⃣ 자동화 상태 검증

```bash
cd ~/ai
npm run test:automation
```

**출력 예:**
```
✅ All checks passed! Automation is ready.

Next steps:
  1. GitHub Actions will run automatically at 06:30 and 11:40 KST
  2. Or run manually: node scripts/update-ha-thai.mjs
  3. Monitor at: https://github.com/bizdevelopment1-max/ai/actions
```

### 3️⃣ 개별 스크립트 테스트

**Ha Thai 기사 + 인사이트 업데이트:**
```bash
npm run update:news
```

**인사이트만 생성:**
```bash
npm run generate:insights
```

**뉴스 크롤링:**
```bash
npm run crawl:news
```

**주식 정보 크롤링:**
```bash
npm run crawl:stocks
```

---

## 📊 워크플로우 상세 정보

### Workflow 1: Daily AI News & Stocks Crawl

**파일:** `.github/workflows/daily-news.yml`

```yaml
# 실행 일정
- 매일 06:30 KST (UTC 21:30)

# 수행 작업
- scripts/crawl-news.mjs 실행
- scripts/crawl-stocks.mjs 실행
- news.json + stocks.json 자동 커밋

# 필요한 Secret
- ANTHROPIC_API_KEY
```

### Workflow 2: Daily Ha Thai & AI News Update

**파일:** `.github/workflows/daily-news-update.yml`

```yaml
# 실행 일정
- 매일 11:40 KST (UTC 02:40)

# 수행 작업
- scripts/update-ha-thai.mjs 실행
  ├── Ha Thai 기사 요약 자동 개선
  ├── 최신 관련 뉴스 3-5개 추가
  └── 전략 인사이트 3-5개 생성
- news.json + insights.json 자동 커밋

# 필요한 Secret
- ANTHROPIC_API_KEY
```

---

## 🔍 트러블슈팅

### 문제 1: 워크플로우가 실행되지 않음

**원인:** GitHub Secrets에 API 키가 없음

**해결:**
```bash
# 1. 저장소 설정에서 Secrets 확인
https://github.com/bizdevelopment1-max/ai/settings/secrets/actions

# 2. ANTHROPIC_API_KEY 추가 확인
# 3. 워크플로우 수동 실행
gh workflow run daily-news-update.yml --ref main
```

### 문제 2: 스크립트가 실행되지만 결과가 저장되지 않음

**원인:** git 설정 문제 또는 워크플로우 권한 부재

**확인:**
```bash
# 워크플로우 파일의 permissions 확인
cat .github/workflows/daily-news-update.yml | grep -A 5 "permissions:"

# 출력 예:
# permissions:
#   contents: write  <-- 이게 있어야 함
```

**해결:**
```yaml
# .github/workflows/daily-news-update.yml에서 확인
permissions:
  contents: write  # ← 이 줄이 있는지 확인
```

### 문제 3: API 호출 실패

**원인:** API 키 만료 또는 잘못된 키

**해결:**
```bash
# 1. API 키 유효성 확인
curl -H "x-api-key: $ANTHROPIC_API_KEY" \
  https://api.anthropic.com/v1/models

# 2. Secrets 업데이트
gh secret set ANTHROPIC_API_KEY --body "sk-ant-new-key"
```

---

## 📈 모니터링

### GitHub Actions 대시보드

```
저장소 → Actions → 워크플로우 선택
```

### CLI로 모니터링

```bash
# 모든 워크플로우 목록
gh workflow list

# 특정 워크플로우 실행 목록
gh run list --workflow daily-news-update.yml

# 최신 실행 상태
gh run view --log

# 실시간 모니터링
gh run watch
```

### 로컬 로그 확인

```bash
# 최근 커밋 메시지 확인
git log --oneline -10

# 변경된 파일 확인
git show --stat HEAD

# 실제 변경사항 확인
git diff HEAD~1 news.json | head -50
```

---

## 🎯 완전 자동화 체크리스트

- [ ] GitHub Secrets에 `ANTHROPIC_API_KEY` 설정
- [ ] `.github/workflows/daily-news-update.yml` 파일 존재
- [ ] `scripts/update-ha-thai.mjs` 파일 존재
- [ ] `package.json` 파일 존재
- [ ] `npm install` 실행 완료
- [ ] `npm run test:automation` 통과
- [ ] 웹에서 워크플로우 수동 실행 성공
- [ ] news.json 또는 insights.json 파일이 자동 업데이트됨
- [ ] GitHub 커밋 로그에 자동 커밋 기록 있음

모두 체크되면 **완전 자동화 완료!** ✅

---

## 🚀 다른 PC에서 설정

**PC B에서:**

```bash
# 1. 저장소 클론
git clone https://github.com/bizdevelopment1-max/ai.git
cd ai

# 2. 최신 워크플로우 파일 확인
cat .github/workflows/daily-news-update.yml

# 3. 의존성 설치
npm install

# 4. API 키 설정
export ANTHROPIC_API_KEY="sk-ant-..."

# 5. 자동화 상태 검증
npm run test:automation

# 6. 스크립트 테스트
npm run update:news
```

---

## 📞 빠른 참조

| 명령어 | 목적 |
|--------|------|
| `npm run test:automation` | 설정 검증 |
| `npm run update:news` | Ha Thai + 인사이트 업데이트 |
| `npm run generate:insights` | 인사이트만 생성 |
| `npm run crawl:news` | 뉴스 크롤링 |
| `gh run list` | 워크플로우 실행 목록 |
| `gh run view --log` | 최신 실행 로그 |
| `gh workflow run daily-news-update.yml` | 워크플로우 수동 실행 |

---

## 🎉 성공 신호

자동화가 제대로 작동하면:

1. ✅ GitHub Actions 대시보드에 초록색 체크 마크
2. ✅ 매일 06:30, 11:40에 자동 커밋
3. ✅ `news.json`과 `insights.json` 파일이 업데이트됨
4. ✅ 웹사이트에 최신 뉴스와 인사이트가 표시됨

완료! 🚀
