#!/usr/bin/env node

/**
 * Test automation setup
 * Validates that all workflows are properly configured
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');

console.log('🔍 Automation Setup Validation\n');
console.log('═══════════════════════════════════════════════════════\n');

// 1. 워크플로우 파일 확인
console.log('✓ Checking workflow files...\n');

const workflows = [
  '.github/workflows/daily-news.yml',
  '.github/workflows/daily-news-update.yml',
];

let workflowsOk = true;
workflows.forEach((file) => {
  const fullPath = path.join(repoRoot, file);
  if (fs.existsSync(fullPath)) {
    console.log(`  ✅ ${file}`);
  } else {
    console.log(`  ❌ ${file} NOT FOUND`);
    workflowsOk = false;
  }
});

console.log();

// 2. 스크립트 파일 확인
console.log('✓ Checking script files...\n');

const scripts = [
  'scripts/crawl-news.mjs',
  'scripts/crawl-stocks.mjs',
  'scripts/update-ha-thai.mjs',
  'scripts/generate-insights.mjs',
];

let scriptsOk = true;
scripts.forEach((file) => {
  const fullPath = path.join(repoRoot, file);
  if (fs.existsSync(fullPath)) {
    console.log(`  ✅ ${file}`);
  } else {
    console.log(`  ❌ ${file} NOT FOUND`);
    scriptsOk = false;
  }
});

console.log();

// 3. 데이터 파일 확인
console.log('✓ Checking data files...\n');

const dataFiles = ['news.json', 'insights.json', 'stocks.json'];

let dataOk = true;
dataFiles.forEach((file) => {
  const fullPath = path.join(repoRoot, file);
  if (fs.existsSync(fullPath)) {
    try {
      const content = fs.readFileSync(fullPath, 'utf-8');
      JSON.parse(content);
      console.log(`  ✅ ${file}`);
    } catch (e) {
      console.log(`  ⚠️  ${file} (invalid JSON)`);
      dataOk = false;
    }
  } else {
    console.log(`  ❌ ${file} NOT FOUND`);
    dataOk = false;
  }
});

console.log();

// 4. 환경 변수 확인
console.log('✓ Checking environment...\n');

if (process.env.ANTHROPIC_API_KEY) {
  console.log(`  ✅ ANTHROPIC_API_KEY is set`);
  console.log(`     Key prefix: ${process.env.ANTHROPIC_API_KEY.substring(0, 10)}...`);
} else {
  console.log(`  ⚠️  ANTHROPIC_API_KEY not set`);
  console.log(`     Set it with: export ANTHROPIC_API_KEY="your-key"`);
}

if (process.version) {
  const nodeVersion = process.version.match(/v(\d+)/)[1];
  if (nodeVersion >= 20) {
    console.log(`  ✅ Node.js ${process.version} (v20+)`);
  } else {
    console.log(`  ⚠️  Node.js ${process.version} (need v20+)`);
  }
}

console.log();

// 5. 패키지 의존성 확인
console.log('✓ Checking npm packages...\n');

try {
  const packagePath = path.join(repoRoot, 'package.json');
  if (fs.existsSync(packagePath)) {
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
    console.log(`  ✅ package.json found`);

    if (pkg.dependencies && pkg.dependencies['@anthropic-ai/sdk']) {
      console.log(`  ✅ @anthropic-ai/sdk in dependencies`);
    } else {
      console.log(`  ⚠️  @anthropic-ai/sdk not in package.json`);
      console.log(`     Run: npm install @anthropic-ai/sdk`);
    }
  } else {
    console.log(`  ⚠️  package.json not found`);
    console.log(`     Run: npm init -y && npm install @anthropic-ai/sdk`);
  }
} catch (e) {
  console.log(`  ❌ Error checking package.json: ${e.message}`);
}

console.log();

// 6. 최종 결과
console.log('═══════════════════════════════════════════════════════\n');

const allOk = workflowsOk && scriptsOk && dataOk;

if (allOk && process.env.ANTHROPIC_API_KEY) {
  console.log('✅ All checks passed! Automation is ready.\n');
  console.log('Next steps:');
  console.log('  1. GitHub Actions will run automatically at 06:30 and 11:40 KST');
  console.log('  2. Or run manually: node scripts/update-ha-thai.mjs');
  console.log('  3. Monitor at: https://github.com/bizdevelopment1-max/ai/actions\n');
} else {
  console.log('⚠️  Some checks failed. Please fix the issues above.\n');
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('Critical: Set ANTHROPIC_API_KEY before running automation\n');
  }
}

// 7. 설정 정보 출력
console.log('📋 Automation Schedule:\n');
console.log('  ⏰ 06:30 KST - Daily AI News & Stocks Crawl');
console.log('     └─ scripts/crawl-news.mjs + crawl-stocks.mjs\n');
console.log('  ⏰ 11:40 KST - Daily Ha Thai & AI News Update');
console.log('     └─ scripts/update-ha-thai.mjs (includes insights)\n');
