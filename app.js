'use strict';
/* 詐騙訊息紅綠燈：訊息內容只在這支手機裡判讀，不上傳、不存檔。
   localStorage 鍵前綴 smc.，只存設定（字體、家人電話）和跑馬燈快取。 */

var $ = function(id){ return document.getElementById(id); };
function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function lsGet(k){ try { return localStorage.getItem('smc.' + k); } catch(e){ return null; } }
function lsSet(k, v){ try { localStorage.setItem('smc.' + k, v); return true; } catch(e){ return false; } }
function lsJson(k, d){ try { var v = JSON.parse(lsGet(k)); return v == null ? d : v; } catch(e){ return d; } }

var SITE = 'https://m255525.github.io/scam-message-checker/';
var TESS = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
var DEFAULT_CFG = {famName:'', famTel:'', speak:false};
var cfg = Object.assign({}, DEFAULT_CFG, lsJson('cfg', {}));
var draft = '';          // 輸入框內容（只在記憶體）
var last = null;         // 最近一次判讀 {text, r}
var ua = navigator.userAgent || '';
var ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
var standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
function saveCfg(){ lsSet('cfg', JSON.stringify(cfg)); }

var LEVEL = {
  red:   {title:'很可能是詐騙', sub:'先不要回覆、不要點連結、不要匯款', icon:'✕', lamp:'r'},
  yellow:{title:'要小心，先查證', sub:'有可疑的地方，問過人再決定', icon:'!', lamp:'y'},
  green: {title:'沒看到常見詐騙特徵', sub:'不代表一定安全，還是不確定就打 165', icon:'✓', lamp:'g'}
};
var DO = {
  red:['不要點裡面的連結，不要回覆、不要回撥訊息裡的電話。', '不要匯款、不要買點數、不要給驗證碼或密碼。', '打 165 反詐騙專線問問看，或傳給家人確認。', '如果已經匯款或給了資料，<b>馬上打 165</b>，並打給銀行請他們止付。'],
  yellow:['先停一下，不要急著照著做。', '自己打「官方電話」或打開官方 App 查，不要用訊息裡的電話或連結。', '問家人，或打 165 問問看。'],
  green:['沒有看到常見的詐騙說法，可以照平常方式處理。', '如果對方之後開始談錢、要資料、要您點連結，再貼進來看一次。']
};
var SAMPLES = [
  ['假包裹', '【中華郵政】您的包裹因地址不完整無法投遞，請於24小時內點擊 https://post-tw.top/a8 更新地址並補繳運費30元'],
  ['假親友', '媽，我換手機了，這是我新的LINE。我現在急用，可以先借我5萬嗎？匯到這個帳戶，先不要告訴爸'],
  ['帳號異常', '您的帳戶出現異常登入，請盡快重新驗證身分'],
  ['一般訊息', '阿嬤，週末我們回去吃飯喔，要不要幫妳買水果？']
];
var LEARN = [
  ['💹', '假投資', '陌生人拉您進 LINE 群組，「老師」報飆股、說穩賺不賠，先讓您小賺，再要您加碼匯大筆錢，最後出不了金。', '保證賺錢的，一定是騙局。'],
  ['👮', '假檢警', '自稱警察、檢察官、法院，說您的帳戶涉及洗錢，要您把錢轉到「監管帳戶」，還叫您不能告訴家人。', '檢警不會叫您轉錢，也不會叫您保密。'],
  ['🛒', '假網拍客服', '說您網購時被設成「批發商」或「分期付款」，會重複扣款，要您去 ATM 或網銀「解除設定」。', 'ATM 只能轉出錢，不能取消扣款。'],
  ['📞', '假親友借錢', '「猜猜我是誰？」「我換號碼了」，假裝是兒孫、朋友，說急用要借錢。', '先打原本存的電話，問本人。'],
  ['📦', '假簡訊連結', '假裝郵局、物流、ETC、監理站、電信公司，說包裹送不到、有欠費、帳號異常，要您點連結輸入信用卡。', '有狀況就自己開官方 App 查，不點簡訊連結。'],
  ['🎁', '假中獎／假補助', '說您中獎、可以領補助或退稅，要先付手續費、運費，或填銀行帳號密碼。', '要先付錢才能領的，都是假的。'],
  ['💼', '假求職', '在家輕鬆賺、日領高薪、按讚做任務，最後要您先儲值，或把存摺、提款卡寄過去。', '存摺、提款卡、帳戶不給別人用。'],
  ['💕', '假交友', '網友很會說好聽話，自稱軍醫、海外工程師，沒見過面就開始談投資、包裹關稅、借錢。', '沒見過面就談錢的，就是騙子。']
];

