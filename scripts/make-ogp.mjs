/**
 * SNS に貼ったときのサムネイル（OGP画像）を作る。
 *
 *   node scripts/make-ogp.mjs
 *
 * ■ なぜ .webp を使わないのか
 * WebP はブラウザでは軽くてよいが、**SNS のクローラーが読めないことがある**。
 * LINE のアプリ内ブラウザや古い Facebook / X のクローラーは展開できず、
 * 貼っても画像が出ない（真っ黒になる）。表示の速さより、確実に出ることを採る。
 * ここでは JPEG を作る。
 *
 * ■ 1200×630 にする理由
 * SNS が想定している寸法（およそ 1.91:1）。ここから外れると、
 * 相手の側で勝手に切られ、字が欠ける。
 *
 * ■ 何を伝える絵にするか
 * 「個人の記録帳」と読まれると、部活の担当者が自分ごとにしない。
 * 団体で使うものだと分かる札を上に置き、団体で効くことを3つだけ並べる。
 * 並べすぎると、どれも読まれない。
 *
 * ■ 書いてよいこと
 * 絵に書けるのは、アプリが実際にできることだけ。一度「登録不要でお試し」と
 * 書いたが、そんな入口は無い（入るには団体アカウントを作るか、団体IDと
 * 個人IDが要る）。SNS に貼る絵は最初に目に入るので、ここでの言い過ぎは
 * そのまま「話が違う」になる。LP の文言（無料で使える弓道管理ツール）を
 * 超えないこと。
 *
 * ■ 作りの考え方
 * 字だけの絵は、遠目には「何のアプリか」が伝わらない。実物の画面を端末の
 * 枠に入れて右に置き、左に字を積む。人の目は左上から入るので、大事な順
 * （誰のためか → 何のアプリか → 何ができるか）に上から並べる。
 *
 * 端末は右端から少しはみ出させる。収めきると余白が均等になって「置いた
 * だけ」に見える。はみ出すと、画面の外まで続いている感じが出る。
 *
 * 背景は一色に塗らない。均一な地は平たく見えるので、斜めの grad と
 * うっすらした光を重ねて奥行きを作る。
 */
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const 幅 = 1200;
const 高さ = 630;
const 出し先 = path.join('assets', 'ogp.jpg');

// サイトの配色（style.css）に合わせる
const 漆黒 = '#0a0c10';
const 墨 = '#14161c';
const 金 = '#c9a96e';
const 淡金 = '#e0c48a';
const 白磁 = '#f0ede5';
const 銀鼠 = '#a8a5a0';

/** 端末の枠に入れた画面。角を丸め、細い金の縁を付ける */
async function 端末の絵(元, 見せ幅) {
  const 情報 = await sharp(元).metadata();
  // 上のほうだけを使う。下まで入れると字が小さくなり、何の画面か分からない
  const 切る高さ = Math.round(情報.height * 0.6);
  const 見せ高さ = Math.round((切る高さ / 情報.width) * 見せ幅);
  const 丸み = Math.round(見せ幅 * 0.085);

  const 中身 = await sharp(元)
    .extract({ left: 0, top: 0, width: 情報.width, height: 切る高さ })
    .resize(見せ幅, 見せ高さ, { fit: 'fill' })
    .toBuffer();

  const 型 = Buffer.from(
    `<svg width="${見せ幅}" height="${見せ高さ}"><rect width="${見せ幅}" height="${見せ高さ}" rx="${丸み}" ry="${丸み}" fill="#fff"/></svg>`
  );
  const 縁 = Buffer.from(
    `<svg width="${見せ幅}" height="${見せ高さ}">
      <rect x="0.9" y="0.9" width="${見せ幅 - 1.8}" height="${見せ高さ - 1.8}"
            rx="${丸み}" ry="${丸み}" fill="none" stroke="${金}" stroke-opacity="0.5" stroke-width="1.8"/>
    </svg>`
  );

  const 絵 = await sharp(中身)
    .composite([
      { input: 型, blend: 'dest-in' },
      { input: 縁, blend: 'over' },
    ])
    .png()
    .toBuffer();

  return { 絵, 幅: 見せ幅, 高さ: 見せ高さ, 丸み };
}

const 端末元 = fs.existsSync('assets/analysis_ui.png')
  ? 'assets/analysis_ui.png'
  : 'assets/record_shots_ui.png';
const 端末 = await 端末の絵(端末元, 340);
const 端末X = 828; // 右端（1200）から少しはみ出す
const 端末Y = Math.round((高さ - 端末.高さ) / 2);

// 端末の下に敷く影。真下ではなく少し下へずらす
const 影 = await sharp(
  Buffer.from(
    `<svg width="${端末.幅}" height="${端末.高さ}"><rect width="${端末.幅}" height="${端末.高さ}" rx="${端末.丸み}" ry="${端末.丸み}" fill="#000" fill-opacity="0.6"/></svg>`
  )
)
  .blur(28)
  .png()
  .toBuffer();

