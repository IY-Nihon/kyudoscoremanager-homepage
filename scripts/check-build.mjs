/**
 * 配る直前に、ビルドした dist/ を実際のブラウザで開いて確かめる。
 *
 *   npm run check          （dist/ を作ってから走らせる）
 *
 * ■ なぜこの検査が要るか
 *
 * 2026-09-05、公開中のサイトで写真10枚（分析・履歴・設定・AIなど）が
 * 空白のままになっていた。原因は2つ重なっていた。
 *
 *   1. vite.config.js の input に script.js を入口として書いていた。
 *      各 HTML は <script type="module" src="/script.js"> で読んでおり、
 *      vite が自動で束ねる。そこへ入口として足すと HTML と結び付かない
 *      孤立した束ができ、配信物の HTML から script.js が丸ごと落ちた。
 *   2. script.js が全体を DOMContentLoaded で包んでいた。module は defer と
 *      同じ扱いで、その行事が済んだあとに走ることがある。すると中身が
 *      一度も動かない。
 *
 * どちらも「ソースを読むだけ」では分からない。ビルドして、実際に開いて、
 * 写真が出るかを見るまで気づけなかった。だからここで見る。
 *
 * ■ 何を見るか
 *   1. 配信物の HTML から JS がちゃんと読み込まれ、実際に動いているか
 *   2. 遅延読み込みの写真が、端まで送ったときに全部出るか
 *   3. 取得に失敗した通信（404 など）が無いか
 */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const ここ = path.dirname(url.fileURLToPath(import.meta.url));
const 配信物 = path.join(ここ, '..', 'dist');
const 港 = 4199;

if (!fs.existsSync(path.join(配信物, 'index.html'))) {
  console.error('停止：dist/index.html がありません。先に npm run build を実行してください');
  process.exit(1);
}

const 型 = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.avif': 'image/avif',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
};

const 台 = http.createServer((req, res) => {
  const 道 = decodeURIComponent(req.url.split('?')[0]);
  let f = path.join(配信物, 道 === '/' ? 'index.html' : 道.replace(/^\//, ''));
  // 拡張子が無ければ .html を足して探す（Netlify の きれいな住所 と同じ）
  if (!fs.existsSync(f) && !path.extname(f)) f += '.html';
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': 型[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => 台.listen(港, '127.0.0.1', r));

let 誤り = 0;
const b = await chromium.launch();

for (const [名, 幅, 高] of [
  ['パソコン', 1280, 800],
  ['スマホ', 390, 844],
]) {
  const c = await b.newContext({ viewport: { width: 幅, height: 高 }, locale: 'ja-JP' });
  const p = await c.newPage();
  const 取得失敗 = [];
  const 台本の誤り = [];
  p.on('response', (r) => {
    if (r.status() >= 400) 取得失敗.push(r.status() + ' ' + r.url().replace('http://127.0.0.1:' + 港, ''));
  });
  p.on('pageerror', (e) => 台本の誤り.push(String(e).split('\n')[0]));

  await p.goto('http://127.0.0.1:' + 港 + '/', { waitUntil: 'load' });
  await p.waitForTimeout(1200);

  // 端まで、ゆっくり送る。速く送ると遅延読み込みが追いつかない
  const 高さ = await p.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < 高さ; y += 300) {
    await p.evaluate((n) => window.scrollTo(0, n), y);
    await p.waitForTimeout(220);
  }
  // まだ読めていない写真があれば、その場所まで送って待つ。
  // 遅延読み込みは「視野に入って初めて」読むので、上へ戻したまま数えると
  // 下のほうにある写真（QRなど）を「出ない」と誤って数えてしまう
  for (let 回 = 0; 回 < 3; 回++) {
    const 残り = await p.evaluate(() =>
      [...document.querySelectorAll('img')].findIndex(
        (i) => !(i.naturalWidth > 0) && i.getBoundingClientRect().height > 0
      )
    );
    if (残り < 0) break;
    await p.evaluate((n) => {
      const el = [...document.querySelectorAll('img')][n];
      el?.scrollIntoView({ block: 'center' });
    }, 残り);
    await p.waitForTimeout(1500);
  }

  await p.evaluate(() => window.scrollTo(0, 0));
  await p.waitForTimeout(2000);

  const r = await p.evaluate(() => {
    const imgs = [...document.querySelectorAll('img')];
    return {
      画像数: imgs.length,
      // 画面に出ている（幅か高さを持つ）のに読めていないものだけを数える。
      // スマホ幅では QR のように display:none で隠すものがある
      壊れ: imgs
        .filter((i) => !(i.naturalWidth > 0) && i.getBoundingClientRect().height > 0)
        .map((i) => (i.getAttribute('src') || '').split('/').pop()),
      演出が動いた: document.querySelectorAll('.fade-up.visible').length,
      演出の総数: document.querySelectorAll('.fade-up').length,
      ローディングが消えた:
        document.getElementById('loading-screen')?.classList.contains('loaded') ?? null,
    };
  });

  console.log(`■ ${名}（${幅}x${高}）`);
  console.log(`   写真 ${r.画像数} 枚 / 出なかった ${r.壊れ.length} 枚`);
  console.log(`   スクロールの演出 ${r.演出が動いた}/${r.演出の総数}`);

  if (r.壊れ.length) {
    console.error(`   ✗ 画面に出ているのに読めない写真: ${r.壊れ.join(', ')}`);
    誤り++;
  }
  // JS が動いていれば、演出が1つは動き、ローディングも消える。
  // ここが 0 のときは、配信物から台本が落ちている疑いが濃い
  if (r.演出の総数 > 0 && r.演出が動いた === 0) {
    console.error('   ✗ スクロールの演出が1つも動いていない（JS が読み込まれていない疑い）');
    誤り++;
  }
  if (r.ローディングが消えた === false) {
    console.error('   ✗ ローディング画面が消えていない（JS が動いていない疑い）');
    誤り++;
  }
  if (取得失敗.length) {
    console.error(`   ✗ 取得に失敗: ${取得失敗.slice(0, 8).join(' / ')}`);
    誤り++;
  }
  if (台本の誤り.length) {
    console.error(`   ✗ 台本の誤り: ${台本の誤り.slice(0, 3).join(' / ')}`);
    誤り++;
  }
  await c.close();
}

// 法務の頁も開けるか（住所は拡張子なしでも配る決まり）
const p2 = await (await b.newContext()).newPage();
for (const 道 of ['/privacy.html', '/terms.html', '/404.html']) {
  const res = await p2.goto('http://127.0.0.1:' + 港 + 道, { waitUntil: 'domcontentloaded' });
  if (!res || res.status() >= 400) {
    console.error(`✗ ${道} が開けません（${res ? res.status() : '応答なし'}）`);
    誤り++;
  }
}
await b.close();
台.close();

console.log('');
if (誤り === 0) {
  console.log('配ってよい状態です。');
  process.exit(0);
}
console.error(`直すところが ${誤り} 件あります。`);
process.exit(1);
