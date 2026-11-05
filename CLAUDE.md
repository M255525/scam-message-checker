# scam-message-checker — 詐騙訊息紅綠燈

長輩把可疑簡訊／LINE 訊息貼上或截圖，以紅黃綠燈顯示風險，附一鍵撥打 165、傳給家人。來源：樂齡軟體主題規劃表編號 1（安全防護）。2026-11-05 建立。

- 純靜態：`index.html`（CSS）＋`engine.js`（判讀）＋`app.js`（介面）＋`manual.html`＋PWA，GitHub Pages（`pages.yml`，push master 自動部署）：<https://m255525.github.io/scam-message-checker/>；visitor-badge `m255525.scammessagechecker`。
- 本機預覽 port **8864**（8852 next-bus-helper、8860 im-fine-checkin、8861 bp-glucose-notebook）。

## 設計原則
- 視覺＝台灣路口紅綠燈：深灰號誌燈箱、三顆燈、淺色路面底。字體芫荽（Iansui）＋Noto Sans TC。不要改成撕日曆、鐵窗、血壓計、站牌 LED（其他長輩工具已用）。
- 首頁一件事：貼訊息 → 幫我看看。165 按鈕首頁、結果頁、學一學都要看得到。
- 燈號不能只靠顏色：燈裡有 ✕ ! ✓，下面有文字結論。
- 文案：綠燈一定要說「不代表一定安全」；不可宣稱保證、不可冒充警政署或 165 官方。
- **隱私：訊息不上傳、不存 localStorage**（只放在記憶體 `draft`／`last`）。截圖辨識用 Tesseract.js 在瀏覽器裡做（第一次從 jsDelivr 下載 chi_tra 資料）。不串 AI。

## 判讀（engine.js）
- `RULES`：每條 `{id,w,crit,type,re,say}`。`crit` 一中就紅燈（監管帳戶、解除分期、遊戲點數／超商代碼、給驗證碼、寄存摺提款卡）。
- 分數 ≥7 紅、≥3 黃、其餘綠。另有組合加分（狀況＋連結、投資＋拉群、檢警＋錢／保密、親友＋匯款、交友＋錢、求職＋錢）。
- 連結：縮短網址、IP、可疑結尾、自稱政府卻非 gov.tw、仿官方網域、http、@。全部是乾淨 gov.tw 時不加分。
- `norm()` 全形轉半形、轉小寫後才比對。改規則一定要跑 `node tools/test_engine.mjs`（紅／黃／綠／空白各有案例，新增誤判請補進去）。

## 架構
- 路由 `#home`／`#result`／`#learn`。`#result` 沒有 `last` 時回首頁。
- PWA `share_target`（GET title/text/url）：Android 從 LINE「分享」進來會直接判讀，`readShared()` 讀完清掉網址。
- 家人電話存 `cfg.famTel`，結果頁出現「打給家人」。傳給家人兩顆鍵：「用 LINE 傳」是 `<a href=line.me/R/share?text=>`（`lineHref()`，選聯絡人／群組）；「其他方式」用 `navigator.share`，不支援就複製。分享內容經 `defang()` 把連結改成 hxxps／[.]，避免家人誤點，不要拿掉。
- 朗讀用 speechSynthesis（zh-TW）。儲存鍵前綴 `smc.`。測試掛鉤 `window._smc`。

## 標準配備
跑馬燈（工作區公告 GAS，滑鼠移入暫停，不可關）、⚙ 常用設定（收合式＋關於本工具）、首訪警語＋頁面入口、`manual.html#creator` 完整版、PWA、訪客計數器。
`manual.html` 由 `tools/build_manual.py` 組出（創作者區塊在 `tools/creator_block.html`），改手冊要改 `tools/manual_body.html` 再重跑。圖示由 `tools/make_icons.py` 產生。上線改版要升 `service-worker.js` 的 `CACHE_NAME`。

## 未驗證
手機真機（iPhone 剪貼簿權限、Android share_target、中文朗讀語音、截圖辨識速度）都還沒實測，只驗過桌面 Chromium 模擬手機尺寸。
