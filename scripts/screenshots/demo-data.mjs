/**
 * ホームページ用の見本データ。
 * 通信を止めた状態で端末の控えに流し込むだけなので、
 * 検証環境にも本番にも一切書き込まない。
 */

// 名簿。前からホームページに載っている写真と同じ名前を混ぜて、
// 差し替えた写真と残した写真で人が食い違わないようにしてある。
// いずれも実在しない見本の名前
const 名簿 = [
  // 1年（53期）
  ['山田太郎', 1, '男子'], ['加藤翼', 1, '男子'], ['木村慎太', 1, '男子'],
  ['斎藤誠', 1, '男子'], ['松本拓也', 1, '男子'], ['井上陽太', 1, '男子'], ['中村結衣', 1, '女子'],
  // 2年（52期）
  ['高橋蒼', 2, '男子'], ['小林大和', 2, '男子'], ['伊藤蓮', 2, '男子'],
  ['渡邊翔太', 2, '男子'], ['佐藤陽菜', 2, '女子'], ['鈴木莉子', 2, '女子'],
  // 3年（51期）
  ['田中湊', 3, '男子'], ['山本大翔', 3, '男子'], ['吉田芽依', 3, '女子'],
  ['清水澪', 3, '女子'], ['林紬', 3, '女子'],
  // 4年（50期）
  ['渡辺樹', 4, '男子'], ['佐々木朝陽', 4, '男子'], ['松井楓', 4, '女子'], ['石川葵', 4, '女子'],
];

// 期は「入学年度の通し番号」。1年=53期、4年=50期
const 学年から期 = (学年) => 54 - 学年;

export function 見本の部員() {
  return 名簿.map(([名, 学年, 性別], 番) => ({
    id: 'demo-m-' + 番,
    lastModified: Date.now(),
    name: 名,
    grade: 学年,
    gender: 性別,
    personalId: String(2000 + 番),
    termKi: 学年から期(学年),
    syncStatus: '同期済み',
  }));
}

// 部員ごとの実力。見た目が単調にならないよう幅を持たせる
// 大学弓道の的中はおおむね2〜5割。見た目が単調にならない幅で
const 実力 = (人, i) => 0.2 + ((i * 37) % 24) / 100 + (人.grade >= 3 ? 0.06 : 0);

// 決まった並びで○×を作る（毎回同じ絵にするため乱数は使わない）
function 的中(種, 率, 本数) {
  const 出来 = [];
  let s = 種;
  for (let i = 0; i < 本数; i++) {
    s = (s * 1103515245 + 12345) % 2147483648;
    出来.push(s / 2147483648 < 率 ? '○' : '×');
  }
  return 出来;
}

// 矢所は「的の中心が 0、的のふちが 1」で持つ。
// ○ は中（1以下）、× は外（1より大きい）でなければならない
function 矢所(種, marks) {
  let s = 種 + 7;
  return marks.map((m) => {
    if (!m) return '';
    s = (s * 1103515245 + 12345) % 2147483648;
    const a = (s / 2147483648) * Math.PI * 2;
    s = (s * 1103515245 + 12345) % 2147483648;
    const 幅 = s / 2147483648;
    // 中りは的の中、外れは的のすぐ外に散らす。少し下振れさせて実際の癖に近づける
    const r = m === '○' ? 0.12 + 幅 * 0.74 : 1.06 + 幅 * 0.75;
    let x = Math.cos(a) * r;
    let y = Math.sin(a) * r + 0.14;
    // 下振れを足したせいで ○ が的から出たり、× が的に入ったりしないよう収める
    const d = Math.sqrt(x * x + y * y) || 1;
    if (m === '○' && d > 0.95) { x = (x / d) * 0.95; y = (y / d) * 0.95; }
    if (m === '×' && d < 1.06) { x = (x / d) * 1.06; y = (y / d) * 1.06; }
    return { x, y, targetType: 'hoshi24' };
  });
}

const 札 = ['#正規練習', '#自主稽古', '#合宿'];
const 題 = ['通常練習', '朝練', '記録会', '立ち稽古'];

export function 見本の記録(部員, いま) {
  const 出来 = [];
  const 一日 = 86400000;
  // 半年ぶんで90回。1人あたり150〜200射になり、順位も落ち着く
  for (let n = 0; n < 90; n++) {
    const 日 = new Date(いま - (n * 2 + (n % 3)) * 一日);
    日.setHours(18, 0, 0, 0);
    const 本数 = n % 5 === 0 ? 4 : 8;
    const 人数 = 5 + (n % 3);
    const 面々 = [];
    for (let k = 0; k < 人数; k++) 面々.push(部員[(n * 3 + k * 5) % 部員.length]);
    const archers = 面々.map((人, k) => {
      const i = 部員.indexOf(人);
      const marks = 的中(n * 100 + k, 実力(人, i), 本数);
      return {
        id: 'demo-a-' + n + '-' + k,
        memberId: 人.id,
        name: 人.name,
        marks,
        arrowLocations: 矢所(n * 100 + k, marks),
        lockedBlocks: {},
        substitutions: {},
        substitutionIds: {},
        bowWeight: null,
        lastModified: 日.getTime(),
      };
    });
    const 出欠 = {};
    for (const 人 of 部員) 出欠[人.id] = 面々.includes(人) ? 'present' : (n + 部員.indexOf(人)) % 5 === 0 ? 'absent' : 'present';
    出来.push({
      id: 'demo-s-' + n,
      lastModified: 日.getTime(),
      date: 日.getTime(),
      shotCount: 本数,
      archerNames: 面々.map((x) => x.name),
      note: '',
      includeInStats: true,
      archers,
      attendance: 出欠,
      tags: [札[n % 3]],
      title: 題[n % 4],
      syncStatus: '同期済み',
    });
  }
  return 出来;
}

// いま記録中の立ち（記録画面に写すもの）
export function 見本のいまの立ち(部員) {
  const 面々 = [部員[0], 部員[7], 部員[13], 部員[3], 部員[18]];
  return 面々.map((人, k) => {
    const i = 部員.indexOf(人);
    const marks = 的中(555 + k, 実力(人, i), 8);
    // 最後の1本だけ未入力にして「記録中」らしく見せる
    if (k >= 3) marks[7] = '';
    if (k === 4) { marks[6] = ''; marks[5] = ''; }
    return {
      id: 'demo-now-' + k,
      memberId: 人.id,
      name: 人.name,
      marks,
      arrowLocations: 矢所(555 + k, marks),
      lockedBlocks: {},
      substitutions: {},
      substitutionIds: {},
      bowWeight: null,
      lastModified: Date.now(),
    };
  });
}
