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
  console.log('✅ news.json updated and saved\n');

  // 인사이트 생성
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  await generateInsights(news);
}

async function generateInsights(news) {
  console.log('🔍 Generating insights from latest news...\n');

  const insightsPath = path.join(__dirname, '../insights.json');

  // 최근 뉴스만 선택 (지난 7일)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const recentNews = news.filter((article) => {
    const articleDate = new Date(article.date);
    return articleDate >= sevenDaysAgo;
  });

  console.log(`✓ Found ${recentNews.length} recent articles (last 7 days)\n`);

  if (recentNews.length === 0) {
    console.log('ℹ️  No recent articles to generate insights from');
    return;
  }

  // 뉴스를 텍스트로 변환
  const newsText = recentNews
    .map(
      (n) =>
        `- "${n.title}" (${n.date}, ${n.source})\n  Summary: ${n.summary}`
    )
    .join('\n\n');

  // Claude를 사용해 인사이트 생성
  console.log('🤖 Calling Claude to generate strategic insights...\n');

  const message = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: `다음은 최근 AI 뉴스입니다. 이를 기반으로 전략적 인사이트를 3-5개 생성해줘.

뉴스:
${newsText}

각 인사이트는 JSON 객체로, 다음 구조를 따라야 해:
{
  "axis": "theme키(예: assistant_layer, ondevice_spec, monetization, agent_reliability 등)",
  "axisLabel": "주제 한글명",
  "tone": "signal/warn/revenue/compete 중 하나 (긍정/경고/수익/경쟁)",
  "nav": "bigtech/startup/native/bizmodel/signals 중 하나",
  "headline": "3-5단어 주요 뉴스 헤드라인",
  "rootCause": "근본 원인: 왜 이 뉴스가 중요한가? (1줄)",
  "soWhat": "그래서 뭐?: 자사 비즈니스에 미치는 영향 (1-2줄)",
  "evidence": [
    {
      "title": "출처 기사 제목",
      "date": "YYYY-MM-DD",
      "source": "출처 매체명",
      "url": "기사 링크"
    }
  ],
  "score": 30-100 (중요도 점수),
  "live": true,
  "updatedAt": "YYYY-MM-DD"
}

반드시 JSON 배열로 반환해줘 (다른 텍스트 없이).`,
      },
    ],
  });

  const insightText =
    message.content[0].type === 'text' ? message.content[0].text : '[]';

  // JSON 파싱
  try {
    const jsonMatch = insightText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const newInsights = JSON.parse(jsonMatch[0]);
      console.log(`✓ Generated ${newInsights.length} insights\n`);

      // 기존 insights 읽기
      let existingInsights = { generatedAt: new Date().toISOString(), engine: 'rules', cards: [] };
      if (fs.existsSync(insightsPath)) {
        const existingContent = fs.readFileSync(insightsPath, 'utf-8');
        existingInsights = JSON.parse(existingContent);
      }

      // 새 인사이트와 기존 인사이트 병합 (중복 제거)
      const existingHeadlines = new Set(existingInsights.cards.map((c) => c.headline));
      const uniqueNewInsights = newInsights.filter(
        (insight) => !existingHeadlines.has(insight.headline)
      );

      if (uniqueNewInsights.length > 0) {
        // 최신 인사이트를 앞에 추가
        existingInsights.cards = [...uniqueNewInsights, ...existingInsights.cards];

        // 최대 10개까지만 유지
        if (existingInsights.cards.length > 10) {
          existingInsights.cards = existingInsights.cards.slice(0, 10);
        }

        existingInsights.generatedAt = new Date().toISOString();

        // insights.json 저장
        fs.writeFileSync(insightsPath, JSON.stringify(existingInsights, null, 2) + '\n');
        console.log(`✓ Added ${uniqueNewInsights.length} new insights to insights.json`);
        console.log(`  Total insights: ${existingInsights.cards.length}/10\n`);
      } else {
        console.log('ℹ️  No new unique insights to add\n');
      }
    }
  } catch (error) {
    console.error('⚠️  Failed to parse insights JSON:', error.message);
  }

  console.log('✅ Insights generation completed');
}

// 실행
updateHaThai().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
