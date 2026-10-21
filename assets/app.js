/* totoCast — page behaviour (no dependencies) */
(function () {
  'use strict';

  /* ---------- 販売締切カウントダウン ----------
     <span data-countdown data-deadline="2026-10-10T13:50:00+09:00" data-format="dhm|dh">
     data-open-only / data-closed-only : 締切前・後で表示切替（data-deadline を同じ要素か祖先に） */
  function fmt(left, format) {
    var mins = Math.floor(left / 60000);
    var d = Math.floor(mins / 1440), h = Math.floor((mins % 1440) / 60), m = mins % 60;
    if (format === 'dh') return d + '日' + h + '時間';
    return d + '<small>日 </small>' + h + '<small>時間 </small>' + m + '<small>分</small>';
  }
  function tick() {
    var now = Date.now();
    document.querySelectorAll('[data-deadline]').forEach(function (el) {
      var left = Date.parse(el.getAttribute('data-deadline')) - now;
      var open = left > 0;
      el.querySelectorAll('[data-countdown]').forEach(function (c) {
        if (open) c.innerHTML = fmt(left, c.getAttribute('data-format'));
      });
      if (el.hasAttribute('data-countdown') && open) el.innerHTML = fmt(left, el.getAttribute('data-format'));
      el.querySelectorAll('[data-open-only]').forEach(function (x) { x.hidden = !open; });
      el.querySelectorAll('[data-closed-only]').forEach(function (x) { x.hidden = open; });
      if (el.hasAttribute('data-open-only')) el.hidden = !open;
    });
  }
  tick();
  setInterval(tick, 30000);

  /* ---------- 予想ページ：目の選択・フィルタ・通り数 ---------- */
  var picker = document.querySelector('[data-picker]');
  if (picker) {
    var matches = Array.prototype.slice.call(picker.querySelectorAll('[data-match]'));
    var countEl = document.querySelector('[data-count]');
    var priceEl = document.querySelector('[data-price]');
    var hintEl = document.querySelector('[data-hint]');
    var fnote = document.querySelector('[data-fnote]');
    var combosEl = document.querySelector('[data-combos]');
    var recHint = picker.getAttribute('data-rec-hint') || '';
    var recF = {}; try { recF = JSON.parse(picker.getAttribute('data-rec-filter') || '{}'); } catch (e) {}
    // おすすめ = 「目」と「フィルタ」の組。a=順当寄り / b=荒れ寄り、キーは口数の上限（100・50・30・10）
    var PLANS = { a: {}, b: {} };
    try { PLANS = JSON.parse(picker.getAttribute('data-plans') || '{}'); PLANS.a = PLANS.a || {}; PLANS.b = PLANS.b || {}; } catch (e) {}
    var mode = 'a', planKey = '100';
    var recBtnsAll = { a: document.querySelector('[data-recommend]'), b: document.querySelector('[data-recommend2]') };
    var IDS = ['minUpset', 'maxUpset', 'minDraw', 'maxDraw', 'minGM', 'maxGM'];
    var DEF = { minUpset: 0, maxUpset: 13, minDraw: 0, maxDraw: 13, minGM: 0, maxGM: 100 };
    var PRESETS = { reset: DEF };
    try { var PP = JSON.parse(picker.getAttribute('data-presets') || '{}'); Object.keys(PP).forEach(function (k) { PRESETS[k] = PP[k]; }); } catch (e) {}
    var KEYS = ['1', '0', '2'];
    var LIMIT = 300000;
    var budgetN = 0;   // 互換用（予算はおすすめの「目＋フィルタ」で表すので、確率上位で切ることはしない）

    function opts(m) { return Array.prototype.slice.call(m.querySelectorAll('.opt')); }
    function sel(m) { return opts(m).filter(function (b) { return b.getAttribute('aria-pressed') === 'true'; }).map(function (b) { return b.getAttribute('data-k'); }); }
    function getF() {
      var f = {};
      IDS.forEach(function (id) { var el = document.getElementById(id); var v = el ? parseInt(el.value, 10) : NaN; f[id] = isNaN(v) ? DEF[id] : v; });
      return f;
    }
    function setF(f) { IDS.forEach(function (id) { var el = document.getElementById(id); if (el && f[id] != null) el.value = f[id]; }); }
    function isDef(f) { return IDS.every(function (id) { return f[id] === DEF[id]; }); }
    // おすすめのフィルタを「実際に残る組合せ」の範囲まで詰める（同じ組合せのまま、範囲が見て分かるように）
    function tighten(L, F0) {
      if (!F0 || !Object.keys(F0).length) return F0;
      var F = {}; IDS.forEach(function (id) { F[id] = F0[id] != null ? F0[id] : DEF[id]; });
      var P = matches.map(function (m) { return m.getAttribute('data-p').split(',').map(Number); });
      var FV = matches.map(function (m) { return m.getAttribute('data-fav'); });
      var raw = L.reduce(function (a, l) { return a * l.length; }, 1);
      if (raw > LIMIT) return F;
      var idx = L.map(function () { return 0; }), n = 0, r = { u0: 99, u1: -1, d0: 99, d1: -1, g0: 999, g1: -1 };
      for (;;) {
        var up = 0, dr = 0, lp = 0;
        for (var i = 0; i < L.length; i++) {
          var k = L[i][idx[i]];
          if (k === '0') dr++;
          if ((FV[i] === 'home' && k === '2') || (FV[i] === 'away' && k === '1')) up++;
          lp += Math.log(Math.max(P[i][KEYS.indexOf(k)], 0.0001) / 100);
        }
        var gm = Math.exp(lp / L.length) * 100;
        if (up >= F.minUpset && up <= F.maxUpset && dr >= F.minDraw && dr <= F.maxDraw && gm >= F.minGM && gm <= F.maxGM) {
          n++; r.u0 = Math.min(r.u0, up); r.u1 = Math.max(r.u1, up); r.d0 = Math.min(r.d0, dr); r.d1 = Math.max(r.d1, dr);
          r.g0 = Math.min(r.g0, gm); r.g1 = Math.max(r.g1, gm);
        }
        var c = L.length - 1;
        while (c >= 0 && ++idx[c] >= L[c].length) { idx[c] = 0; c--; }
        if (c < 0) break;
      }
      if (!n) return F;
      return { minUpset: r.u0, maxUpset: r.u1, minDraw: r.d0, maxDraw: r.d1,
               minGM: Math.max(F.minGM, Math.floor(r.g0)), maxGM: Math.min(F.maxGM, Math.ceil(r.g1)) };
    }
    // 順当寄り100口 = 公開している予想（data-rec と data-rec-filter）
    PLANS.a['100'] = { picks: matches.map(function (m) { return m.getAttribute('data-rec').split(','); }), filter: recF, hint: recHint };
    ['a', 'b'].forEach(function (md) { Object.keys(PLANS[md]).forEach(function (k) { var pl = PLANS[md][k]; pl.filter = tighten(pl.picks, pl.filter); }); });
    function sameF(a, b) { return IDS.every(function (id) { return a[id] === b[id]; }); }
    function isPlan(md, key) {
      var pl = PLANS[md] && PLANS[md][key];
      if (!pl) return false;
      return matches.every(function (m, i) {
        var rec = pl.picks[i], s = sel(m);
        return s.length === rec.length && s.every(function (k) { return rec.indexOf(k) >= 0; });
      }) && sameF(getF(), pl.filter);
    }
    function curPlan() {
      var hit = null;
      ['a', 'b'].forEach(function (md) { Object.keys(PLANS[md]).forEach(function (k) { if (!hit && isPlan(md, k)) hit = [md, k]; }); });
      return hit;
    }
    function isRec() { return !!curPlan(); }
    function update() {
      var lists = matches.map(sel), raw = 1, missing = false;
      lists.forEach(function (l) { if (!l.length) missing = true; raw *= l.length || 1; });
      var f = getF(), count = raw, out = [];
      if (missing) {
        count = 0;
      } else if (!isDef(f)) {
        if (raw > LIMIT) {
          count = null;
        } else {
          var P = matches.map(function (m) { return m.getAttribute('data-p').split(',').map(Number); });
          var FV = matches.map(function (m) { return m.getAttribute('data-fav'); });
          count = 0;
          var all = [];
          var idx = lists.map(function () { return 0; });
          for (;;) {
            var up = 0, dr = 0, lp = 0, s = '';
            for (var i = 0; i < lists.length; i++) {
              var k = lists[i][idx[i]], j = KEYS.indexOf(k);
              if (k === '0') dr++;
              if ((FV[i] === 'home' && k === '2') || (FV[i] === 'away' && k === '1')) up++;
              lp += Math.log(Math.max(P[i][j], 0.0001) / 100);
              s += k;
            }
            var gm = Math.exp(lp / lists.length) * 100;
            if (up >= f.minUpset && up <= f.maxUpset && dr >= f.minDraw && dr <= f.maxDraw && gm >= f.minGM && gm <= f.maxGM) {
              count++;
              if (budgetN) all.push([lp, s]); else if (out.length < 500) out.push(s);
            }
            var c = lists.length - 1;
            while (c >= 0 && ++idx[c] >= lists[c].length) { idx[c] = 0; c--; }
            if (c < 0) break;
          }
          if (budgetN) {
            all.sort(function (a, b) { return b[0] - a[0]; });
            out = all.slice(0, budgetN).map(function (x) { return x[1]; });
            if (count > budgetN) count = budgetN;
          }
        }
      }
      var gr = document.querySelector('[data-gmrange]');
      if (gr) {
        if (missing) { gr.textContent = ''; } else {
          var lo = 0, hi = 0;
          matches.forEach(function (m, i) {
            var p = m.getAttribute('data-p').split(',').map(Number);
            var v = lists[i].map(function (k) { return Math.log(Math.max(p[KEYS.indexOf(k)], 0.0001) / 100); });
            lo += Math.min.apply(null, v); hi += Math.max.apply(null, v);
          });
          lo = Math.exp(lo / matches.length) * 100; hi = Math.exp(hi / matches.length) * 100;
          gr.textContent = '今の目で取れる範囲 ' + (Math.floor(lo * 10) / 10).toFixed(1) + '〜' + (Math.ceil(hi * 10) / 10).toFixed(1) + '%';
        }
      }
      var cTxt = count == null ? '–' : count.toLocaleString('ja-JP'), pTxt = count == null ? '–' : (count * 100).toLocaleString('ja-JP');
      document.querySelectorAll('[data-count]').forEach(function (x) { x.textContent = cTxt; });
      document.querySelectorAll('[data-price]').forEach(function (x) { x.textContent = pTxt; });
      if (fnote) fnote.textContent = missing ? '' : (isDef(f) ? '選んだ目 ' + raw.toLocaleString('ja-JP') + '通り（フィルタなし）'
        : (count == null ? '選んだ目が' + raw.toLocaleString('ja-JP') + '通りと多すぎるため計算できません。目を減らしてください'
        : '選んだ目 ' + raw.toLocaleString('ja-JP') + '通り → フィルタ後 ' + count.toLocaleString('ja-JP') + '通り'
          + (count === 0 && f.minUpset > 0 ? '。波乱が' + f.minUpset + '個以上必要です。人気側（投票率55%以上）の逆の目も選んでください' : '')));
      if (combosEl) {
        combosEl.innerHTML = '';
        var show = isDef(f) ? [] : out;
        show.forEach(function (s) { var li = document.createElement('li'); li.textContent = s.split('').join(' '); combosEl.appendChild(li); });
        combosEl.parentNode.hidden = !show.length;
      }
      hintEl.textContent = missing ? '全試合で1つ以上選んでください'
        : (function () { var cp = curPlan(); return cp ? (PLANS[cp[0]][cp[1]].hint || '') : ''; })();
      var cpn = curPlan();
      document.querySelectorAll('[data-budget]').forEach(function (x) { x.setAttribute('aria-pressed', (cpn && cpn[1] === x.getAttribute('data-budget')) ? 'true' : 'false'); });
      Object.keys(recBtnsAll).forEach(function (k) { if (recBtnsAll[k]) recBtnsAll[k].setAttribute('aria-pressed', (cpn && cpn[0] === k) ? 'true' : 'false'); });
      try { localStorage.setItem('totocast-card-' + picker.getAttribute('data-round'), JSON.stringify({ picks: lists, f: f, top: 0, rec: !!cpn, mode: cpn ? cpn[0] : mode, key: cpn ? cpn[1] : '' })); } catch (e) {}
    }
    function setRec(md, key) {
      md = md || mode; key = key || '100';
      var pl = PLANS[md] && (PLANS[md][key] || PLANS[md]['100']);
      if (!pl) { md = 'a'; pl = PLANS.a['100']; }
      mode = md; planKey = key;
      matches.forEach(function (m, i) {
        var rec = pl.picks[i];
        opts(m).forEach(function (b) { b.setAttribute('aria-pressed', rec.indexOf(b.getAttribute('data-k')) >= 0 ? 'true' : 'false'); });
      });
      setF(Object.keys(pl.filter || {}).length ? pl.filter : DEF);
      budgetN = 0;
      update();
    }
    picker.addEventListener('click', function (e) {
      var info = e.target.closest('.match-info');
      if (info) {
        var d = document.getElementById(info.getAttribute('aria-controls'));
        var open = info.getAttribute('aria-expanded') !== 'true';
        info.setAttribute('aria-expanded', open ? 'true' : 'false');
        info.querySelector('.more-hint').textContent = open ? '閉じる ▴' : '詳細 ▾';
        if (d) d.hidden = !open;
        return;
      }
      var b = e.target.closest('.opt');
      if (!b) return;
      b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
      if (typeof disarm === 'function') disarm();
      budgetN = 0;
      update();
    });
    IDS.forEach(function (id) { var el = document.getElementById(id); if (el) el.addEventListener('input', function () { budgetN = 0; update(); }); });
    document.querySelectorAll('[data-preset]').forEach(function (b) {
      b.addEventListener('click', function () { budgetN = 0; setF(PRESETS[b.getAttribute('data-preset')]); update(); });
    });
    // 自分で入力した目があるときは、すぐに上書きせず確認を1回挟む
    var recBtns = recBtnsAll;
    if (!Object.keys(PLANS.b).length && recBtns.b) { recBtns.b.hidden = true; recBtns.b = null; }
    var labels = {}; Object.keys(recBtns).forEach(function (k) { if (recBtns[k]) labels[k] = recBtns[k].textContent; });
    var armed = null, armTimer = null;
    function disarm() {
      armed = null; clearTimeout(armTimer);
      Object.keys(recBtns).forEach(function (k) { if (recBtns[k]) { recBtns[k].textContent = labels[k]; recBtns[k].classList.remove('is-confirm'); } });
    }
    function edited() {
      return !isRec() && matches.some(function (m) { return sel(m).length > 0; });
    }
    function askRec(md, key) {
      var btn = recBtns[md] || recBtns.a;
      if (edited() && armed !== md + key) {
        disarm(); armed = md + key;
        btn.textContent = '入力中の目が消えます。もう一度押して確定';
        btn.classList.add('is-confirm');
        armTimer = setTimeout(disarm, 5000);
        return;
      }
      disarm();
      setRec(md, key);
    }
    recBtns.a.addEventListener('click', function () { askRec('a', '100'); });
    if (recBtns.b) recBtns.b.addEventListener('click', function () { askRec('b', '100'); });
    document.querySelectorAll('[data-budget]').forEach(function (b) {
      b.addEventListener('click', function () { askRec(mode, b.getAttribute('data-budget')); });
    });
    document.querySelector('[data-clear]').addEventListener('click', function () {
      matches.forEach(function (m) { opts(m).forEach(function (b) { b.setAttribute('aria-pressed', 'false'); }); });
      budgetN = 0;
      update();
    });
    // 購入ページなどから戻ったときは、前回の選択を復元する（なければおすすめ）
    var saved = null;
    try { saved = JSON.parse(localStorage.getItem('totocast-card-' + picker.getAttribute('data-round')) || 'null'); } catch (e) {}
    if (saved && Array.isArray(saved.picks) && saved.picks.length === matches.length && saved.f && !saved.rec) {
      matches.forEach(function (m, i) {
        opts(m).forEach(function (b) { b.setAttribute('aria-pressed', saved.picks[i].indexOf(b.getAttribute('data-k')) >= 0 ? 'true' : 'false'); });
      });
      setF(saved.f); budgetN = 0; mode = saved.mode || 'a';
      update();
    } else if (saved && saved.rec && PLANS[saved.mode] && PLANS[saved.mode][saved.key || '100']) {
      setRec(saved.mode, saved.key || '100');   // おすすめを選んでいたときは、最新のおすすめで表示
    } else {
      setRec('a', '100');
    }
  }

  /* ---------- タブ（データベース） ---------- */
  document.querySelectorAll('[role="tablist"]').forEach(function (list) {
    var tabs = Array.prototype.slice.call(list.querySelectorAll('[role="tab"]'));
    tabs.forEach(function (t) {
      t.addEventListener('click', function () {
        tabs.forEach(function (x) {
          var on = x === t;
          x.setAttribute('aria-selected', on ? 'true' : 'false');
          document.getElementById(x.getAttribute('aria-controls')).hidden = !on;
        });
        var asof = document.querySelector('[data-asof-label]');
        if (asof) asof.textContent = t.getAttribute('data-asof') || '';
      });
    });
  });

  /* ---------- 絞り込み（ニュース） ---------- */
  var chips = document.querySelectorAll('[data-filter]');
  if (chips.length) {
    var cards = document.querySelectorAll('.news-card');
    var empty = document.querySelector('[data-empty]');
    chips.forEach(function (c) {
      c.addEventListener('click', function () {
        var f = c.getAttribute('data-filter');
        chips.forEach(function (x) { x.setAttribute('aria-pressed', x === c ? 'true' : 'false'); });
        var shown = 0;
        cards.forEach(function (card) {
          var any = false;
          card.querySelectorAll('.news-item').forEach(function (it) {
            var ok = f === 'all' || (f === 'key' && it.getAttribute('data-key') === '1') || (f !== 'key' && it.getAttribute('data-kind') === f);
            it.hidden = !ok;
            if (ok) any = true;
          });
          card.hidden = !any;
          if (any) shown++;
        });
        if (empty) empty.hidden = shown > 0;
      });
    });
  }
})();

