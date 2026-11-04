/**
 * ビルドのあとに dist/ を仕上げる（2026-11-04）。npm run build の中で、vite build のあと・check-build の前に走る。
 *
 * 1. Service Worker の事前の控えの一覧と控えの名前を、その回の束から作って dist/sw.js に書き込む
 *    前は sw.js に /style.css・/script.js を決め打ちしていた。ビルドで名前にハッシュが付くので本番ではどちらも 404 になり、
 *    cache.addAll が丸ごと失敗して、Service Worker が一度も入らなかった。
 *    控えの名前は一覧と中身の印から作るので、配り直すたびに新しい控えになり、古い控えは activate で消える。
 *
 * 2. ページの画像（/optimized/・/ogp.jpg など、名前にハッシュの入らないもの）の住所に中身の印 ?v= を付ける
 *    /optimized/* は 1 年・immutable で控えさせているので、撮り直した写真が、前に来た人には出ていなかった。
 *    印が変われば別の住所になり、すでに控えた端末にも新しい写真が届く。
 */
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import crypto from 'node:crypto';

const ここ = path.dirname(url.fileURLToPath(import.meta.url));
const 配信物 = path.join(ここ, '..', 'dist');
const ページたち = ['index.html', 'privacy.html', 'terms.html', '404.html'];

const 印 = (中身) => crypto.createHash('sha256').update(中身).digest('hex').slice(0, 10);
const 印の控え = new Map();
/** 配信物の中のファイルの中身の印（無ければ null） */
function ファイルの印(道) {
  const 素 = 道.split('?')[0].split('#')[0];
  if (印の控え.has(素)) return 印の控え.get(素);
  const 置き場 = path.join(配信物, decodeURIComponent(素).replace(/^\//, ''));
  const 値 = fs.existsSync(置き場) && fs.statSync(置き場).isFile() ? 印(fs.readFileSync(置き場)) : null;
  印の控え.set(素, 値);
  return 値;
}

/** 名前にハッシュの入らない、ページから指す画像・控え（vite の束 /assets/ はもう名前にハッシュがある） */
const 印を付けるか = (道) =>
  道.startsWith('/') && !道.startsWith('//') && !道.startsWith('/assets/') && !道.includes('?') &&
  /\.(png|jpe?g|webp|avif|svg|ico|gif)$/i.test(道);

/** 1 つの住所に印を付ける */
function 印を付ける(道) {
  if (!印を付けるか(道)) return 道;
  const 値 = ファイルの印(道);
  return 値 ? `${道}?v=${値}` : 道;
}

let 付けた数 = 0;
const 束たち = new Set();
for (const ページ of ページたち) {
  const 置き場 = path.join(配信物, ページ);
  if (!fs.existsSync(置き場)) continue;
  let 字 = fs.readFileSync(置き場, 'utf8');
  // src="…"・href="…"・content="…"（og:image など）・srcset="a 1x, b 2x"
  字 = 字.replace(/\b(src|href|content|poster)="([^"]+)"/g, (全部, 名, 値) => {
    const 新 = 印を付ける(値);
    if (新 !== 値) 付けた数++;
    return `${名}="${新}"`;
  });
  字 = 字.replace(/\bsrcset="([^"]+)"/g, (全部, 値) => {
    const 新 = 値
      .split(',')
      .map((一つ) => {
        const [道, ...残り] = 一つ.trim().split(/\s+/);
        const 新しい道 = 印を付ける(道);
        if (新しい道 !== 道) 付けた数++;
        return [新しい道, ...残り].join(' ');
      })
      .join(', ');
    return `srcset="${新}"`;
  });
  fs.writeFileSync(置き場, 字);
  // 事前に控える束（そのページが読む CSS と module の JS）
  for (const 合う of 字.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="(\/assets\/[^"]+\.css)"/g)) 束たち.add(合う[1]);
  for (const 合う of 字.matchAll(/<link[^>]+href="(\/assets\/[^"]+\.css)"[^>]+rel="stylesheet"/g)) 束たち.add(合う[1]);
  for (const 合う of 字.matchAll(/<script[^>]+type="module"[^>]+src="(\/assets\/[^"]+\.js)"/g)) 束たち.add(合う[1]);
}

// CSS の中の url(/optimized/…) にも印を付ける（背景の写真）
for (const 束 of fs.readdirSync(path.join(配信物, 'assets')).filter((名) => 名.endsWith('.css'))) {
  const 置き場 = path.join(配信物, 'assets', 束);
  const 字 = fs.readFileSync(置き場, 'utf8').replace(/url\((["']?)(\/[^)"']+)\1\)/g, (全部, 括り, 道) => {
    const 新 = 印を付ける(道);
    if (新 !== 道) 付けた数++;
    return `url(${括り}${新}${括り})`;
  });
  fs.writeFileSync(置き場, 字);
}

// Service Worker の一覧（ページ・その回の束・いちばん上の写真）。写真は ?v= の付いた住所で
const 一覧 = [
  '/',
  ...ページたち.map((ページ) => '/' + ページ),
  ...[...束たち].sort(),
  '/site.webmanifest',
  印を付ける('/ogp.jpg'),
  印を付ける('/optimized/hero_bg.webp'),
].filter((道, 番, 全部) => 全部.indexOf(道) === 番);
const 控えの名前 = 'kyudo-hp-' + 印(一覧.join('\n') + 一覧.map((道) => ファイルの印(道) || '').join(''));
const swの置き場 = path.join(配信物, 'sw.js');
let sw = fs.readFileSync(swの置き場, 'utf8');
const 前 = sw;
sw = sw.replace(/const CACHE_NAME = '[^']*';/, `const CACHE_NAME = '${控えの名前}';`);
sw = sw.replace(/const PRECACHE_URLS = \[[^\]]*\];/, `const PRECACHE_URLS = ${JSON.stringify(一覧)};`);
if (sw === 前) {
  console.error('停止：dist/sw.js の CACHE_NAME・PRECACHE_URLS を書き換えられませんでした（形が変わった？）');
  process.exit(1);
}
fs.writeFileSync(swの置き場, sw);
console.log(`仕上げ：画像の住所 ${付けた数} か所に中身の印・Service Worker の控え ${控えの名前}（${一覧.length} 件）`);
