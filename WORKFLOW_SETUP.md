# 🤖 자동화 워크플로우 설정 가이드

## 📋 현재 구성

### 자동 실행 일정

| 시간 | 워크플로우 | 작업 | 파일 |
|------|-----------|------|------|
| **06:30 KST** | Daily AI News & Stocks Crawl | 뉴스/주식 크롤링 | `.github/workflows/daily-news.yml` |
| **11:40 KST** | Daily Ha Thai & AI News Update | Ha Thai 업데이트 + 인사이트 생성 | `.github/workflows/daily-news-update.yml` |

---

## ✅ GitHub Actions 자동화 (클라우드)

### 1️⃣ 프리레퀴짓

**GitHub Secrets 설정**
```bash
# GitHub 저장소 → Settings → Secrets and variables → Actions
# 다음을 추가해야 함:
- ANTHROPIC_API_KEY: (당신의 API 키)
```

### 2️⃣ 워크플로우 파일

```yaml
# .github/workflows/daily-news.yml (06:30 KST)
# - 이미 존재함
# - scripts/crawl-news.mjs 실행

# .github/workflows/daily-news-update.yml (11:40 KST)
# - 새로 추가됨
# - scripts/update-ha-thai.mjs 실행 (인사이트 생성 포함)
```

### 3️⃣ 수동 트리거 (즉시 실행)

GitHub 웹에서:
```
저장소 → Actions → Daily Ha Thai & AI News Update → Run workflow
```

또는 CLI:
```bash
gh workflow run daily-news-update.yml -f
```

### 4️⃣ 모니터링

```bash
# 워크플로우 실행 상태 확인
gh run list --workflow daily-news-update.yml

# 최신 실행 상세 보기
gh run view --log

# 실시간 로그
gh run watch
```

---

## 💻 로컬 CLI로 LLM 활용 (다른 PC에서)

### 1️⃣ 저장소 클론

```bash
# 첫 번째 PC
git clone https://github.com/bizdevelopment1-max/ai.git
cd ai

# 또는 이미 클론된 경우 최신 상태 동기화
git pull --rebase origin main
```

### 2️⃣ 환경 설정

```bash
# Node.js 20 이상 설치 확인
node --version

# 의존성 설치
npm install @anthropic-ai/sdk

# API 키 설정
export ANTHROPIC_API_KEY="your-api-key-here"
```

### 3️⃣ 수동 실행 (Claude CLI 활용)

**Ha Thai 기사 + 인사이트 자동 생성:**
```bash
cd ~/ai
node scripts/update-ha-thai.mjs
```

**인사이트만 생성:**
```bash
cd ~/ai
node scripts/generate-insights.mjs
```

**뉴스 크롤링 (필요시):**
```bash
cd ~/ai
node scripts/crawl-news.mjs
```

### 4️⃣ Claude 명령어로 직접 LLM 활용

**Ha Thai 기사 개선:**
```bash
claude -p "
news.json 파일을 읽고 Ha Thai 기사(2026-06-18)의 summary를 다음과 같이 수정해줘:
1. 제목과 다른 핵심 내용 3줄
2. Ha Thai의 경력 배경
3. OpenAI에서의 역할
4. 업계 영향

수정된 JSON만 반환해줘.
" --model opus-4-8
```

**최신 뉴스 검색:**
```bash
claude -p "
2026년 6월 최신 AI 뉴스 중 다음과 관련된 기사를 찾아줘:
- OpenAI 장치/하드웨어
- Meta-OpenAI 경쟁
- AI 기업 인사 이동

각 기사를 JSON 배열로 반환 (date, title, titleEn, summary, source, url)
" --model opus-4-8
```

**인사이트 생성:**
```bash
claude -p "
다음 뉴스 목록을 기반으로 전략적 인사이트 3-5개를 생성해줘:

뉴스 목록:
$(cat news.json | jq -r '.[] | select(.date > \"2026-06-19\") | \"- \(.title) (\(.date), \(.source))\"' 2>/dev/null)

JSON 배열로 반환 (axis, headline, rootCause, soWhat, evidence, score)
" --model opus-4-8
```

