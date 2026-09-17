/**
 * ホームページに載せる画面写真を撮り直す。
 *
 * 端末の控え（localStorage）に見本データを流し込んで撮る。
 * 認証は持たせないので、クラウドへの書き込みはすべて拒まれる。
 * 検証環境の団体（100001〜100007）には一切触れない。
 *
 * 下ごしらえ:
 *   1. アプリ側で検証用に build して dist を作る
 *   2. その dist を 8091 番で配る
 *        npx http-server dist -p 8091 -s -c-1 --proxy "http://127.0.0.1:8091?"
 *
 * 走らせ方（このホームページの folder で）:
 *   node scripts/screenshots/shoot.mjs            … 全部撮る
 *   node scripts/screenshots/shoot.mjs record_ui  … 名前を指定して撮る
 *   撮ったものは assets/ に直接入る。そのあと npm run build。
 *
 * 出欠の2枚（attendance_ui / attendance_calendar_ui）はここでは撮れない。
 * 出席率の分母がクラウドの「公式練習日」なので、通信なしでは 0/0 になる。
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { 見本の部員, 見本の記録, 見本のいまの立ち } from './demo-data.mjs';

// 出し先の既定は、このホームページの assets（そのまま差し替わる）
const ここ = path.dirname(url.fileURLToPath(import.meta.url));
const 出し先 = process.env.SHOT_OUT || path.join(ここ, '..', '..', 'assets');
const 港 = 8091;
const いま = new Date('2026-08-27T18:00:00+09:00').getTime();

const 部員 = 見本の部員();
const 記録 = 見本の記録(部員, いま);
const 立ち = 見本のいまの立ち(部員);

// お知らせの窓が撮影に割り込まないよう、いまの版を配信物から読む。
// 自動表示は「既読の版 !== NOTICE_VERSION」で決まる（不一致で開く）ので、
// 既読をちょうど NOTICE_VERSION に合わせる。版を上げてもここは直さずに済む
async function お知らせの版を読む() {
  try {
    const html = await (await fetch('http://127.0.0.1:' + 港 + '/')).text();
    const 束 = (html.match(/AppEntry-[a-f0-9]+\.js/) || [])[0];
    if (!束) return null;
    const js = await (await fetch('http://127.0.0.1:' + 港 + '/_expo/static/js/web/' + 束)).text();
    // minify で変数名 NOTICE_VERSION は消える。版の形（YYYY-MM-DD-NN）で拾い、
    // いちばん新しいものを取る。NOTICE_VERSION は最新の項目の版と一致する決まり
    const 版たち = [...js.matchAll(/\b(\d{4}-\d{2}-\d{2}-\d{2})\b/g)].map((m) => m[1]);
    if (!版たち.length) return null;
    return 版たち.sort().at(-1);
  } catch {
    return null;
  }
}
const お知らせの版 = (await お知らせの版を読む()) || '9999-12-31-99';
if (お知らせの版 === '9999-12-31-99') {
  console.log('  （注意：配信物から NOTICE_VERSION を読めませんでした。窓が写るかもしれません）');
}

const 土台 = JSON.parse(fs.readFileSync(path.join(ここ, 'base-state.json'), 'utf8'));
土台.state = {
  ...土台.state,
  members: 部員,
  sessions: 記録,
  archers: 立ち,
  alumni: [],
  trash: [],
  deletedMembers: [],
  history: [],
  shotsPerRound: 8,
  activeSessionID: null,
  activeGroupId: '000910',
  activeGroupName: '桜坂大学弓道部',
  publicGroupId: '000910',
  activeRole: 'group',
  myMemberId: null,
  myMemberName: null,
  currentFreshmanTerm: 53,
  currentSessionTags: ['#正規練習'],
  lastSessionTags: ['#正規練習'],
  enableArrowLocation: true,
  arrowTargetType: 'hoshi24',
  lastSyncTime: いま - 60000,
  isAdminMode: false,
};
const 控え = JSON.stringify(土台);

fs.mkdirSync(出し先, { recursive: true });
const b = await chromium.launch();

/**
 * 見本の控えを入れた頁を用意する。
 * 控えを入れない（真っさら）ときは 中身 に null を渡す
 */