/* ---------- 畫面 ---------- */
function foot(){ return '<div class="foot"><a href="#learn">常見詐騙手法</a><a href="#" data-act="warn">⚠ 使用警語</a><a href="manual.html">操作手冊</a><a href="#" data-act="settings">⚙ 常用設定</a></div>'; }
function topBar(title, back){ return '<div class="top">' + (back ? '<a class="back" href="#home" style="display:flex;align-items:center;text-decoration:none">← 回首頁</a>' : '') + '<h1>' + esc(title) + '</h1>' + (back ? '' : '<button class="gear" data-act="settings" aria-label="常用設定">⚙</button>') + '</div>'; }
function signal(on, big){
  var cls = 'signal' + (big ? ' big' : '') + (on ? '' : ' idle');
  return '<div class="' + cls + '" aria-hidden="true">' + ['r', 'y', 'g'].map(function(k){ var lv = {r:'red', y:'yellow', g:'green'}[k]; return '<div class="lamp ' + k + (on === k ? ' on' : '') + '"><span>' + LEVEL[lv].icon + '</span></div>'; }).join('') + '</div>';
}
function callBtns(){
  var h = '<a class="btn call" href="tel:165">☎ 打 165 反詐騙專線</a>';
  if(cfg.famTel) h += '<a class="btn alt" href="tel:' + esc(cfg.famTel.replace(/[^\d+]/g, '')) + '">☎ 打給' + esc(cfg.famName || '家人') + '</a>';
  return h;
}

function viewHome(){
  return topBar('詐騙訊息紅綠燈') +
    '<div class="body">' +
    signal(null) +
    '<p class="hint">收到怪怪的訊息？貼進來，幫您看看危不危險</p>' +
    '<label for="msg" class="small" style="font-weight:700;color:var(--ink)">把簡訊或 LINE 訊息貼在這裡</label>' +
    '<textarea id="msg" class="msg" placeholder="長按這裡，選「貼上」">' + esc(draft) + '</textarea>' +
    '<div class="row2"><button class="btn alt" data-act="paste">📋 貼上</button><button class="btn alt" data-act="shot">📷 用截圖</button></div>' +
    '<div id="ocrBox"></div>' +
    '<button class="btn go" data-act="check">幫我看看</button>' +
    '<a class="btn call" href="tel:165">☎ 打 165 問問看</a>' +
    '<p class="small" style="margin:.2rem 0 0">還沒有可疑訊息？試試看範例：</p>' +
    '<div class="chips">' + SAMPLES.map(function(s, i){ return '<button class="chip" data-sample="' + i + '">' + s[0] + '</button>'; }).join('') + '</div>' +
    '<p class="small" style="margin:.3rem 0 0">🔒 訊息只在這支手機裡判讀，不會上傳。</p>' +
    '</div>' + foot();
}