---

## 🔄 다중 PC 협업 가이드

### 시나리오: PC A (이 PC)에서 설정, PC B (다른 PC)에서 검증

**PC A (현재 당신의 PC):**
```bash
# 1. 워크플로우 파일 생성 및 커밋
cd ~/ai
git add .github/workflows/daily-news-update.yml scripts/update-ha-thai.mjs
git commit -m "feat: daily automation setup"
git push origin main

# 2. GitHub Actions 실행 확인
gh run list --workflow daily-news-update.yml
```

**PC B (다른 PC):**
```bash
# 1. 저장소 클론
git clone https://github.com/bizdevelopment1-max/ai.git
cd ai

# 2. 최신 워크플로우 파일 확인
cat .github/workflows/daily-news-update.yml

# 3. 로컬에서 스크립트 테스트
export ANTHROPIC_API_KEY="your-api-key"
node scripts/update-ha-thai.mjs

# 4. 결과 확인
git diff news.json insights.json

# 5. 문제 발생 시 로그 분석
node scripts/update-ha-thai.mjs 2>&1 | tee output.log
```

### 문제 발생 시 처리

**PC B에서 디버깅:**
```bash
# 1. 에러 로그 저장
node scripts/update-ha-thai.mjs > debug.log 2>&1

# 2. 부분별 테스트
# - news.json 읽기 확인
node -e "console.log(JSON.stringify(require('./news.json'), null, 2))"

# 3. API 연결 테스트
export ANTHROPIC_API_KEY="test-key"
node -e "const Anthropic = require('@anthropic-ai/sdk'); console.log(new Anthropic())"

# 4. 문제 리포트
git add debug.log
git commit -m "debug: workflow issue on PC B"
git push origin main
```

**PC A에서 검증:**
```bash
# 푸시된 debug.log 확인
cat debug.log

# 또는 Claude로 분석
claude -p "
다음 에러 로그를 분석하고 해결 방법을 제시해줘:

$(cat debug.log)
" --model opus-4-8
```

---

## 🛠️ 트러블슈팅

### 워크플로우가 실행되지 않는 경우

**확인 사항:**
1. GitHub Secrets에 `ANTHROPIC_API_KEY` 설정됨?
2. 워크플로우 파일이 `.github/workflows/` 디렉토리에 있나?
3. 워크플로우 파일의 YAML 구문이 올바른가?

**해결:**
```bash
# 워크플로우 파일 검증
gh workflow list

# 활성화 확인
gh workflow view daily-news-update.yml

# 수동 실행 테스트
gh workflow run daily-news-update.yml -f
```

### 스크립트 실행 오류

**1. 의존성 부재:**
```bash
npm install @anthropic-ai/sdk
```

**2. API 키 누락:**
```bash
export ANTHROPIC_API_KEY="your-key"
node scripts/update-ha-thai.mjs
```

**3. 파일 경로 오류:**
```bash
# 스크립트 위치 확인
ls -la scripts/update-ha-thai.mjs

# 절대 경로로 실행
node ~/ai/scripts/update-ha-thai.mjs
```

---

## 📊 최종 상태

✅ **GitHub Actions**: 클라우드에서 자동 실행 (06:30, 11:40 KST)
✅ **로컬 스크립트**: 언제든 수동 실행 가능
✅ **CLI 명령어**: 즉시 개별 작업 실행 가능
✅ **다중 PC**: 어디서든 클론 후 실행 가능

---

## 🚀 빠른 시작 (다른 PC)

```bash
# 1. 저장소 가져오기
git clone https://github.com/bizdevelopment1-max/ai.git
cd ai

# 2. 환경 설정
export ANTHROPIC_API_KEY="your-key"
npm install @anthropic-ai/sdk

# 3. 즉시 실행
node scripts/update-ha-thai.mjs
```

끝!