async function 頁をひらく(手直し) {
  const c = await b.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
  });
  const 中身 = 手直し === null ? null : JSON.stringify(手直し ? 手直し(JSON.parse(控え)) : JSON.parse(控え));
  await c.addInitScript(
    ([s, 版]) => {
      if (s) localStorage.setItem('archery-score-storage', s);
      // 初回の案内とお知らせの窓が撮影に割り込まないよう、既読にしておく。
      // お知らせは、いまの NOTICE_VERSION ちょうどを入れて自動表示を止める
      localStorage.setItem('tutorialDoneVersion', '2026-08-13-01');
      localStorage.setItem('whatsNewDismissedVersion', 版);
      localStorage.setItem('whatsNewLastSeenVersion', 版);
      localStorage.removeItem('tutorialBoardSnapshot');
      localStorage.removeItem('aiChatMessages_v1');
    },
    [中身, お知らせの版]
  );
  const p = await c.newPage();
  await p.goto('http://127.0.0.1:' + 港 + '/');
  await p.waitForTimeout(中身 ? 5000 : 3500);
  return { c, p };
}

/** 上の帯のタブを押す */
async function 移る(p, 名) {
  await p.getByText(名, { exact: true }).first().click();
  await p.waitForTimeout(2000);
}

// 通信を持たないせいで出る帯は、実際の利用では出ないので隠す
async function 帯を隠す(p) {
  await p.evaluate(() => {
    const 消す文 = ['同期エラー: クラウドとの同期に失敗しました', 'オフライン', '接続が不安定です'];
    for (const el of document.querySelectorAll('div,span')) {
      const t = (el.textContent || '').trim();
      if (!消す文.includes(t)) continue;
      // その帯だけを包んでいる親までさかのぼる。
      // 中身が帯の文字だけでなくなったら、そこは他の物も抱えているので上がらない
      let n = el;
      while (n.parentElement && 消す文.includes((n.parentElement.textContent || '').trim())) {
        n = n.parentElement;
      }
      n.style.display = 'none';
    }
    // 記録画面の上にある同期の雲印。認証を持たせていないので「未同期」の絵になる。
    // 実際に使うときは同期済みなので、写真には出さない
    for (const el of document.querySelectorAll('div')) {
      if (el.children.length) continue;
      if (getComputedStyle(el).fontFamily.indexOf('ionicons') < 0) continue;
      const b = el.getBoundingClientRect();
      if (b.y > 70 && b.y < 110 && b.x < 140 && b.width < 30) el.style.visibility = 'hidden';
    }
  });
}

async function 撮る(p, 名) {
  await 帯を隠す(p);
  await p.waitForTimeout(500);
  await p.screenshot({ path: 出し先 + '/' + 名 + '.png' });
  console.log('  ✓ ' + 名);
}


/**
 * 画面の真ん中にあるものを、その場で下へ送る。
 * 「いちばん大きい巻物」を選ぶと、窓が開いているときに後ろの一覧が動いてしまう。
 * 真ん中から親をたどれば、いま前に出ているものが選ばれる
 */
async function 送る(p, 量) {
  const 動いた = await p.evaluate((n) => {
    const 真ん中 = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
    let el = 真ん中;
    while (el) {
      if (el.scrollHeight > el.clientHeight + 20) {
        el.scrollTop += n;
        return true;
      }
      el = el.parentElement;
    }
    // 真ん中に巻物が無いときだけ、いちばん大きいものを送る
    const 候補 = Array.prototype.slice
      .call(document.querySelectorAll('div'))
      .filter((e) => e.scrollHeight > e.clientHeight + 40);
    候補.sort((a, b) => b.clientHeight * b.clientWidth - a.clientHeight * a.clientWidth);
    if (候補[0]) {
      候補[0].scrollTop += n;
      return true;
    }
    return false;
  }, 量);
  if (!動いた) console.log('    （送れる巻物が見つからない）');
  await p.waitForTimeout(1400);
}

/**
 * その文字を持つもののうち、実際に指が届くものを押す。
 * 同じ文字が測り用の隠れた層にもあることがあり、素直に .first() を押すと
 * ずっと待たされる（別のものが上に乗っているため）
 */