function viewResult(){
  var r = last.r, L = LEVEL[r.level];
  var why = r.reasons.filter(function(x){ return x.say; });
  var h = topBar('判讀結果', true) + '<div class="body">' +
    signal(L.lamp, true) +
    '<div class="verdict ' + r.level + '" role="status"><h2>' + L.title + '</h2><p>' + L.sub + '</p></div>';
  if(r.types.length && r.level !== 'green') h += '<p style="margin:0;text-align:center"><span class="small">看起來像：</span>' + r.types.slice(0, 2).map(function(t){ return '<span class="tag">' + esc(t) + '</span>'; }).join('') + '</p>';
  h += '<div class="stack" style="margin:0">' + callBtns() + '<a class="btn line" href="' + esc(lineHref()) + '" target="_blank" rel="noopener">💬 用 LINE 傳給家人問問</a>' +
    '<button class="btn alt" data-act="share">📤 用其他方式傳送</button></div>' +
    '<p class="small" style="margin:0">按 LINE 後選要傳的家人或群組就好，訊息裡的連結會改成不能點。</p>';
  if(why.length) h += '<div class="card"><h3>為什麼這樣判斷</h3><ul>' + why.slice(0, 6).map(function(x){ return '<li>' + esc(x.say) + '</li>'; }).join('') + '</ul></div>';
  h += '<div class="card"><h3>現在該怎麼做</h3><ol>' + DO[r.level].map(function(x){ return '<li>' + x + '</li>'; }).join('') + '</ol></div>';
  if(r.urls.length) h += '<div class="card"><h3>訊息裡的連結</h3><ul>' + r.urls.slice(0, 4).map(function(u){ return '<li><span class="url">' + esc(u.host) + '</span>' + (u.isGov && !u.flags.length ? '　是 gov.tw 政府網址' : '　<b style="color:var(--red)">先不要點</b>') + '</li>'; }).join('') + '</ul></div>';
  h += '<div class="card"><h3>您貼的訊息</h3><div class="quote">' + esc(last.text) + '</div></div>' +
    '<div class="row2"><button class="btn alt" data-act="speak">🔊 唸給我聽</button><button class="btn alt" data-act="again">再查一則</button></div>' +
    '<p class="small" style="margin:.2rem 0 0">這是依常見詐騙說法判斷的參考結果，不是保證。騙子的說法一直在變，還是不確定就打 165。</p>' +
    '</div>' + foot();
  return h;
}

function viewLearn(){
  return topBar('常見詐騙手法', true) + '<div class="body"><p style="margin:0">點開來看，每一種只要記住一句話。</p><div class="learn">' +
    LEARN.map(function(x){ return '<details><summary><span style="font-size:1.4rem">' + x[0] + '</span>' + x[1] + '</summary><div class="lb"><p style="margin:0">' + x[2] + '</p><div class="rem">記住：' + x[3] + '</div></div></details>'; }).join('') +
    '</div><div class="card"><h3>萬一已經被騙</h3><ol><li>馬上打 <b>165</b> 反詐騙專線（緊急危險打 110）。</li><li>打給銀行客服，請他們止付、凍結。</li><li>留下對話截圖、匯款單，不要刪掉。</li><li>這不是您的錯，騙子是專業的，趕快告訴家人一起處理。</li></ol></div>' +
    '<a class="btn call" href="tel:165">☎ 打 165 反詐騙專線</a></div>' + foot();
}

function route(){
  var h = location.hash || '#home';
  if(h === '#result' && !last) h = '#home';
  var app = $('app'); closeModal();
  app.innerHTML = h === '#result' ? viewResult() : h === '#learn' ? viewLearn() : viewHome();
  var m = $('msg'); if(m) m.addEventListener('input', function(){ draft = m.value; });
  window.scrollTo(0, 0);
  if(h === '#result' && cfg.speak) speak();
}
function go(h){ if(location.hash !== h) location.hash = h; else route(); }

/* ---------- 判讀 ---------- */
function runCheck(text){
  text = String(text || '').trim();
  if(!text){ toast('請先把訊息貼進來'); var m = $('msg'); if(m) m.focus(); return; }
  var r = SMC.check(text);
  if(r.level === 'empty'){ toast('字太少了，請把整則訊息貼進來'); return; }
  last = {text:text, r:r}; draft = text;
  go('#result');
}

