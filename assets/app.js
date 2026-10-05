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
    var IDS = ['minUpset', 'maxUpset', 'minDraw', 'maxDraw', 'minGM', 'maxGM'];
    var DEF = { minUpset: 0, maxUpset: 13, minDraw: 0, maxDraw: 13, minGM: 0, maxGM: 100 };
    var PRESETS = { reset: DEF };
    try { var PP = JSON.parse(picker.getAttribute('data-presets') || '{}'); Object.keys(PP).forEach(function (k) { PRESETS[k] = PP[k]; }); } catch (e) {}
    var KEYS = ['1', '0', '2'];
    var LIMIT = 300000;
    var budgetN = 0;   // 予算モード: フィルタ後の組合せを確率の高い順に budgetN 通りだけ買う   // これ以上の組合せは数えない（ブラウザが重くなるため）

    function opts(m) { return Array.prototype.slice.call(m.querySelectorAll('.opt')); }
    function sel(m) { return opts(m).filter(function (b) { return b.getAttribute('aria-pressed') === 'true'; }).map(function (b) { return b.getAttribute('data-k'); }); }
    function getF() {
      var f = {};
      IDS.forEach(function (id) { var el = document.getElementById(id); var v = el ? parseInt(el.value, 10) : NaN; f[id] = isNaN(v) ? DEF[id] : v; });
      return f;
    }
    function setF(f) { IDS.forEach(function (id) { var el = document.getElementById(id); if (el && f[id] != null) el.value = f[id]; }); }
    function isDef(f) { return IDS.every(function (id) { return f[id] === DEF[id]; }); }
    function sameF(a, b) { return IDS.every(function (id) { return a[id] === b[id]; }); }
    function isRec() {
      return matches.every(function (m) {
        var rec = m.getAttribute('data-rec').split(','), s = sel(m);
        return s.length === rec.length && s.every(function (k) { return rec.indexOf(k) >= 0; });
      }) && sameF(getF(), recF);
    }
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
        : (budgetN ? '予算' + (budgetN * 100).toLocaleString('ja-JP') + '円：おすすめの中から当たりやすい順に' + count + '通り' : (isRec() ? recHint : ''));
      document.querySelectorAll('[data-budget]').forEach(function (x) { var bn = +x.getAttribute('data-budget'); x.setAttribute('aria-pressed', ((bn === 100 ? 0 : bn) === budgetN && isRec()) ? 'true' : 'false'); });
      try { localStorage.setItem('totocast-card-' + picker.getAttribute('data-round'), JSON.stringify({ picks: lists, f: f, top: budgetN })); } catch (e) {}
    }
    function setRec() {
      matches.forEach(function (m) {
        var rec = m.getAttribute('data-rec').split(',');
        opts(m).forEach(function (b) { b.setAttribute('aria-pressed', rec.indexOf(b.getAttribute('data-k')) >= 0 ? 'true' : 'false'); });
      });
      setF(Object.keys(recF).length ? recF : DEF);
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
    var recBtn = document.querySelector('[data-recommend]');
    var recLabel = recBtn.textContent, armed = false, armTimer = null;
    function disarm() {
      armed = false; clearTimeout(armTimer);
      recBtn.textContent = recLabel; recBtn.classList.remove('is-confirm');
    }
    function edited() {
      return !isRec() && matches.some(function (m) { return sel(m).length > 0; });
    }
    var pendingN = 0;
    function askRec(n) {
      pendingN = n;
      if (edited() && !armed) {
        armed = true;
        recBtn.textContent = '入力中の目が消えます。もう一度押して確定';
        recBtn.classList.add('is-confirm');
        armTimer = setTimeout(disarm, 5000);
        return;
      }
      disarm(); budgetN = pendingN; setRec();
    }
    recBtn.addEventListener('click', function () { askRec(0); });
    document.querySelectorAll('[data-budget]').forEach(function (b) {
      b.addEventListener('click', function () { var n = +b.getAttribute('data-budget'); askRec(n === 100 ? 0 : n); });
    });
    document.querySelector('[data-clear]').addEventListener('click', function () {
      matches.forEach(function (m) { opts(m).forEach(function (b) { b.setAttribute('aria-pressed', 'false'); }); });
      budgetN = 0;
      update();
    });
    setRec();
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
  var lists = (st && st.picks && st.picks.length === C.matches.length && st.picks.every(function (l) { return l.length; })) ? st.picks : C.rec;
  var f = (st && st.f) || C.filter;
  var src = st ? '予想ページで選んだ目とフィルタ' : 'モデルのおすすめ';
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
      lp += Math.log(Math.max(m.p[KEYS.indexOf(k)], 0.01) / 100);
      c.push(k);
    }
    var gm = Math.exp(lp / lists.length) * 100;
    if (up >= f.minUpset && up <= f.maxUpset && dr >= f.minDraw && dr <= f.maxDraw && gm >= f.minGM && gm <= f.maxGM) combos.push(c);
    var j = lists.length - 1;
    while (j >= 0 && ++idx[j] >= lists[j].length) { idx[j] = 0; j--; }
    if (j < 0) break;
  }
  if (st && st.top && combos.length > st.top) {
    var lpOf = function (c) { return c.reduce(function (a, k, i) { return a + Math.log(Math.max(C.matches[i].p[KEYS.indexOf(k)], 0.01) / 100); }, 0); };
    combos.sort(function (a, b) { return lpOf(b) - lpOf(a); });
    combos = combos.slice(0, st.top);
    src += '（予算' + (st.top * 100).toLocaleString('ja-JP') + '円）';
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
