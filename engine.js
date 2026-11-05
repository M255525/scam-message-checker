'use strict';
/* 詐騙訊息紅綠燈：判讀引擎。純規則、全在瀏覽器裡跑，不呼叫任何外部服務。
   check(text) → {level:'red'|'yellow'|'green'|'empty', score, reasons:[{id,say,w}], urls:[...], types:[...]}
   改規則後跑 node tools/test_engine.mjs。 */
(function(root){

  // 全形轉半形、去掉零寬字元與多餘空白，英文轉小寫（只用來比對，畫面上顯示原文）
  function norm(s){
    return String(s || '')
      .replace(/[！-～]/g, function(c){ return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); })
      .replace(/　/g, ' ')
      .replace(/[​-‍﻿]/g, '')
      .replace(/[ \t]+/g, ' ')
      .toLowerCase();
  }

  /* 規則：w 權重；crit=true 一出現就是紅燈；type 手法分類（給「這像哪一種」用）。
     say 寫給長輩看：白話、不嚇人、說明「為什麼可疑」。 */
  var RULES = [
    // ── 一出現就紅燈的關鍵手法 ──
    {id:'jianguan', crit:true, w:8, type:'假檢警', re:/監管(帳戶|帳號|科)|安全帳戶|資金(清查|監管)|偵查不公開/,
      say:'提到「監管帳戶」「偵查不公開」。警察、檢察官不會要您把錢轉到任何帳戶，也不會叫您保密。'},
    {id:'fenqi', crit:true, w:8, type:'假網拍客服', re:/解除(分期|設定|扣款|訂單)|(重複|多次|錯誤)扣款|誤設(為)?|升級(成|為)?(vip|批發商|會員)|設定錯誤/,
      say:'說要「解除分期」或「取消重複扣款」。這是最常見的假客服手法，銀行不會叫您去 ATM 或網銀操作來取消。'},
    {id:'giftcard', crit:true, w:8, type:'假網拍客服', re:/遊戲點數|點數卡|mycard|gash|禮品卡|gift ?card|超商(代碼|代收)|代碼繳費|ibon.{0,6}(代碼|繳費)/,
      say:'要您買遊戲點數或用超商代碼繳費。正派的公司和政府機關不會用點數收錢。'},
    {id:'otp', crit:true, w:8, type:'盜帳號', re:/(驗證碼|認證碼|簡訊碼|otp|動態密碼|一次性密碼|6 ?位數(字|碼)).{0,14}(給|告訴|提供|回傳|回覆|傳|輸入|截圖)|(給|告訴|提供|回傳|回覆|傳).{0,10}(驗證碼|認證碼|簡訊碼|otp|動態密碼)/,
      say:'要您提供手機收到的驗證碼。驗證碼就像家門鑰匙，給了別人，帳號或錢就會被拿走。'},
    {id:'passbook', crit:true, w:8, type:'假求職', re:/(寄|交|給|提供|出租|租借|借用|收購|收).{0,6}(存摺|提款卡|金融卡|帳戶|網銀帳密)|(存摺|提款卡|金融卡).{0,6}(寄|交給|出租|租借)|收簿|租簿/,
      say:'要您寄出或出借存摺、提款卡、帳戶。這些會被拿去騙別人，您自己也可能吃上官司。'},

    // ── 單看不一定，但累積起來就危險 ──
    {id:'invest_sure', w:5, type:'假投資', re:/保證(獲利|賺|回本|收益)|穩賺|穩定獲利|零風險|無風險|保本|包賺|只賺不賠|月(入|賺)\s*\d+\s*(萬|w)|翻倍|(報酬|獲利|收益)(率)?\s*\d{2,}\s*%/,
      say:'保證會賺錢、零風險。真的投資一定有風險，說「穩賺」的幾乎都是騙局。'},
    {id:'invest', w:3, type:'假投資', re:/飆股|帶單|投顧|老師|助理|內線|主力|飆漲|當沖|抽籤|新股認購|虛擬貨幣|加密貨幣|usdt|泰達幣|比特幣|投資(群|社團|課程|平台)|理財(群|社團)|入金|出金/,
      say:'提到飆股、老師帶單、投資群組或虛擬貨幣。假投資是台灣被騙金額最多的手法。'},
    {id:'police', w:4, type:'假檢警', re:/地檢署|檢察官|法院|刑事局|刑事警察|警察局|派出所|偵查隊|(涉(及|嫌)|捲入).{0,6}(案|洗錢|詐欺)|洗錢|通緝|拘票|傳票|筆錄|人頭帳戶/,
      say:'自稱警察、檢察官或法院，說您涉案。真的機關會寄紙本公文，不會用電話或 LINE 要您處理錢。'},
    {id:'relative', w:4, type:'假親友借錢', re:/猜猜我是誰|我是你(的)?(兒子|女兒|孫子|孫女|外甥|姪子|姪女|朋友|同學)|(換|改)了?(手機|號碼|電話|新號|line)|新的\s*line|(先|幫我)?(借|周轉|週轉)(一下|點|個)?.{0,6}(錢|萬|元)|急用/,
      say:'像是親友換了號碼、急著借錢。請用您原本存的電話打回去問本人，不要用訊息裡的號碼。'},
    {id:'secret', w:4, type:'', re:/不要(告訴|跟|讓).{0,6}(家人|小孩|兒子|女兒|銀行|行員|別人|任何人)|別(告訴|跟).{0,6}(家人|銀行|別人)|不能(說|告訴)|要保密|保密/,
      say:'叫您保密、不要告訴家人或銀行。這是詐騙最大的特徵——怕您問了就發現。'},
    {id:'money', w:3, type:'', re:/匯款|轉帳|匯到|轉到|匯入|轉入|指定帳戶|約定帳戶|atm|提款機|網路銀行|網銀|無卡(提款|存款)|面交|領(現|出)|現金/,
      say:'要您匯款、轉帳或去 ATM 操作。只要對方要您動錢，就先停下來查證。'},
    {id:'bankinfo', w:4, type:'盜帳號', re:/身分證(字號|號碼|正反面)|信用卡(號|卡號|背面)|卡片背面|安全碼|cvv|提款(卡)?密碼|網銀(帳號|密碼|帳密)|帳號密碼|登入密碼/,
      say:'要您提供身分證、信用卡號或密碼。正派單位不會用訊息要這些資料。'},
    {id:'urgent', w:2, type:'', re:/立即|立刻|馬上|盡快|儘速|今(天|日)(內|之前|為止|截止)|\d+\s*(小時|分鐘)(內|後)|逾期|否則|將(被|會)?(停用|凍結|註銷|停話|斷電|停水|起訴|移送)|最後(通知|期限|一次)|限時|即將(過期|失效|到期)/,
      say:'催您馬上處理，不然會怎樣。騙子最怕您有時間想清楚。'},
    {id:'prize', w:2, type:'假中獎／假補助', re:/中獎|得獎|抽中|恭喜(您|你)|免費(領|送|拿)|領取|獎金|紅包|禮金|退稅|退費|補助(款|金)?|津貼|普發|振興|現金回饋|點數(即將)?(到期|過期)/,
      say:'說您中獎、可以領錢或領補助。政府補助不會傳連結要您填銀行資料。'},
    {id:'parcel', w:2, type:'假物流', re:/包裹|快遞|宅配|物流|貨件|配送|派送|投遞|地址(不(完整|全|正確)|有誤)|補(繳)?運費|重新(安排|配送)|關稅/,
      say:'說包裹送不到、要補運費。物流公司不會傳連結要您刷卡補錢。'},
    {id:'bill', w:2, type:'假帳單／欠費', re:/欠費|未繳|欠繳|逾期未繳|待繳|繳費通知|etc|通行費|罰單|罰鍰|罰款|監理(站|所|服務)|交通違規|電費|水費|瓦斯費|停電|停水|停話|健保(費|卡)/,
      say:'說您有欠費、罰單沒繳。請自己打開官方 App 或打官方電話查，不要點訊息裡的連結。'},
    {id:'account', w:2, type:'盜帳號', re:/帳(戶|號)(異常|停用|鎖定|凍結|被盜)|登入異常|異常(登入|交易|使用)|安全(驗證|認證)|重新(驗證|認證|登入|綁定)|更新(您的)?(資料|資訊|個資)|身分(驗證|確認)/,
      say:'說您的帳號異常、要重新驗證。這常是假網站，要騙您輸入帳號密碼。'},
    {id:'job', w:3, type:'假求職', re:/在家(工作|兼職|賺)|輕鬆(賺|入帳|月入)|日(領|薪)\s*\d|高薪|兼職|打字員|按讚(賺|任務)|刷單|做任務|代購|代收(包裹|款)|提供帳戶|免經驗.{0,6}(高薪|日領)/,
      say:'輕鬆在家賺錢、按讚做任務。這類工作常常最後要您先付錢或交出帳戶。'},
    {id:'romance', w:2, type:'假交友', re:/寶貝|親愛的|軍醫|維和|聯合國|石油平台|海外(工作|派駐)|想見你|我們的未來/,
      say:'像網路交友的甜言蜜語。網友沒見過面就談錢、談投資，幾乎都是詐騙。'},
    {id:'addline', w:1, type:'', re:/加(入)?\s*(line|賴|好友|群組)|line\s*(id|：|:)|官方帳號|私訊|點擊.{0,4}(加入|好友)|telegram|whatsapp/,
      say:'要您加 LINE 或進群組。陌生人拉您進群組，常常是假投資的第一步。'},
    {id:'govclaim', w:1, type:'', re:/政府|國稅局|財政部|監理|健保署|衛福部|勞保局|勞動部|戶政|中華郵政|郵局|台電|自來水|內政部|經濟部|數位發展部/,
      say:''}   // 只用來判斷「自稱政府但連結不是 gov.tw」，不單獨顯示
  ];

  var SHORT = /^(bit\.ly|reurl\.cc|tinyurl\.com|lihi\d?\.(cc|com|me)|pse\.is|t\.ly|is\.gd|goo\.gl|cutt\.ly|rb\.gy|s\.id|shorturl\.at|ppt\.cc|t\.co|tiny\.cc|ow\.ly|rebrand\.ly|bit\.do|x\.gd|v\.gd|url\.cn|qrco\.de|0rz\.tw|lurl\.cc|maac\.io)$/;
  var BAD_TLD = /\.(top|xyz|cc|vip|icu|shop|click|buzz|sbs|cyou|live|online|site|club|work|fun|monster|rest|bond|today|win|loan|cfd|lat|ink|mom|my|ru|cn)$/;
  var BRAND = /(gov|etc|post|cht|chunghwa|taipower|water|tax|nhi|mvdis|bank|line|apple|google|shopee|momo|pchome|7-?11|family|fami|ctbc|cathay|esun|fubon|taishin|sinopac|mega|richart|jkopay|linepay)/;

  function findUrls(raw){
    var t = String(raw || '').replace(/[！-～]/g, function(c){ return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); });
    var re = /\b((?:https?:\/\/|www\.)[^\s<>"'，。、！？「」（）]+|(?:[a-z0-9-]+\.)+(?:com|net|org|tw|cc|top|xyz|vip|icu|shop|click|buzz|sbs|cyou|live|online|site|club|work|fun|io|me|ly|gd|is|co|info|biz|app|link|ink|win|loan|lat|cfd|bond|my|ru|cn)(?:\/[^\s<>"'，。、！？「」（）]*)?)/gi;
    var out = [], m, seen = {};
    while((m = re.exec(t))){
      var u = m[1].replace(/[.,;:)\]]+$/, '');
      var host = u.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split(/[\/?#:]/)[0].toLowerCase();
      if(!host || seen[u]) continue;
      seen[u] = 1;
      out.push({url:u, host:host, http:/^http:\/\//i.test(u)});
    }
    return out;
  }

  function judgeUrl(u, govClaim){
    var flags = [];
    var isGov = /(^|\.)gov\.tw$/.test(u.host);
    if(/^\d{1,3}(\.\d{1,3}){3}$/.test(u.host)) flags.push({w:4, say:'連結是一串數字（IP），正派網站不會這樣。'});
    if(SHORT.test(u.host)) flags.push({w:3, say:'是「縮短網址」，看不出真正會連到哪裡。'});
    if(BAD_TLD.test(u.host)) flags.push({w:3, say:'網址結尾（' + u.host.split('.').pop() + '）常被詐騙網站使用。'});
    if(govClaim && !isGov) flags.push({w:4, say:'自稱政府或公家單位，但網址不是 gov.tw 結尾。'});
    if(!isGov && /gov|tw-|-tw|\.tw\./.test(u.host) && !/\.(com|org|net|edu)\.tw$/.test(u.host)) flags.push({w:3, say:'網址故意做得像官方（' + u.host + '），其實不是。'});
    else if(!isGov && BRAND.test(u.host) && /-|\d/.test(u.host.split('.')[0])) flags.push({w:2, say:'網址裡有知名公司的名字，但多了符號或數字，可能是仿冒。'});
    if(u.http) flags.push({w:1, say:'網址不是 https 開頭，沒有加密。'});
    if(/@/.test(u.url)) flags.push({w:3, say:'網址裡有 @ 符號，常用來偽裝成別的網站。'});
    return {isGov:isGov, flags:flags};
  }

  function check(raw){
    var t = norm(raw).trim();
    if(t.replace(/\s/g, '').length < 4) return {level:'empty', score:0, reasons:[], urls:[], types:[]};
    var hit = {}, reasons = [], score = 0, crit = false, types = {};
    RULES.forEach(function(r){
      if(r.re.test(t)){
        hit[r.id] = 1;
        if(r.id === 'govclaim') return;
        score += r.w; if(r.crit) crit = true;
        if(r.type) types[r.type] = (types[r.type] || 0) + r.w;
        reasons.push({id:r.id, w:r.w, say:r.say});
      }
    });

    var urls = findUrls(raw), worstUrl = 0, urlSays = {};
    urls.forEach(function(u){
      var j = judgeUrl(u, hit.govclaim);
      u.isGov = j.isGov; u.flags = j.flags;
      var s = 0; j.flags.forEach(function(f){ s += f.w; urlSays[f.say] = Math.max(urlSays[f.say] || 0, f.w); });
      worstUrl = Math.max(worstUrl, s);
    });
    if(urls.length){
      var allGov = urls.every(function(u){ return u.isGov && !u.flags.length; });
      if(!allGov){ score += 1; reasons.push({id:'link', w:1, say:'訊息裡有連結。不確定的連結先不要點。'}); }
      score += Math.min(worstUrl, 7);
      Object.keys(urlSays).forEach(function(s){ reasons.push({id:'url', w:urlSays[s], say:s}); });
      // 「出事了＋點連結處理」是假簡訊最典型的組合
      if(!allGov && (hit.parcel || hit.bill || hit.account || hit.prize)){ score += 3; reasons.push({id:'combo_link', w:3, say:'說有狀況、又要您點連結處理，這是假簡訊最常見的組合。'}); }
    }
    // 其他危險組合
    if(hit.invest && (hit.addline || hit.invest_sure)){ score += 3; reasons.push({id:'combo_invest', w:3, say:'投資＋拉群組／保證獲利，同時出現就是典型假投資。'}); }
    if(hit.police && (hit.money || hit.secret)){ score += 4; crit = true; reasons.push({id:'combo_police', w:4, say:'自稱檢警又要您處理錢或保密，這就是假檢警詐騙。'}); }
    if(hit.relative && hit.money){ score += 3; reasons.push({id:'combo_rel', w:3, say:'自稱親友又要匯款，一定要先打原本的電話確認本人。'}); }
    if(hit.romance && (hit.money || hit.invest || hit.parcel)){ score += 3; reasons.push({id:'combo_love', w:3, say:'網路情人開始談錢、談投資或包裹關稅，幾乎都是詐騙。'}); }
    if(hit.job && hit.money){ score += 2; reasons.push({id:'combo_job', w:2, say:'工作還沒做就要先付錢或轉帳，就是假求職。'}); }

    // 海外號碼
    if(/\+(?!886)\d{2,3}[\s-]?\d{3,}/.test(t)){ score += 2; reasons.push({id:'intl', w:2, say:'出現國外的電話號碼（+ 開頭但不是 +886 台灣）。'}); }

    reasons.sort(function(a, b){ return b.w - a.w; });
    var level = crit || score >= 7 ? 'red' : score >= 3 ? 'yellow' : 'green';
    var tlist = Object.keys(types).sort(function(a, b){ return types[b] - types[a]; });
    return {level:level, score:score, reasons:reasons, urls:urls, types:tlist};
  }

  var api = {check:check, norm:norm, findUrls:findUrls, RULES:RULES};
  if(typeof module !== 'undefined' && module.exports) module.exports = api; else root.SMC = api;
})(this);
