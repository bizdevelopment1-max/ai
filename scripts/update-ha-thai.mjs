#!/usr/bin/env node

/**
 * Updates Ha Thai article summary in news.json
 * Fetches latest related AI news and adds to the feed
 * Uses Claude API via claude-sdk
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import Anthropic from '@anthropic-ai/sdk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const newsPath = path.join(__dirname, '../news.json');

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function updateHaThai() {
  console.log('📰 Starting Ha Thai article update...\n');

  // news.json 읽기
  const newsContent = fs.readFileSync(newsPath, 'utf-8');
  const news = JSON.parse(newsContent);

  // Ha Thai 기사 찾기
  const haThaiIndex = news.findIndex(
    (item) => item.title && item.title.includes('Ha Thai')
  );

  if (haThaiIndex === -1) {
    console.log('❌ Ha Thai article not found in news.json');
    return;
  }

  const haThai = news[haThaiIndex];
  console.log('✓ Found Ha Thai article:');
  console.log(`  Title: ${haThai.title}\n`);

  // Claude를 사용해 Ha Thai 기사 요약 수정
  console.log('🤖 Calling Claude to enhance Ha Thai summary...\n');

  const message = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 500,
    messages: [
      {
        role: 'user',
        content: `다음 뉴스 기사의 요약(summary)을 개선해줘.

제목: ${haThai.title}
현재 요약: ${haThai.summary}

요구사항:
1. 제목과 다른 핵심 내용 3줄 작성
2. Ha Thai의 경력 배경 (Meta에서의 역할)
3. OpenAI 장치 부서에서의 역할 중요성
4. 업계 영향 및 시사점

한국어로 작성하고, 정확하면서도 간결하게 (150자 이내)`,
      },
    ],
  });

  const newSummary =
    message.content[0].type === 'text' ? message.content[0].text : '';

  haThai.summary = newSummary.trim();
  haThai.needsLLM = false;

  console.log('✓ Ha Thai summary updated:');
  console.log(`  "${haThai.summary}"\n`);

  // 최신 관련 기사 검색 및 추가
  console.log('🔍 Fetching latest related AI news...\n');

  const relatedMessage = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 1500,
    messages: [
      {
        role: 'user',
        content: `2026년 6월 최신 AI 뉴스 중에서 다음과 관련된 기사 3-5개를 JSON 배열로 찾아줘:
- OpenAI 장치/하드웨어 관련
- Meta와 OpenAI 경쟁/협력
- AI 기업 인사 이동
- LLM 스타트업 투자 소식

각 기사는 다음 형식으로:
{
  "date": "2026-06-XX",
  "co": "회사명",
  "cat": "native/startup/bigtech",
  "source": "출처(Axios/Bloomberg/Reuters/TechCrunch 등)",
  "tag": "최신",
  "url": "실제 기사 링크(가능하면)",
  "title": "한글 제목",
  "titleEn": "English Title",
  "summary": "한글 요약 (제목과 다른 내용, 3줄)",
  "needsLLM": false
}

JSON 배열만 반환해줘 (마크다운 없이)`,
      },
    ],
  });

  const relatedNewsText =
    relatedMessage.content[0].type === 'text'
      ? relatedMessage.content[0].text
      : '[]';

  // JSON 파싱 (마크다운 코드블록이 있을 수 있으므로 제거)
  let relatedNews = [];
  try {
    const jsonMatch = relatedNewsText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      relatedNews = JSON.parse(jsonMatch[0]);
      console.log(`✓ Found ${relatedNews.length} related articles\n`);

      // 기존 뉴스와 중복 확인
      const existingTitles = new Set(news.map((n) => n.title));
      const newArticles = relatedNews.filter(
        (article) => !existingTitles.has(article.title)
      );

      if (newArticles.length > 0) {
        news.push(...newArticles);
        console.log(`✓ Added ${newArticles.length} new articles to news.json`);

        // 최신순 정렬 (날짜 기준)
        news.sort((a, b) => new Date(b.date) - new Date(a.date));
        console.log('✓ Sorted news by date (newest first)\n');
      } else {
        console.log('ℹ️  No new articles to add (all duplicates)\n');
      }
    }
  } catch (error) {
    console.error(
      '⚠️  Failed to parse related news JSON:',
      error.message,
      '\nContinuing with Ha Thai update only...\n'
    );
  }

  // news.json 저장
  fs.writeFileSync(newsPath, JSON.stringify(news, null, 2) + '\n');
  console.log('✅ news.json updated and saved');
}

// 실행
updateHaThai().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