/* ---------- 截圖辨識（在手機上做，不上傳） ---------- */
var tessP = null;
function loadTess(){
  if(window.Tesseract) return Promise.resolve();
  if(tessP) return tessP;
  tessP = new Promise(function(ok, no){ var s = document.createElement('script'); s.src = TESS; s.onload = ok; s.onerror = function(){ tessP = null; no(); }; document.head.appendChild(s); });
  return tessP;
}
function ocrUI(txt, pct){ var b = $('ocrBox'); if(b) b.innerHTML = txt ? '<div class="ocr" role="status">' + txt + '<div class="bar"><i style="width:' + Math.round((pct || 0) * 100) + '%"></i></div></div>' : ''; }
function ocrFile(f){
  if(!f) return;
  if(!lsGet('ocrOk')){
    openModal('<h2>📷 用截圖辨識文字</h2><p>手機會自己把截圖上的字讀出來，<b>截圖不會上傳</b>。</p><p>第一次使用要先下載文字辨識資料（約 10 MB），建議連 Wi-Fi。之後就快了。</p><div class="stack"><button class="btn" data-act="ocrGo">好，開始辨識</button><button class="btn alt" data-act="close">先不要</button></div>');
    pendingShot = f; return;
  }
  doOcr(f);
}
var pendingShot = null;
function doOcr(f){
  ocrUI('準備文字辨識…', .05);
  loadTess().then(function(){
    return Tesseract.createWorker('chi_tra', 1, {logger:function(m){
      if(m.status === 'recognizing text') ocrUI('正在讀截圖上的字…', .5 + m.progress / 2);
      else if(/load|download/.test(m.status)) ocrUI('第一次使用，下載辨識資料中…', (m.progress || 0) / 2);
    }});
  }).then(function(w){
    return w.recognize(f).then(function(res){ w.terminate(); return res.data.text; });
  }).then(function(t){
    t = String(t || '').replace(/([㐀-鿿＀-￯，。、！？：；「」（）])\s+(?=[㐀-鿿＀-￯，。、！？：；「」（）])/g, '$1').replace(/\n{3,}/g, '\n\n').trim();
    ocrUI('');
    if(t.replace(/\s/g, '').length < 4){ toast('截圖上讀不到字，請換一張清楚一點的'); return; }
    draft = t; var m = $('msg'); if(m) m.value = t;
    toast('讀好了，請看一下字對不對，再按「幫我看看」');
  }).catch(function(){ ocrUI(''); toast('截圖辨識失敗，可能是網路不穩。也可以直接複製文字貼上'); });
}

/* ---------- 分享、朗讀 ---------- */
function shareText(){
  var L = LEVEL[last.r.level];
  return '我收到這則訊息，「詐騙訊息紅綠燈」說：' + L.title + '。你幫我看看是真的假的？\n\n「' + defang(last.text.slice(0, 500)) + (last.text.length > 500 ? '…' : '') + '」\n（訊息裡的連結已改成不能點，避免誤點）\n\n' + SITE;
}
// 把可疑連結改成點不開的寫法（hxxps、[.]），家人在 LINE 裡才不會誤點
function defang(s){
  var t = String(s);
  SMC.findUrls(t).forEach(function(u){ t = t.split(u.url).join(u.url.replace(/^http/i, 'hxxp').replace(/\./g, '[.]')); });
  return t;
}
function lineHref(){ return 'https://line.me/R/share?text=' + encodeURIComponent(shareText()); }
function share(){
  var t = shareText();
  if(navigator.share) return navigator.share({text:t}).catch(function(){});
  if(navigator.clipboard) navigator.clipboard.writeText(t).then(function(){ toast('已複製，請貼到要傳的地方'); }).catch(function(){ toast('這支手機不支援，請改用 LINE 傳'); });
}
function speak(){
  if(!('speechSynthesis' in window)){ toast('這支手機不支援朗讀'); return; }
  var r = last.r, L = LEVEL[r.level];
  var s = L.title + '。' + L.sub + '。' + r.reasons.filter(function(x){ return x.say; }).slice(0, 3).map(function(x){ return x.say; }).join('') + DO[r.level].map(function(x){ return x.replace(/<[^>]+>/g, ''); }).join('');
  speechSynthesis.cancel();
  var u = new SpeechSynthesisUtterance(s); u.lang = 'zh-TW'; u.rate = .9;
  var v = speechSynthesis.getVoices().filter(function(v){ return /zh[-_]TW/i.test(v.lang); })[0]; if(v) u.voice = v;
  speechSynthesis.speak(u);
}

