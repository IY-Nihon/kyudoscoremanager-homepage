/**
 * 個人の詳細で、比較のあり／なしで項目が揃っているかを見る。
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { 見本の部員, 見本の記録, 見本のいまの立ち } from './demo-data.mjs';

const ここ = path.dirname(url.fileURLToPath(import.meta.url));
const 先 =
  'C:/Users/yutoi/AppData/Local/Temp/claude/C--Users-yutoi-OneDrive--------kyudoscoremanager-app/583a1247-e04e-4f03-83ae-af39b808605d/scratchpad/';
// お知らせの版はアプリのソースから読む。直書きすると、版を上げた日から
// お知らせの窓に阻まれて、この道具が動かなくなる
const お知らせの版 = (fs.readFileSync(
  'C:/Users/yutoi/Documents/kyudoscoremanager_app/src/JP_WhatsNewModal.js',
  'utf8'
).match(/NOTICE_VERSION = '([^']+)'/) || [])[1];

const いま = new Date('2026-08-28T18:00:00+09:00').getTime();
const 部員 = 見本の部員();
const 記録 = 見本の記録(部員, いま);
const 本人 = 部員[7];
const 相手 = 部員[8];

const 土台 = JSON.parse(fs.readFileSync(path.join(ここ, 'base-state.json'), 'utf8'));
土台.state = {
  ...土台.state,
  members: 部員,
  sessions: 記録,
  archers: 見本のいまの立ち(部員),
  shotsPerRound: 8,
  activeGroupId: '000910',
  activeGroupName: '桜坂大学弓道部',
  publicGroupId: '000910',
  activeRole: 'group',
  currentFreshmanTerm: 53,
  enableArrowLocation: true,
  arrowTargetType: 'hoshi24',
};

const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'ja-JP', timezoneId: 'Asia/Tokyo' });
// 版は Node 側で読むので、ブラウザへは引数で渡す（中からは見えない）
await c.addInitScript(([s, 版]) => {
  localStorage.setItem('archery-score-storage', s);
  localStorage.setItem('tutorialDoneVersion', '2026-08-13-01');
  localStorage.setItem('whatsNewDismissedVersion', 版);
}, [JSON.stringify(土台), お知らせの版]);
const p = await c.newPage();
const 誤 = [];
p.on('pageerror', (e) => 誤.push(String(e).slice(0, 200)));
await p.goto('http://127.0.0.1:8090/');
await p.waitForTimeout(6000);
await p.getByText('分析', { exact: true }).first().click();
await p.waitForTimeout(2500);

const 押す = async (文) => {
  const 群 = p.getByText(文, { exact: false });
  for (let i = 0; i < (await 群.count()); i++) {
    try {
      await 群.nth(i).scrollIntoViewIfNeeded();
      await p.waitForTimeout(300);
      const bb = await 群.nth(i).boundingBox();
      if (!bb) continue;
      const 届く = await p.evaluate(
        ([x, y, t]) => {
          const e = document.elementFromPoint(x, y);
          return !!e && (e.textContent || '').indexOf(t) >= 0;
        },
        [bb.x + bb.width / 2, bb.y + bb.height / 2, 文]
      );
      if (!届く) continue;
      await 群.nth(i).click({ timeout: 5000 });
      return true;
    } catch (e) {}
  }
  return false;
};

const 項目 = async (札) => {
  const t = (await p.locator('body').innerText()).replace(/\s+/g, ' ');
  const 並び = [];
  for (const 名 of ['的中率推移', '矢所の傾向', '立ち順別の的中率', '立ちの結果分布']) {
    const i = t.indexOf(名);
    if (i >= 0) 並び.push({ i, 名, 文: t.slice(i, i + 60) });
  }
  並び.sort((a, b) => a.i - b.i);
  console.log('');
  console.log('■ ' + 札 + '（項目 ' + 並び.length + '）');
  for (const x of 並び) console.log('   ' + x.文);
  const 断り = t.indexOf('4射に満たない');
  if (断り >= 0) console.log('   断り書き: ' + t.slice(断り - 10, 断り + 46));
};

await 押す(本人.name);
await p.waitForTimeout(2500);
await 項目('比較なし');
await p.screenshot({ path: 先 + 'detail-solo.png' });

await 押す('他のメンバーと比較');
await p.waitForTimeout(1500);
await 押す(相手.name);
await p.waitForTimeout(1000);
await 押す('完了');
await p.waitForTimeout(2500);
await 項目('比較あり');
await p.screenshot({ path: 先 + 'detail-compare.png' });

// 比較中に点を押せるか
const 押せた = await p.evaluate(() => {
  const 丸 = [...document.querySelectorAll('circle')].filter((c) => Number(c.getAttribute('r')) >= 10);
  const c = 丸.length ? 丸[丸.length - 1] : [...document.querySelectorAll('circle')].pop();
  if (!c) return false;
  const b = c.getBoundingClientRect();
  for (const t of ['pointerdown', 'mousedown', 'mouseup', 'click'])
    c.dispatchEvent(new MouseEvent(t, { bubbles: true, clientX: b.x + b.width / 2, clientY: b.y + b.height / 2 }));
  return true;
});
await p.waitForTimeout(2000);
console.log('');
console.log('比較中に点を押せたか: ' + (押せた ? 'はい' : '⚠ 点が無い'));
await 項目('比較あり＋点を押したあと');
await p.screenshot({ path: 先 + 'detail-compare-point.png' });
console.log('');
console.log('JSエラー: ' + (誤.length ? 誤[0] : 'なし'));
await b.close();