async function 押す(p, 文) {
  const 群 = p.getByText(文, { exact: false });
  const 数 = await 群.count();
  for (let i = 0; i < 数; i++) {
    const el = 群.nth(i);
    try {
      await el.scrollIntoViewIfNeeded({ timeout: 4000 });
      await p.waitForTimeout(400);
      const 箱 = await el.boundingBox();
      if (!箱) continue;
      const 届く = await p.evaluate(
        ([x, y, t]) => {
          const e = document.elementFromPoint(x, y);
          return !!e && (e.textContent || '').indexOf(t) >= 0;
        },
        [箱.x + 箱.width / 2, 箱.y + 箱.height / 2, 文]
      );
      if (!届く) continue;
      await el.click({ timeout: 6000 });
      return true;
    } catch (e) {
      /* 次の候補へ */
    }
  }
  throw new Error('押せるものがない: ' + 文);
}

/** 画面に何が出ているかを見て、狙った画面かを確かめる */
async function 覗く(p, 札) {
  const t = (await p.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 220);
  console.log('    [' + 札 + '] ' + t);
}

// ─────────────────────────────────────────
// 撮るもの
// ─────────────────────────────────────────
const 仕事 = {};

仕事.record_ui = async () => {
  const { c, p } = await 頁をひらく();
  await 覗く(p, 'record');
  await 撮る(p, 'record_ui');
  await c.close();
};

仕事.history_ui = async () => {
  const { c, p } = await 頁をひらく();
  await 移る(p, '履歴');
  await 覗く(p, 'history');
  await 撮る(p, 'history_ui');
  await c.close();
};

仕事.analysis_ui = async () => {
  const { c, p } = await 頁をひらく();
  await 移る(p, '分析');
  await 覗く(p, 'analysis');
  await 撮る(p, 'analysis_ui');
  await c.close();
};

仕事.member_edit_ui = async () => {
  const { c, p } = await 頁をひらく();
  await 移る(p, 'メンバー');
  await 覗く(p, 'member');
  await 撮る(p, 'member_edit_ui');
  await c.close();
};

// 出欠の出席率。公式練習日を入れてから撮る
仕事.attendance_ui = async () => {
  const { c, p } = await 頁をひらく();
  await 通信を止める(c);
  await 移る(p, '出欠');
  await 練習日を入れる(p);
  await p.getByText('出席統計', { exact: true }).first().click();
  await p.waitForTimeout(2000);
  await 覗く(p, '出席統計');
  await 撮る(p, 'attendance_ui');
  await c.close();
};

// 練習日のカレンダー。予定表の読み取りの案内も一緒に写す
仕事.attendance_calendar_ui = async () => {
  const { c, p } = await 頁をひらく();
  await 通信を止める(c);
  await 移る(p, '出欠');
  await 練習日を入れる(p);
  await 覗く(p, '練習日設定');
  await 撮る(p, 'attendance_calendar_ui');
  await c.close();
};

仕事.settings_ui = async () => {
  const { c, p } = await 頁をひらく();
  await 移る(p, '設定');
  // 団体IDやログイン種別はこのカードの話と関わりが薄い。
  // 使い方の案内と配色の切り替えが見えるところまで送る
  await 送る(p, 180);
  await 覗く(p, 'settings');
  await 撮る(p, 'settings_ui');
  await c.close();
};

/** 名前のマスを長押しして、その射手への操作を出す */
async function 名前を長押し(p, 名前) {
  const 的 = p.getByText(名前, { exact: false }).first();
  const 箱 = await 的.boundingBox();
  if (!箱) throw new Error('名前のマスが見つからない: ' + 名前);
  await p.mouse.move(箱.x + 箱.width / 2, 箱.y + 箱.height / 2);
  await p.mouse.down();
  await p.waitForTimeout(1200);
  await p.mouse.up();
  await p.waitForTimeout(1500);
}

// 射手の追加。空いた列の「選択」から名簿を開いたところ
仕事.record_insert_ui = async () => {
  const { c, p } = await 頁をひらく();
  await p.getByText('人', { exact: true }).first().click();
  await p.waitForTimeout(1500);
  await p.getByText('選択', { exact: true }).first().click();
  await p.waitForTimeout(1800);
  await 覗く(p, '射手の追加');
  await 撮る(p, 'record_insert_ui');
  await c.close();
};

// 射数の変更。8射 の右の ＋ を押して増やす
仕事.record_shots_ui = async () => {
  const { c, p } = await 頁をひらく();
  const 札 = await p.getByText('8射', { exact: true }).first().boundingBox();
  if (!札) throw new Error('射数の表示が見つからない');
  await p.mouse.click(札.x + 札.width + 24, 札.y + 札.height / 2);
  await p.waitForTimeout(1200);
  await 覗く(p, '射数を増やした');
  await 撮る(p, 'record_shots_ui');
  await c.close();
};