/* ---------- 對話框、提示 ---------- */
function openModal(h){ $('modalBox').innerHTML = h; $('modal').classList.add('show'); $('modalBox').scrollTop = 0; }
function closeModal(){ $('modal').classList.remove('show'); }
var toastT;
function toast(m){
  var o = document.querySelector('.toast'); if(o) o.remove();
  var t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = m;
  document.body.appendChild(t); clearTimeout(toastT); toastT = setTimeout(function(){ t.remove(); }, 3600);
}
var WARN_HTML = '<h2>⚠ 使用警語</h2>' +
  '<p><b>這是幫忙提醒的參考工具，不能保證判斷正確。</b>它是依台灣常見的詐騙說法比對，騙子的話術一直在變，綠燈不代表一定安全，紅燈也可能誤判。</p>' +
  '<ul>' +
  '<li>還是不確定，請打 <b>165</b> 反詐騙專線，或問家人。遇到緊急危險請打 <b>110</b>。</li>' +
  '<li>已經匯款或給了資料，請馬上打 165，並聯絡銀行止付。</li>' +
  '<li>您貼的訊息<b>只在這支手機裡判讀，不會上傳</b>，也不會存起來。截圖辨識也在手機上做，第一次要下載辨識資料。</li>' +
  '<li>本工具不是警政署或任何政府機關的服務。</li></ul>';
