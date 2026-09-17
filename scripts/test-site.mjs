import fs from 'fs';
import path from 'path';

const ROOT_DIR = 'C:/Users/yutoi/Downloads/KyudoScoreManager_homepage';
const REQUIRED_FILES = [
  'index.html',
  'privacy.html',
  'terms.html',
  '404.html',
  'style.css',
  'script.js',
  'assets/site.webmanifest',
  'assets/sw.js',
  'assets/_headers',
  'assets/favicon.ico',
  'assets/sitemap.xml',
  'assets/robots.txt',
  'assets/og-image.png',
  'assets/icon-192.png',
  'assets/icon-512.png',
  'assets/qr_app.svg'
];

console.log('🔍 Running Comprehensive Site Integrity Test...\n');
let errors = 0;

// 1. 必須ファイル存在チェック
console.log('--- 1. Checking Required Files ---');
REQUIRED_FILES.forEach(file => {
  const fullPath = path.join(ROOT_DIR, file);
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ Missing required file: ${file}`);
    errors++;
  } else {
    console.log(`✅ Found: ${file}`);
  }
});

// 2. HTML ファイル検証
const htmlFiles = ['index.html', 'privacy.html', 'terms.html', '404.html'];

htmlFiles.forEach(file => {
  console.log(`\n--- 2. Validating ${file} ---`);
  const content = fs.readFileSync(path.join(ROOT_DIR, file), 'utf8');

  // JSON-LD 構文チェック
  const jsonLdRegex = /<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/g;
  let jsonMatch;
  let jsonCount = 0;
  while ((jsonMatch = jsonLdRegex.exec(content)) !== null) {
    jsonCount++;
    try {
      JSON.parse(jsonMatch[1]);
      console.log(`  ✅ JSON-LD #${jsonCount} parsed successfully`);
    } catch (e) {
      console.error(`  ❌ Invalid JSON-LD in ${file}: ${e.message}`);
      errors++;
    }
  }

  // 内部リンク切れチェック
  const linkRegex = /<a\s+[^>]*?href=["']([^"']+)["'][^>]*?>/g;
  let linkMatch;
  while ((linkMatch = linkRegex.exec(content)) !== null) {
    const href = linkMatch[1];
    if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('http')) continue;
    const filePart = href.split('#')[0].replace(/^\//, '');
    if (filePart && filePart !== '') {
      const targetPath = path.join(ROOT_DIR, filePart);
      if (!fs.existsSync(targetPath)) {
        console.error(`  ❌ Broken link in ${file}: ${href} (target ${targetPath} not found)`);
        errors++;
      }
    }
  }
});

console.log('\n========================================');
if (errors === 0) {
  console.log('🎉 ALL INTEGRITY TESTS PASSED! (0 errors)');
  process.exit(0);
} else {
  console.error(`❌ FAILED with ${errors} errors.`);
  process.exit(1);
}
