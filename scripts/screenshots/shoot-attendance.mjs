/**
 * 出欠の 2 枚（attendance_ui・attendance_calendar_ui）を撮る。
 *
 * 出席率の分母は雲の「公式練習日」なので、shoot.mjs のように通信なしで見本を入れると 0/0 になる。
 * こちらは検証環境の撮影用の団体（100010。部員はほかの写真と同じ見本の名前）にログインして撮る。
 *
 * 下ごしらえ:
 *   1. アプリ側で団体の中身をそろえる（流すたびに同じ中身に戻る）
 *        cd ../app && node scripts/seed-homepage-shots.mjs
 *   2. アプリ側で検証環境向けに書き出して、8091 番で配る（shoot.mjs と同じ）
 *        npm run build:stg
 *        npx http-server dist -p 8091 -s -c-1 --proxy "http://127.0.0.1:8091?"
 *
 * 走らせ方（このホームページの folder で）:
 *   node scripts/screenshots/shoot-attendance.mjs
 *   撮ったものは assets/ に直接入る。そのあと npm run build。
 *
 * 試しの口座のパスワードは、環境変数 STG_TEST_PASSWORD か、アプリの .env.development.local の
 * STG_TEST_PASSWORD の行から読む（公開の倉庫なので、ここには書かない）
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const ここ = path.dirname(url.fileURLToPath(import.meta.url));
const 出し先 = process.env.SHOT_OUT || path.join(ここ, "..", "..", "assets");
const 港 = 8091;
const 団体 = "100010";
// 練習日と記録を置いた月（app/scripts/seed-homepage-shots.mjs）
const 写す月 = "2026年 8月";

function パスワードを読む() {
  if (process.env.STG_TEST_PASSWORD) return process.env.STG_TEST_PASSWORD;
  const 道 = path.join(ここ, "..", "..", "..", "app", ".env.development.local");
  const 中身 = fs.existsSync(道) ? fs.readFileSync(道, "utf8") : "";
  const 値 = (中身.match(/^STG_TEST_PASSWORD=(.+)$/m) || [])[1];
  if (!値) {
    console.error(
      "停止：試しの口座のパスワードがありません（STG_TEST_PASSWORD か、app/.env.development.local）",
    );
    process.exit(1);
  }
  return 値.trim();
}

// お知らせの窓が割り込まないよう、いまの版を配信物から読む（shoot.mjs と同じ読み方）
async function お知らせの版を読む() {
  try {
    const html = await (await fetch("http://127.0.0.1:" + 港 + "/")).text();
    const 束 = (html.match(/AppEntry-[a-f0-9]+\.js/) || [])[0];
    if (!束) return null;
    const js = await (
      await fetch("http://127.0.0.1:" + 港 + "/_expo/static/js/web/" + 束)
    ).text();
    // 束に検証環境の接続先が入っているか。本番向けの束では、撮影用の団体に入れない
    if (!js.includes("kyudoscoremanager-stg")) {
      console.error(
        "停止：8091 番の束が検証環境向けではありません（npm run build:stg で書き出す）",
      );
      process.exit(1);
    }
    const 版たち = [...js.matchAll(/\b(\d{4}-\d{2}-\d{2}-\d{2})\b/g)].map(
      (m) => m[1],
    );
    return 版たち.length ? 版たち.sort().at(-1) : null;
  } catch {
    return null;
  }
}

/** 端末の控え（店）の中身。e2e と同じく __弓道の控え があればそちらを読む */
const 控えを読む = (p) =>
  p.evaluate(() => {
    try {
      return (
        JSON.parse(
          (globalThis.__弓道の控え?.() ??
            localStorage.getItem("archery-score-storage")) ||
            "{}",
        ).state || {}
      );
    } catch {
      return {};
    }
  });

/** 見出しの月が 写す月 になるまで、前の月へ送る */
async function 月を合わせる(p) {
  for (let 回 = 0; 回 < 24; 回++) {
    if (await p.getByText(写す月, { exact: true }).count()) return;
    await p.getByLabel("前の月へ").first().click();
    await p.waitForTimeout(400);
  }
  throw new Error(写す月 + " まで戻れませんでした");
}

const お知らせの版 = (await お知らせの版を読む()) || "9999-12-31-99";
const b = await chromium.launch();
const c = await b.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  locale: "ja-JP",
  timezoneId: "Asia/Tokyo",
});
await c.addInitScript((版) => {
  // 初回の案内とお知らせの窓が撮影に割り込まないよう、既読にしておく
  localStorage.setItem("tutorialDoneVersion", "2026-08-13-01");
  localStorage.setItem("whatsNewDismissedVersion", 版);
  localStorage.setItem("whatsNewLastSeenVersion", 版);
}, お知らせの版);
const p = await c.newPage();
await p.goto("http://127.0.0.1:" + 港 + "/");

// 団体でログインする
const 番号欄 = p.getByPlaceholder("例: 123456", { exact: true });
await 番号欄.waitFor({ state: "visible", timeout: 60_000 });
await 番号欄.fill(団体);
await p.locator('input[type="password"]').first().fill(パスワードを読む());
await p.getByText("ログイン", { exact: true }).click();

// 起動の全件の読み込み（名簿・記録）が終わるまで待つ
const 始め = Date.now();
for (;;) {
  const s = await 控えを読む(p);
  if (s.activeGroupId && (s.全部そろえた時刻 || 0) > 0) {
    console.log(
      `  団体${団体}：名簿${(s.members || []).length}人・記録${(s.sessions || []).length}件`,
    );
    break;
  }
  if (Date.now() - 始め > 90_000)
    throw new Error("ログインか読み込みが終わりませんでした");
  await p.waitForTimeout(500);
}
await p.waitForTimeout(2000);

await p.getByText("出欠", { exact: true }).first().click();
await p.waitForTimeout(1500);
await 月を合わせる(p);
await p
  .getByText(/^\d+\.\d%$/)
  .first()
  .waitFor({ timeout: 30_000 });
await p.waitForTimeout(1500);
await p.screenshot({ path: path.join(出し先, "attendance_ui.png") });
console.log("  ✓ attendance_ui");

await p.getByText("練習日設定", { exact: true }).click();
await p.waitForTimeout(1500);
await 月を合わせる(p);
await p.getByText(/月の練習日数/).waitFor({ timeout: 15_000 });
await p.waitForTimeout(1500);
await p.screenshot({ path: path.join(出し先, "attendance_calendar_ui.png") });
console.log("  ✓ attendance_calendar_ui");

await b.close();