const 地 = `
<svg width="${幅}" height="${高さ}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="地" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${漆黒}"/>
      <stop offset="55%" stop-color="${墨}"/>
      <stop offset="100%" stop-color="${漆黒}"/>
    </linearGradient>
    <linearGradient id="金の線" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${金}" stop-opacity="0.85"/>
      <stop offset="100%" stop-color="${金}" stop-opacity="0"/>
    </linearGradient>
  </defs>

  <rect width="${幅}" height="${高さ}" fill="url(#地)"/>
  <!-- 左上にうっすら光を入れる。均一な地は平たく見える -->
  <ellipse cx="170" cy="80" rx="540" ry="340" fill="${金}" fill-opacity="0.05"/>
  <!-- 的。端末の背後に置き、輪郭だけ見せる -->
  <g transform="translate(1005,315)">
    <circle r="272" fill="none" stroke="${金}" stroke-opacity="0.14" stroke-width="1.5"/>
    <circle r="202" fill="none" stroke="${金}" stroke-opacity="0.11" stroke-width="1.5"/>
    <circle r="132" fill="none" stroke="${金}" stroke-opacity="0.08" stroke-width="1.5"/>
  </g>
  <!-- 上端の金線。画面の縁を締める -->
  <rect x="0" y="0" width="${幅}" height="3" fill="url(#金の線)"/>
</svg>`;

// 字は端末より前に置く。端末に重ならない幅（およそ 780）に収める
const 字 = `
<svg width="${幅}" height="${高さ}" xmlns="http://www.w3.org/2000/svg">
  <g transform="translate(78,72)">
    <rect x="0" y="0" width="272" height="40" rx="20"
          fill="${金}" fill-opacity="0.12" stroke="${金}" stroke-opacity="0.5" stroke-width="1.2"/>
    <text x="21" y="27" fill="${淡金}" font-size="20" letter-spacing="3"
          font-family="'Hiragino Sans','Noto Sans JP','Yu Gothic',sans-serif">部活・団体で使えます</text>
  </g>

  <text x="74" y="208" fill="${白磁}" font-size="70" font-weight="bold" letter-spacing="1"
        font-family="'Hiragino Sans','Noto Sans JP','Yu Gothic',sans-serif">弓道部的中ノート</text>
  <text x="78" y="258" fill="${銀鼠}" font-size="26"
        font-family="'Hiragino Sans','Noto Sans JP','Yu Gothic',sans-serif">練習の記録、分析、共有をこの一つで。</text>

  <g transform="translate(78,310)">
    <circle cx="7" cy="14" r="3.5" fill="${金}"/>
    <text x="26" y="21" fill="${白磁}" font-size="23"
          font-family="'Hiragino Sans','Noto Sans JP','Yu Gothic',sans-serif">名簿と出欠をまとめて管理</text>
    <circle cx="7" cy="58" r="3.5" fill="${金}"/>
    <text x="26" y="65" fill="${白磁}" font-size="23"
          font-family="'Hiragino Sans','Noto Sans JP','Yu Gothic',sans-serif">複数の端末で的中をその場で共有</text>
    <circle cx="7" cy="102" r="3.5" fill="${金}"/>
    <text x="26" y="109" fill="${白磁}" font-size="23"
          font-family="'Hiragino Sans','Noto Sans JP','Yu Gothic',sans-serif">立ち順の検討に使える個人別の分析</text>
  </g>

  <rect x="76" y="482" width="112" height="2" fill="${金}" fill-opacity="0.55"/>
  <text x="76" y="530" fill="${銀鼠}" font-size="21" letter-spacing="1"
        font-family="'Hiragino Sans','Noto Sans JP','Yu Gothic',sans-serif">無料で使えます ・ ブラウザだけで動きます</text>
  <text x="76" y="566" fill="${金}" font-size="19" letter-spacing="2" fill-opacity="0.75"
        font-family="'Hiragino Sans','Noto Sans JP','Yu Gothic',sans-serif">kyudoscoremanager.web.app</text>
</svg>`;

const 出 = await sharp(Buffer.from(地))
  .composite([
    { input: 影, top: 端末Y + 20, left: 端末X + 10 },
    { input: 端末.絵, top: 端末Y, left: 端末X },
    { input: Buffer.from(字), top: 0, left: 0 },
  ])
  .jpeg({ quality: 88, progressive: true, chromaSubsampling: '4:4:4' })
  .toBuffer();

fs.writeFileSync(出し先, 出);
const 大きさ = (出.length / 1024).toFixed(0);
console.log(`${出し先} を作りました（${幅}×${高さ}・${大きさ}KB・端末は ${path.basename(端末元)}）`);
if (出.length > 300 * 1024) console.log('※ 300KB を超えています。読まれないことがあるので、品質を下げてください');