function showWarn(){ openModal(WARN_HTML + '<div class="stack sticky"><button class="btn" data-act="close">我知道了</button></div>'); }
function sec(id, title, val, body){ return '<details class="set-sec" data-sec="' + id + '"><summary><span class="sst">' + title + '</span><span class="ssv">' + esc(val) + '</span></summary><div class="set-body">' + body + '</div></details>'; }
function openSettings(){
  var h = '<div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.4rem"><h2 style="flex:1 1 0;margin:0">⚙ 常用設定</h2><button class="link" data-act="foldall">全部展開／收合</button></div>' +
    sec('fam', '要問的家人', cfg.famName || (cfg.famTel ? cfg.famTel : '還沒填'), '<p class="small">填了之後，結果畫面會多一顆「打給家人」的按鈕。只存在這支手機。</p><label class="fld">怎麼稱呼<input id="sFamName" placeholder="例如 大兒子" value="' + esc(cfg.famName) + '"></label><label class="fld">電話<input id="sFamTel" inputmode="tel" placeholder="例如 0912345678" value="' + esc(cfg.famTel) + '"></label><div class="stack"><button class="btn" data-act="saveFam">儲存</button></div>') +
    sec('fs', '字體大小', lsGet('fs') === 'xl' ? '特大' : '大', '<div class="row2"><button class="btn' + (lsGet('fs') === 'xl' ? ' alt' : '') + '" data-fs="l">大</button><button class="btn' + (lsGet('fs') === 'xl' ? '' : ' alt') + '" data-fs="xl">特大</button></div><div class="stack"><button class="btn alt" data-act="hc">高對比：' + (lsGet('hc') === '1' ? '開' : '關') + '</button></div>') +
    sec('voice', '自動唸結果', cfg.speak ? '開' : '關', '<p class="small">開了之後，看完訊息會自動唸出結果。</p><div class="stack"><button class="btn alt" data-act="toggleSpeak">自動唸結果：' + (cfg.speak ? '開' : '關') + '</button></div>') +
    sec('about', '關於本工具', '', '<p>👤 創作者 Mark Tsai（蔡豐全）<br><a href="mailto:tsaimark@gmail.com">tsaimark@gmail.com</a></p><div class="stack"><a class="btn alt" href="manual.html">📖 操作手冊</a><a class="btn alt" href="manual.html#creator">👤 關於創作者</a><button class="btn alt" data-act="warn">⚠ 使用警語</button>' + (standalone ? '' : '<button class="btn alt" data-act="install">📲 加入主畫面</button>') + '</div><p class="small" style="margin-top:.5rem">訪客數 <img src="https://visitor-badge.laobi.icu/badge?page_id=m255525.scammessagechecker" alt="訪客次數" height="20" loading="lazy" style="vertical-align:middle"></p>') +
    '<div class="stack"><button class="btn" data-act="close">關閉</button></div>';
  openModal(h);
  var open = lsJson('fold', []);
  document.querySelectorAll('.set-sec').forEach(function(d){ d.open = open.indexOf(d.dataset.sec) >= 0; d.addEventListener('toggle', saveFold); });
}
function saveFold(){ var o = []; document.querySelectorAll('.set-sec').forEach(function(d){ if(d.open) o.push(d.dataset.sec); }); lsSet('fold', JSON.stringify(o)); }
function applyView(){
  document.documentElement.dataset.fs = lsGet('fs') === 'xl' ? 'xl' : 'l';
  if(lsGet('hc') === '1') document.documentElement.dataset.hc = '1'; else delete document.documentElement.dataset.hc;
}

