// 判讀引擎回歸測試：node tools/test_engine.mjs
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { check } = require('../engine.js');

const cases = [
  // ── 應該紅燈 ──
  ['red', '【中華郵政】您的包裹因地址不完整無法投遞，請於24小時內點擊 https://post-tw.top/a8 更新地址並補繳運費30元'],
  ['red', '[監理服務網]您有一筆交通違規罰鍰逾期未繳，今日內未繳將吊扣駕照，請立即繳納 http://mvdis-gov.xyz/pay'],
  ['red', '您好，這裡是台北地檢署，您的帳戶涉嫌洗錢案，偵查不公開，請勿告訴家人，需將存款轉入監管帳戶'],
  ['red', '親愛的會員您好，因系統錯誤您的訂單被設定為批發商，每月將重複扣款，請依客服指示到ATM解除分期'],
  ['red', '老師帶單，飆股每天穩賺10%，保證獲利！加入LINE群組 @abc123 免費領取明牌'],
  ['red', '媽，我換手機了，這是我新的LINE。我現在急用，可以先借我5萬嗎？匯到這個帳戶，先不要告訴爸'],
  ['red', '我是蝦皮客服，請把您手機收到的6位數驗證碼回傳給我，才能幫您退款'],
  ['red', '在家兼職日領3000，只要提供帳戶收款，把提款卡寄到公司即可'],
  ['red', '恭喜您抽中iPhone，請至超商購買遊戲點數2000元支付運費即可領取'],
  ['red', '【ETC】您的通行費欠費尚未繳納，請盡快點擊 reurl.cc/xYz9 繳清，逾期將加收罰款'],
  ['red', '親愛的寶貝，我是在敘利亞的維和軍醫，我寄給妳的包裹卡在海關，需要妳先匯關稅2萬元'],
  // ── 應該黃燈（要查證） ──
  ['yellow', '您的帳戶出現異常登入，請盡快重新驗證身分'],
  ['yellow', '投資理財課程，名師分析飆股，歡迎加入社團'],
  ['red', '請點擊連結領取您的點數回饋 https://bit.ly/3abc'],
  ['red', '【國稅局】您有一筆退稅款待領取，請至 https://tax-refund.online 填寫帳戶'],
  ['yellow', '您的帳號需要更新資料，請回覆身分證字號'],
  // ── 應該綠燈 ──
  ['green', '阿嬤，週末我們回去吃飯喔，要不要幫妳買水果？'],
  ['green', '里辦公處通知：本週六上午九點社區活動中心有健康講座，歡迎參加'],
  ['green', '您好，您預約的門診是11月12日上午10點，請記得攜帶健保卡'],
  ['green', '健保署提醒：可至 https://www.nhi.gov.tw 查詢就醫紀錄'],
  ['green', '您的信用卡本期帳單已出，請於期限內繳款'],
  ['green', '今天天氣很好，晚上一起去公園散步吧'],
  // ── 空白 ──
  ['empty', '  '],
];

let fail = 0;
for (const [want, text] of cases) {
  const r = check(text);
  const ok = r.level === want;
  if (!ok) fail++;
  console.log((ok ? 'ok  ' : 'FAIL') + ' ' + want.padEnd(6) + ' got ' + r.level.padEnd(6) + ' score ' + String(r.score).padStart(2) + '  ' + text.slice(0, 34) + (ok ? '' : '\n      ' + r.reasons.map(x => x.id + ':' + x.w).join(' ')));
}
console.log(fail ? `\n${fail} 個失敗` : `\n全部 ${cases.length} 個通過`);
process.exit(fail ? 1 : 0);