// 途中交代。長押しの menu から「途中交代」を選んだところ
仕事.record_swap_ui = async () => {
  const { c, p } = await 頁をひらく();
  await 名前を長押し(p, '山田太');
  await p.getByText('途中交代', { exact: true }).first().click();
  await p.waitForTimeout(1800);
  await 覗く(p, '途中交代');
  await 撮る(p, 'record_swap_ui');
  await c.close();
};

仕事.ai_chat_ui = async () => {
  const { c, p } = await 頁をひらく();
  await 移る(p, '履歴');
  // 右下の AI の丸を押す
  await p.locator('text=AI').first().click();
  await p.waitForTimeout(2500);
  await 覗く(p, 'AI');
  await 撮る(p, 'ai_chat_ui');
  await c.close();
};

// 分析からひとりを開いた、個人別の詳しい中身
仕事.analysis_detail2_ui = async () => {
  const { c, p } = await 頁をひらく();
  await 移る(p, '分析');
  // 順位の並びは下のほうにある。届くところまで送ってから押す
  await 押す(p, '高橋蒼');
  await p.waitForTimeout(2500);
  await 覗く(p, '個人の詳細');
  await 撮る(p, 'analysis_detail2_ui');
  await c.close();
};

// 個人別の詳細の下半分。立ち順別と結果分布は1枚目に収まらない
仕事.analysis_detail3_ui = async () => {
  const { c, p } = await 頁をひらく();
  await 移る(p, '分析');
  await 押す(p, '高橋蒼');
  await p.waitForTimeout(2500);
  await 送る(p, 1200);
  await 覗く(p, '個人の詳細（下）');
  await 撮る(p, 'analysis_detail3_ui');
  await c.close();
};

仕事.app_login = async () => {
  const { c, p } = await 頁をひらく(null);
  await 覗く(p, 'login');
  await 撮る(p, 'app_login');
  await c.close();
};

// 部員が自分のIDで入る画面
仕事.member_login_ui = async () => {
  const { c, p } = await 頁をひらく(null);
  await p.getByText('個人', { exact: true }).first().click();
  await p.waitForTimeout(1500);
  await 覗く(p, '個人ログイン');
  await 撮る(p, 'member_login_ui');
  await c.close();
};

/** 部員として入っている控えにする */
const 部員として = (j) => {
  j.state.activeRole = 'member';
  j.state.myMemberId = 'demo-m-7'; // 高橋蒼
  j.state.myMemberName = '高橋蒼';
  j.state.memberAuthVersion = 2;
  return j;
};

// 部員が見る、自分の成績
仕事.personal_analysis_ui = async () => {
  const { c, p } = await 頁をひらく(部員として);
  await 移る(p, '分析');
  await 覗く(p, '部員の分析');
  await 撮る(p, 'personal_analysis_ui');
  await c.close();
};

// 部員の分析を下へ送った、矢所と結果の散らばり
仕事.personal_analysis2_ui = async () => {
  const { c, p } = await 頁をひらく(部員として);
  await 移る(p, '分析');
  await 送る(p, 1500);
  await 覗く(p, '部員の分析（下）');
  await 撮る(p, 'personal_analysis2_ui');
  await c.close();
};

// 分析の下半分。順位の並びは1枚目に収まらないので分ける
仕事.analysis_rank_ui = async () => {
  const { c, p } = await 頁をひらく();
  await 移る(p, '分析');
  await 送る(p, 620);
  await 覗く(p, '分析（順位）');
  await 撮る(p, 'analysis_rank_ui');
  await c.close();
};

// 設定の下半分。項目が多く1枚に収まらないので分ける
仕事.settings2_ui = async () => {
  const { c, p } = await 頁をひらく();
  await 移る(p, '設定');
  await 送る(p, 1520);
  await 覗く(p, '設定（下）');
  await 撮る(p, 'settings2_ui');
  await c.close();
};

const 頼まれ = process.argv.slice(2);
for (const [名, 走る] of Object.entries(仕事)) {
  if (頼まれ.length && !頼まれ.includes(名)) continue;
  try {
    await 走る();
  } catch (e) {
    console.log('  × ' + 名 + ' : ' + String(e).split('\n')[0].slice(0, 160));
  }
}
await b.close();