/* ---------- 購入カード（マルチ券に分割して1枚ずつ表示） ---------- */
(function () {
  'use strict';
  var C = window.__CARD__;
  var root = document.querySelector('[data-card]');
  if (!C || !root) return;
  var KEYS = ['1', '0', '2'];
  var st = null;
  try { st = JSON.parse(localStorage.getItem('totocast-card-' + C.round) || 'null'); } catch (e) {}
  if (st && st.picks && st.picks.length === C.matches.length && !st.picks.every(function (l) { return l.length; })) {
    root.innerHTML = '<p class="note">目を選んでいない試合があります。予想ページで全13試合の目を選んでください</p>'; return;
  }
  var lists = (st && st.picks && st.picks.length === C.matches.length) ? st.picks : C.rec;
  var f = (st && st.f) || C.filter;
  var src = !st ? 'モデルのおすすめ（順当寄り）'
    : (st.rec ? 'モデルのおすすめ（' + (st.mode === 'b' ? '荒れ寄り' : '順当寄り') + (st.key && st.key !== '100' ? '・予算' + (+st.key * 100).toLocaleString('ja-JP') + '円' : '') + '）'
    : '予想ページで選んだ目とフィルタ');
  // 組合せを列挙してフィルタ
  var combos = [], idx = lists.map(function () { return 0; }), raw = 1;
  lists.forEach(function (l) { raw *= l.length; });
  if (raw > 300000) { root.innerHTML = '<p class="note">選んだ目が多すぎます（' + raw.toLocaleString('ja-JP') + '通り）。予想ページで目を減らしてください</p>'; return; }
  for (;;) {
    var up = 0, dr = 0, lp = 0, c = [];
    for (var i = 0; i < lists.length; i++) {
      var k = lists[i][idx[i]], m = C.matches[i];
      if (k === '0') dr++;
      if ((m.fav === 'home' && k === '2') || (m.fav === 'away' && k === '1')) up++;
      lp += Math.log(Math.max(m.p[KEYS.indexOf(k)], 0.0001) / 100);
      c.push(k);
    }
    var gm = Math.exp(lp / lists.length) * 100;
    if (up >= f.minUpset && up <= f.maxUpset && dr >= f.minDraw && dr <= f.maxDraw && gm >= f.minGM && gm <= f.maxGM) combos.push(c);
    var j = lists.length - 1;
    while (j >= 0 && ++idx[j] >= lists[j].length) { idx[j] = 0; j--; }
    if (j < 0) break;
  }
  if (!combos.length) { root.innerHTML = '<p class="note">フィルタに合う組合せが0通りです。予想ページでフィルタを広げてください</p>'; return; }
  // 重複なしのマルチ券に分割
  function cells(allowed) {
    var acc = [''];
    allowed.forEach(function (a) { var nx = []; acc.forEach(function (p) { a.forEach(function (k) { nx.push(p + k); }); }); acc = nx; });
    return acc;
  }
  var left = {}, n = 0;
  combos.forEach(function (c) { left[c.join('')] = 1; n++; });
  var tickets = [];
  while (n > 0 && tickets.length < 4000) {
    var seed; for (var key in left) { seed = key; break; }
    var allowed = seed.split('').map(function (k) { return [k]; });
    for (var mi = 0; mi < lists.length; mi++) {
      lists[mi].forEach(function (k) {
        if (allowed[mi].indexOf(k) >= 0) return;
        var trial = allowed.map(function (a, x) { return x === mi ? a.concat([k]) : a; });
        if (cells(trial).every(function (cc) { return left.hasOwnProperty(cc); })) allowed[mi] = trial[mi];
      });
    }
    cells(allowed).forEach(function (cc) { if (left.hasOwnProperty(cc)) { delete left[cc]; n--; } });
    tickets.push(allowed);
  }
  var cur = 0;
  var body = root.querySelector('[data-rows]'), pos = root.querySelector('[data-pos]');
  function size(t) { return t.reduce(function (a, x) { return a * x.length; }, 1); }
  function draw() {
    var t = tickets[cur];
    body.innerHTML = C.matches.map(function (m, i) {
      function cell(k, label) { return '<td class="kc' + (t[i].indexOf(k) >= 0 ? ' on' : '') + '">' + label + '</td>'; }
      return '<tr><td class="kno">' + m.no + '</td>' + cell('1', m.h) + cell('0', '引分') + cell('2', m.a) + '</tr>';
    }).join('');
    pos.textContent = (cur + 1) + ' / ' + tickets.length + ' 枚目';
    root.querySelector('[data-tcount]').textContent = size(t).toLocaleString('ja-JP');
    root.querySelector('[data-tyen]').textContent = (size(t) * 100).toLocaleString('ja-JP');
  }
  root.querySelector('[data-prev]').addEventListener('click', function () { cur = (cur - 1 + tickets.length) % tickets.length; draw(); });
  root.querySelector('[data-next]').addEventListener('click', function () { cur = (cur + 1) % tickets.length; draw(); });
  root.querySelector('[data-total]').textContent = combos.length.toLocaleString('ja-JP') + '通り · ' + (combos.length * 100).toLocaleString('ja-JP') + '円 · ' + tickets.length + '枚';
  root.querySelector('[data-src]').textContent = src;
  draw();
})();

/* ---------- データベース：順位表 / チーム統計 の切替 ---------- */
(function () {
  document.querySelectorAll('.viewsw').forEach(function (sw) {
    var panel = sw.parentNode;
    sw.querySelectorAll('[data-view]').forEach(function (b) {
      b.addEventListener('click', function () {
        var v = b.getAttribute('data-view');
        document.querySelectorAll('.viewsw [data-view]').forEach(function (x) { x.setAttribute('aria-pressed', x.getAttribute('data-view') === v ? 'true' : 'false'); });
        document.querySelectorAll('[role="tabpanel"] [data-v]').forEach(function (x) { x.hidden = x.getAttribute('data-v') !== v; });
      });
    });
  });
})();

/* ---------- 用語の「?」 ---------- */
document.addEventListener('click', function (e) {
  var t = e.target.closest('.tip');
  document.querySelectorAll('.tipbox').forEach(function (b) { if (!t || b !== t.nextElementSibling) b.hidden = true; });
  if (t) { e.preventDefault(); e.stopPropagation(); var b = t.nextElementSibling; b.hidden = !b.hidden; }
}, true);
