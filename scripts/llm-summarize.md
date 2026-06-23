# 다른 PC의 Claude Code CLI로 뉴스 3줄 인사이트 요약하기

이 저장소의 `news.json` 기사 요약을 **고품질 3줄 한국어 인사이트**로 채우는 작업입니다.
GitHub Action 크롤러는 원문(영문) 재료만 채워두고(`titleEn`, `descEn`), 요약이 빈약하면
`needsLLM: true`로 표시합니다. 이 표시가 있는 기사를 Claude가 다시 요약합니다.

## 사용법 (다른 PC에서)

```bash
git pull
claude   # Claude Code CLI 실행 후 아래 프롬프트 붙여넣기
```

## 붙여넣을 프롬프트

```
news.json을 열어 "needsLLM": true 인 기사(또는 summary가 3줄 미만인 기사)를 모두 처리해줘.

각 기사에 대해:
1) descEn(원문 영문 본문)과 titleEn(원문 제목)을 근거로, 필요하면 url을 WebFetch해 본문을 보강해.
2) summary를 "정확히 3줄, 한국어 개조식"으로 다시 써:
   - 1줄: 핵심 사실(무슨 일이 일어났나)
   - 2줄: 수치·배경(가능하면 구체 수치, 없으면 맥락)
   - 3줄: 온디바이스 AI·AI 에이전트·스마트폰/노트북 단말 사업 관점의 '시사점'
   - 각 줄은 "· "로 시작, 명사형 종결("~함/~음/~임/~필요" 등). 마침표 없이.
   - 매체명/출처를 본문에 쓰지 말 것(출처는 별도 메타로 표시됨).
   - 특정 회사명(삼성·MX·갤럭시 등)을 시사점에 쓰지 말 것.
3) 처리한 기사는 "needsLLM"를 false로 바꿔.
4) descEn/titleEn은 그대로 두고 summary와 needsLLM만 갱신해. title(한국어 제목)이 어색하면 자연스럽게 다듬어도 됨.

모두 끝나면 news.json만 커밋하고 푸시해:
  git add news.json && git commit -m "chore: LLM 3줄 인사이트 요약(local Claude CLI)" && git push
```

## 동작 원리 / 안전장치

- 크롤러(Action)는 매일 raw 기사를 모으고, 3줄 이상 좋은 요약은 **재사용**(덮어쓰지 않음)합니다.
  따라서 이 CLI가 만든 3줄 요약은 다음 크롤에서도 보존됩니다.
- API 키 없이도 동작: 이 작업은 **로컬 Claude(구독)** 로 수행되므로 GitHub Action에 키가 없어도 됩니다.
- 자동화하려면 다른 PC에서 cron + `claude -p "<위 프롬프트>"`(헤드리스) 로 주기 실행하면 됩니다.
