#!/usr/bin/env node

/**
 * Generates AI insights from latest news articles
 * Creates structured insights with headlines, root causes, and recommendations
 * Stores in insights.json
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import Anthropic from '@anthropic-ai/sdk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const newsPath = path.join(__dirname, '../news.json');
const insightsPath = path.join(__dirname, '../insights.json');

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// 최근 뉴스만 선택 (지난 7일)
function getRecentNews(news) {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  return news.filter((article) => {
    const articleDate = new Date(article.date);
    return articleDate >= sevenDaysAgo;
  });
}

async function generateInsights() {
  console.log('🔍 Generating insights from latest news...\n');

  // news.json 읽기
  const newsContent = fs.readFileSync(newsPath, 'utf-8');
  const news = JSON.parse(newsContent);

  // 최근 뉴스만 선택
  const recentNews = getRecentNews(news);
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
  let newInsights = [];
  try {
    const jsonMatch = insightText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      newInsights = JSON.parse(jsonMatch[0]);
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
generateInsights().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