var acts = {
  check: function(){ var m = $('msg'); runCheck(m ? m.value : draft); },
  paste: function(){
    if(!navigator.clipboard || !navigator.clipboard.readText){ toast('請長按輸入框，選「貼上」'); return; }
    navigator.clipboard.readText().then(function(t){
      if(!t || !t.trim()){ toast('剪貼簿是空的，請先在訊息上長按選「複製」'); return; }
      draft = t; $('msg').value = t; toast('貼上了，按「幫我看看」');
    }).catch(function(){ toast('請長按輸入框，選「貼上」'); });
  },
  shot: function(){ var f = $('shotFile'); f.value = ''; f.click(); },
  ocrGo: function(){ lsSet('ocrOk', '1'); closeModal(); if(pendingShot){ doOcr(pendingShot); pendingShot = null; } },
  again: function(){ draft = ''; last = null; go('#home'); setTimeout(function(){ var m = $('msg'); if(m) m.focus(); }, 50); },
  share: share, speak: speak, warn: showWarn, close: closeModal, settings: openSettings,
  foldall: function(){ var l = document.querySelectorAll('.set-sec'), any = Array.prototype.some.call(l, function(d){ return d.open; }); l.forEach(function(d){ d.open = !any; }); },
  saveFam: function(){ cfg.famName = $('sFamName').value.trim().slice(0, 20); cfg.famTel = $('sFamTel').value.replace(/[^\d+#\-\s]/g, '').trim().slice(0, 20); saveCfg(); closeModal(); toast('存好了'); route(); },
  hc: function(){ lsSet('hc', lsGet('hc') === '1' ? '0' : '1'); applyView(); openSettings(); },
  toggleSpeak: function(){ cfg.speak = !cfg.speak; saveCfg(); openSettings(); },
  install: function(){
    if(window._dp){ window._dp.prompt(); window._dp.userChoice.finally(function(){ window._dp = null; }); return; }
    openModal('<h2>📲 加入主畫面</h2>' + (ios ? '<p>iPhone／iPad：用 Safari 打開，按下方「分享」圖示（方框加箭頭），選「加入主畫面」。</p>' : '<p>按瀏覽器右上角「⋮」，選「加到主畫面」或「安裝應用程式」。</p>') + '<p class="small">加入後，可以從 LINE 訊息直接「分享」到這個工具（Android）。</p><div class="stack"><button class="btn" data-act="close">知道了</button></div>');
  }
};
document.addEventListener('click', function(e){
  var t = e.target.closest('[data-act],[data-sample],button[data-fs]'); if(!t) return;
  if(t.dataset.sample != null){ var s = SAMPLES[+t.dataset.sample]; draft = s[1]; $('msg').value = s[1]; runCheck(s[1]); return; }
  if(t.dataset.fs){ lsSet('fs', t.dataset.fs); applyView(); openSettings(); return; }
  var a = acts[t.dataset.act]; if(a){ e.preventDefault(); a(); }
});
$('modal').addEventListener('click', function(e){ if(e.target.id === 'modal') closeModal(); });
$('shotFile').addEventListener('change', function(e){ ocrFile(e.target.files[0]); });
window.addEventListener('hashchange', route);

/* ---------- 跑馬燈（工作區共用公告，不可關） ---------- */
function initMarquee(){
  var URL_ = "https://script.google.com/macros/s/AKfycbwKX0DNNbY8y4nf90BFTHtxgfqJcHHcZasRrgycl4QAe52_hkjMWSkYk4xOsqU-JPCROw/exec";
  var REFRESH = 20 * 60 * 1000, bar = $('marqueeBar'), track = $('marqueeTrack'), lastKey = null;
  function appendText(c, text){ var re = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, li = 0, m; while((m = re.exec(text))){ if(m.index > li) c.appendChild(document.createTextNode(text.slice(li, m.index))); var a = document.createElement('a'); a.href = m[2]; a.textContent = m[1]; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.style.color = 'inherit'; a.style.textDecoration = 'underline'; c.appendChild(a); li = re.lastIndex; } if(li < text.length) c.appendChild(document.createTextNode(text.slice(li))); }
  function renderM(items){
    if(!items || !items.length) return;
    var k = JSON.stringify(items); if(k === lastKey) return; lastKey = k; track.innerHTML = '';
    var fr = document.createDocumentFragment();
    function pass(){ items.forEach(function(it, i){ if(i > 0) fr.appendChild(document.createTextNode('　★　')); appendText(fr, String(it)); }); }
    pass(); fr.appendChild(document.createTextNode('　★　')); pass(); track.appendChild(fr);
    bar.classList.add('show'); document.body.classList.add('has-marquee');
    track.style.animationDuration = Math.max(track.scrollWidth / 2 / 60, 12) + 's';
  }
  function fetchM(){ fetch(URL_, {method:'POST', body:JSON.stringify({serial:''})}).then(function(r){ return r.json(); }).then(function(d){ if(d && Array.isArray(d.marquee) && d.marquee.length){ lsSet('marquee', JSON.stringify(d.marquee)); renderM(d.marquee); } }).catch(function(){}); }
  renderM(lsJson('marquee', [])); fetchM(); setInterval(fetchM, REFRESH);
}

/* ---------- 從其他 App「分享」進來（PWA share_target） ---------- */
function readShared(){
  var q = new URLSearchParams(location.search), t = [q.get('title'), q.get('text'), q.get('url')].filter(Boolean).join('\n').trim();
  if(!t) return false;
  history.replaceState(null, '', location.pathname + '#home');
  runCheck(t); return true;
}

window.addEventListener('beforeinstallprompt', function(e){ e.preventDefault(); window._dp = e; });
if('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('service-worker.js').catch(function(){});
applyView(); initMarquee();
if(!readShared()) route();
if(!lsGet('warnSeen')){ lsSet('warnSeen', '1'); showWarn(); }
window._smc = {route:route, runCheck:runCheck, get last(){ return last; }};
