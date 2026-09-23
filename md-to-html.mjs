/**
 * docs/legal の Markdown を、ホームページの HTML に流し込む。
 *
 *   node md-to-html.mjs
 *
 * 文書の正は docs/legal/ 側。こちらは公開用の写しなので、
 * 手で直さず、必ずこの変換を通して作り直すこと。
 * 手で両方を直すと、いつか食い違う（実際に食い違っていた）。
 *
 * 枠（ナビ・フッター・スタイル）は既存の HTML をそのまま使い、
 * <main> の中身だけを差し替える。
 */
import fs from 'node:fs';
import path from 'node:path';

// 2026-09-18 に Documents/kyudo/app へ移した（前は kyudoscoremanager_app）
const 元の場所 = 'C:/Users/yutoi/Documents/kyudo/app/docs/legal';
const 対 = [
  { md: 'privacy-policy.md', html: 'privacy.html', 題: 'プライバシーポリシー' },
  { md: 'terms-of-service.md', html: 'terms.html', 題: '利用規約' },
];

const 逃がす = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** 行内の書式（**太字** と [文字](URL)）を直す */
const 行の中 = (s) =>
  逃がす(s)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

/** Markdown を、ホームページの型の HTML に直す */
function 変換(md) {
  const 出 = [];
  let 箇条書き中 = false;
  let 表の中 = false;
  const 箇条書きを閉じる = () => { if (箇条書き中) { 出.push('</ul>'); 箇条書き中 = false; } };
  const 表を閉じる = () => { if (表の中) { 出.push('</tbody></table>'); 表の中 = false; } };

  for (const 生 of md.split(/\r?\n/)) {
    const 行 = 生.replace(/\s+$/, '');

    // 表（| a | b |）
    if (/^\s*\|/.test(行)) {
      const 枠 = 行.trim().replace(/^\||\|$/g, '').split('|').map((x) => x.trim());
      if (/^[\s|:-]+$/.test(行)) continue; // 区切りの行
      箇条書きを閉じる();
      if (!表の中) {
        出.push('<table class="legal-table"><thead><tr>' + 枠.map((x) => '<th>' + 行の中(x) + '</th>').join('') + '</tr></thead><tbody>');
        表の中 = true;
      } else {
        出.push('<tr>' + 枠.map((x) => '<td>' + 行の中(x) + '</td>').join('') + '</tr>');
      }
      continue;
    }
    表を閉じる();

    if (!行.trim()) { 箇条書きを閉じる(); continue; }

    const 見出し = 行.match(/^(#{1,4})\s+(.*)$/);
    if (見出し) {
      箇条書きを閉じる();
      const 段 = 見出し[1].length;
      出.push('<h' + 段 + '>' + 行の中(見出し[2]) + '</h' + 段 + '>');
      continue;
    }

    // 箇条書き（- や   - (1) …）
    const 箇条 = 行.match(/^\s*-\s+(.*)$/);
    if (箇条) {
      if (!箇条書き中) { 出.push('<ul>'); 箇条書き中 = true; }
      出.push('<li>' + 行の中(箇条[1]) + '</li>');
      continue;
    }

    // 番号付き（1. …）は段落として出す。条文の番号なので、
    // <ol> にすると番号が振り直されて条文とずれる
    箇条書きを閉じる();
    出.push('<p>' + 行の中(行.trim()) + '</p>');
  }
  箇条書きを閉じる();
  表を閉じる();
  return 出.join('\n');
}

/**
 * 最終更新日は、文書自身の「制定及び改定の履歴」の最後の日付から取る。
 *
 * 前は変換した日（時計）を入れていた。そのため
 *   ・中身を直していなくても、走らせるだけで日付が進む
 *   ・中身を直しても、走らせるまで古い日付のまま
 * という二つのずれが起きる。実際、規約は8月28日制定なのに、
 * HTML には8月27日と出ていた（それ以前に変換したものが残っていた）。
 *
 * 日付は「いつ直したか」であって「いつ変換したか」ではない。
 * 履歴に日付が無いときは止める。黙って今日を入れると、また同じずれを生む。
 */
function 最終更新日(md, 名) {
  const 日たち = [...md.matchAll(/^-\s*(\d{4})年(\d{1,2})月(\d{1,2})日/gm)];
  if (!日たち.length)
    throw new Error(名 + ': 「制定及び改定の履歴」に日付が見つからない。履歴を書いてください');
  // いちばん新しい日付を採る。履歴の並び順に頼らない
  const 並び = 日たち
    .map((m) => ({ 年: +m[1], 月: +m[2], 日: +m[3] }))
    .sort((a, b) => a.年 - b.年 || a.月 - b.月 || a.日 - b.日);
  const 後 = 並び[並び.length - 1];
  return `${後.年}年${後.月}月${後.日}日`;
}

/** 作った文書の最終更新日。sitemap にも同じ日付を入れる */
const 日付たち = {};

for (const x of 対) {
  const md = fs.readFileSync(path.join(元の場所, x.md), 'utf8');
  const 枠 = fs.readFileSync(x.html, 'utf8');
  const 始 = 枠.indexOf('<main class="legal-page">');
  const 終 = 枠.indexOf('</main>');
  if (始 < 0 || 終 < 0) throw new Error(x.html + ': main が見つからない');

  // 1行目の見出しは題として使い、本文からは外す
  const 本文 = md.replace(/^#\s+.*\r?\n/, '');
  const 中身 = [
    '<main class="legal-page">',
    '<h1>' + x.題 + '</h1>',
    '<p class="legal-updated">最終更新日: ' + 最終更新日(md, x.md) + '</p>',
    変換(本文),
  ].join('\n');

  fs.writeFileSync(x.html, 枠.slice(0, 始) + 中身 + '\n' + 枠.slice(終));
  console.log('  ' + x.html + ' を作り直した（' + md.length + '文字 → ' + 中身.length + '文字）');
  日付たち[x.html] = 最終更新日(md, x.md);
}

/**
 * sitemap.xml の lastmod も、文書の日付に合わせる。
 *
 * 手で書いていたため、方針や規約を直しても sitemap だけ古い日付のまま
 * 残っていた（実際、方針を8月29日に直した後も 2026-08-27 のままだった）。
 * 検索する側は lastmod を見て取りに来るので、古いままだと直したことが伝わらない。
 */
const 日付を数へ = (和) => {
  const m = 和.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (!m) throw new Error('日付を読めない: ' + 和);
  return m[1] + '-' + String(m[2]).padStart(2, '0') + '-' + String(m[3]).padStart(2, '0');
};

const 地図の場所 = 'assets/sitemap.xml';
if (fs.existsSync(地図の場所)) {
  let 地図 = fs.readFileSync(地図の場所, 'utf8');
  // 文書ごとに、その文書の日付を入れる
  for (const x of 対) {
    const 数 = 日付を数へ(日付たち[x.html]);
    const 形 = new RegExp('(<loc>[^<]*/' + x.html + '</loc>\\s*<lastmod>)[^<]*(</lastmod>)');
    地図 = 地図.replace(形, '$1' + 数 + '$2');
  }
  // 表紙は、いちばん新しい文書の日付に合わせる
  const 全部 = Object.values(日付たち).map(日付を数へ).sort();
  地図 = 地図.replace(
    /(<loc>[^<]*\/<\/loc>\s*<lastmod>)[^<]*(<\/lastmod>)/,
    '$1' + 全部[全部.length - 1] + '$2'
  );
  fs.writeFileSync(地図の場所, 地図);
  console.log('  ' + 地図の場所 + ' の lastmod を合わせた');
}
console.log('\n文書の正は docs/legal/ 側です。こちらを手で直さないでください。');
