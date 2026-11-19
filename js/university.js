/* ==========================================================================
   University programming course — exercise engine.
   Routes:  #/university            session list (rendered by app.js)
            #/university/s/<n>      one session: slides link + exercises

   Mounts into any element: UniUI.mount(root, session). A session is a plain
   object from data/university/sNN.js (exercises, self-practice, notes, links).
   No inline script or style, no network requests: the page's CSP allows neither.
   ========================================================================== */
(function () {
'use strict';
var LANGS = [['c', 'C'], ['cpp', 'C++'], ['java', 'Java'], ['py', 'Python']];
var LNAME = { c: 'C', cpp: 'C++', java: 'Java', py: 'Python' };
var TIME = { easy: 30, medium: 60, hard: 90 };
var TYPENAME = { mcq: 'Multiple choice', tf: 'True / False', predict: 'Predict the output', debug: 'Find the bug', blocks: 'Blocks', fill: 'Fill the blanks',
  trace: 'Trace table', match: 'Match', sort: 'Sort', write: 'Write the code', mini: 'Mini project' };
var RETRY = ['wrong1', 'skipped', 'timeout'];
var LANG_KEY = 'teach.uni.lang';
var STORE = {};   /* progress survives moving between routes until the page is reloaded */

var tick = null;

/* ---------- helpers ---------- */
function h(tag, props) {
  var el = document.createElement(tag);
  props = props || {};
  Object.keys(props).forEach(function (k) {
    var v = props[k];
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'style') el.style.cssText = v;
    else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, '');
    else if (v !== false && v != null) el.setAttribute(k, v);
  });
  for (var i = 2; i < arguments.length; i++) {
    var c = arguments[i];
    if (c == null) continue;
    el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return el;
}
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function fmt(s) { return s.split(/(`[^`]+`)/).map(function (p, i) { return i % 2 ? '<code>' + esc(p.slice(1, -1)) + '</code>' : esc(p).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>'); }).join(''); }
function hash(str) { var x = 2166136261; for (var i = 0; i < str.length; i++) { x ^= str.charCodeAt(i); x = Math.imul(x, 16777619); } return x >>> 0; }
function rng(seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function shuf(arr, seed, notSame) {
  var base = arr.slice(), n = 0, out;
  do {
    out = base.slice(); var r = rng(hash(seed + ':' + n));
    for (var i = out.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var t = out[i]; out[i] = out[j]; out[j] = t; }
    n++;
  } while (notSame && n < 12 && out.every(function (v, i) { return v === base[i]; }) && out.length > 1);
  return out;
}
function same(a, b) { return a.length === b.length && a.every(function (v, i) { return v === b[i]; }); }

/* ---------- feedback helpers ----------
   The site's channels (window.UI, from app.js) when they are there; silent when
   this engine runs on its own page. */
function say(msg) { if (window.UI && UI.announce) UI.announce(msg); }
function toast(msg) { if (window.UI && UI.notify) UI.notify(msg); }
function replay(el, cls) { if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
function still() { return !window.requestAnimationFrame || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
/* Rolls a number from one value to another, so a score change is seen happening. */
function countTo(el, from, to) {
  el.textContent = String(to);
  if (from === to || still()) return;
  var start = null, dur = Math.min(700, 250 + Math.abs(to - from) * 30);
  el.textContent = String(from);
  window.requestAnimationFrame(function frame(t) {
    if (start === null) start = t;
    var k = Math.min(1, (t - start) / dur);
    el.textContent = String(Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3))));
    if (k < 1) window.requestAnimationFrame(frame);
  });
}
var MOD = /Mac|iPhone|iPad/.test(navigator.platform || '') ? '⌘' : 'Ctrl';
/* Long loops: beginner scaffolding that retires once a student has shown they know.
   Counts live in this browser only; without storage every hint simply stays. */
function uses(key) { try { return Number(localStorage.getItem('teach.uni.uses.' + key)) || 0; } catch (e) { return 0; } }
function used(key, n) { try { localStorage.setItem('teach.uni.uses.' + key, String(n == null ? uses(key) + 1 : n)); } catch (e) {} }
var VETERAN = 5;   /* checks after which the readiness line drops its explanations */
/* The signature: the site's </> mark closing itself, as code does when it is right. */
var STAMP = '<span class="u-stamp" aria-hidden="true"><i>&lt;</i><i>/</i><i>&gt;</i></span>';
function lines(x) { return Array.isArray(x) ? x.join('\n') : x; }

var KW = { c: 'int return void char double float long const bool true false if else include main printf scanf puts fgets stdio stdbool h',
  cpp: 'int return using namespace std string void char double float long const bool true false if else include main cout cin endl getline iostream',
  java: 'public class static void main String int double float long char boolean final new Scanner true false return System out in println print printf',
  py: 'print input int float str bool True False def if else for while in return import end' };
function hl(code, L, numbered) {
  var kws = {}; KW[L].split(' ').forEach(function (k) { kws[k] = 1; });
  var re = /(\/\/[^\n]*|#[^\n]*)|("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')|(\b\d+(?:\.\d+)?\b)|(\b[A-Za-z_][A-Za-z0-9_]*\b)/g;
  function one(line) {
    var res = '', last = 0, m;
    re.lastIndex = 0;
    while ((m = re.exec(line))) {
      res += esc(line.slice(last, m.index)); last = re.lastIndex;
      if (m[1]) res += '<span class="' + (L !== 'py' && m[1].charAt(0) === '#' ? 'hp' : 'hc') + '">' + esc(m[1]) + '</span>';
      else if (m[2]) res += '<span class="hs">' + esc(m[2]).replace(/\\(.)/g, '<span class="hn">\\$1</span>') + '</span>';
      else if (m[3]) res += '<span class="hn">' + m[3] + '</span>';
      else if (kws[m[4]]) res += '<span class="hk">' + m[4] + '</span>';
      else res += esc(m[4]);
    }
    return res + esc(line.slice(last));
  }
  return lines(code).split('\n').map(function (l, i) { return (numbered ? '<span class="ln">' + (i + 1) + '</span>' : '') + one(l); }).join('\n');
}

function norm(s, L) {
  s = s.replace(/[\u201C\u201D\u201E\u201F\u00AB\u00BB]/g, '"').replace(/[\u2018\u2019\u201A\u201B]/g, "'").replace(/[\u00A0\u200B]/g, ' ').trim();
  var parts = s.split(/("(?:\\.|[^"\\])*")/);
  for (var i = 0; i < parts.length; i += 2) parts[i] = parts[i].replace(/\s+/g, ' ').replace(/\s*(<<|[(),;=])\s*/g, '$1').replace(/std::/g, '').trim();
  var r = parts.join('');
  if (L === 'py') { r = r.replace(/;$/, ''); if (r.indexOf('"') < 0) r = r.replace(/'/g, '"'); }
  return r;
}

function mount(root, session) {
var EX = session.exercises, PR = session.practice, PTS = session.pts;
var ST = STORE[session.id] || (STORE[session.id] = { lang: null, mode: 'class', timersOn: true, S: {}, PD: {} });
var max = !!ST.max;
var lang = ST.lang, mode = ST.mode, timersOn = ST.timersOn, S = ST.S, PD = ST.PD;
/* The result of the Check just pressed, read once by the next render so the score
   rolls, the stamp closes and focus lands on the verdict — and never again when the
   same exercise is revisited. Same for arriving on the final screen. */
var lastCheck = null, justDone = false;
if (!lang) { lang = 'c'; try { var sv = localStorage.getItem(LANG_KEY); if (sv && LNAME[sv]) lang = sv; } catch (e) {} }

/* ---------- state ---------- */
function codeBlock(code, numbered) { return h('pre', { class: 'ucode', html: hl(code, lang, numbered) }); }
function st() { return S[lang] || (S[lang] = { i: 0, ex: {}, wrong: 0, score: 0, done: false, started: false }); }
function ex_(id) { var s = st(); return s.ex[id] || (s.ex[id] = { st: 'new', rem: null, left: false, retry: false, pts: 0 }); }
function maxScore() { return EX.reduce(function (a, e) { return a + (e.noScore ? 0 : PTS[e.diff]); }, 0); }
function award(ex, ok) {
  var s = st(), e = ex_(ex.id), base = PTS[ex.diff], first = e.st === 'new';
  /* a streak counts first-try correct answers in a row; anything else ends it */
  s.streak = ok && first ? (s.streak || 0) + 1 : 0;
  if (ok) { var p = first ? base : Math.floor(base / 2); e.st = first ? 'full' : 'half'; e.pts = p; s.score += p; }
  else { s.wrong++; var pen = Math.min(2 * s.wrong, 10); var before = s.score; s.score = Math.max(0, s.score - pen); e.pen = (e.pen || 0) + (before - s.score); e.lastPen = before - s.score; e.st = first ? 'wrong1' : 'wrong2'; }
  e.retry = false;
}
function go(n) {
  var s = st(); stopTimer();
  ex_(EX[s.i].id).left = true;
  if (n >= EX.length) { s.done = true; justDone = true; } else { s.done = false; s.i = Math.max(0, n); }
  render(true);
}

/* ---------- timer ---------- */
function stopTimer() { if (tick) { clearInterval(tick); tick = null; } }
function startTimer(ex, e, el) {
  stopTimer();
  if (!timersOn) { el.style.display = 'none'; return; }
  if (e.rem == null) e.rem = TIME[ex.diff];
  function paint() { el.textContent = e.rem; el.className = 'timer' + (e.rem <= 10 ? ' low' : ''); }
  paint();
  tick = setInterval(function () {
    if (!document.body.contains(root)) { stopTimer(); return; }
    e.rem--; paint();
    /* the red pulse is visual only; the same warning is spoken once */
    if (e.rem === 10) say('10 seconds left');
    if (e.rem <= 0) { stopTimer(); e.st = 'timeout'; e.retry = false; st().streak = 0; say('Time is up'); render(); }
  }, 1000);
}

/* ---------- builders for interactive exercise parts ---------- */
function letter(i) { return String.fromCharCode(65 + i); }

function bChoice(ex, chg) {
  var L = lang, sel = -1, opts, node = h('div', { class: ex.type === 'tf' ? 'opts tf' : 'opts' }), btns = [];
  if (ex.type === 'tf') opts = [{ t: 'True', ok: ex.answer[L] === true }, { t: 'False', ok: ex.answer[L] === false }];
  else opts = shuf(ex.opts[L], ex.id + L);
  opts.forEach(function (o, i) {
    var inner;
    if (ex.type === 'tf') inner = h('span', { text: o.t });
    else if (ex.type === 'predict') inner = h('pre', { text: o.t });
    else if (ex.optStyle === 'code') inner = h('span', { class: 'oc', html: hl(o.t, L) });
    else inner = h('span', { html: fmt(o.t) });
    var b = h('button', { class: 'opt', type: 'button', onclick: function () { sel = i; btns.forEach(function (x, j) { x.className = 'opt' + (j === i ? ' sel' : ''); }); chg(); } },
      ex.type === 'tf' ? null : h('span', { class: 'L', text: letter(i) }), inner);
    btns.push(b); node.appendChild(b);
  });
  return { node: node, ready: function () { return sel >= 0; }, progress: function () { return [sel >= 0 ? 1 : 0, 1]; }, correct: function () { return opts[sel].ok; } };
}

function bBlocks(ex, chg) {
  var L = lang, items = ex.blocks[L], order = shuf(items.map(function (_, i) { return i; }), ex.id + L, true), placed = [], fresh = -1;
  var pool = h('div', { class: 'chips' }), drop = h('div', { class: 'drop' }), node = h('div', null, h('div', { class: 'lab', text: 'Your answer (tap a block to remove it)' }), drop, h('div', { class: 'lab', text: 'Blocks' }), pool);
  function paint() {
    pool.innerHTML = ''; drop.innerHTML = '';
    order.forEach(function (idx) { if (placed.indexOf(idx) < 0) pool.appendChild(h('button', { class: 'chip blk', type: 'button', text: items[idx], onclick: function () { placed.push(idx); fresh = idx; paint(); chg(); } })); });
    if (!placed.length) drop.appendChild(h('div', { class: 'ph', text: 'Tap the blocks in order…' }));
    placed.forEach(function (idx, k) { drop.appendChild(h('button', { class: 'chip blk' + (idx === fresh ? ' is-new' : ''), type: 'button', text: items[idx], onclick: function () { placed.splice(k, 1); paint(); chg(); } })); });
    drop.classList.toggle('filled', placed.length === items.length);
    fresh = -1;
  }
  paint();
  var target = ex.target[L];
  return { node: h('div', null, h('div', { class: 'lab', text: 'Target output' }), h('pre', { class: 'ucode', text: target }), node),
    ready: function () { return placed.length === items.length; }, progress: function () { return [placed.length, items.length]; },
    correct: function () { return same(placed.map(function (i) { return items[i]; }), items); } };
}

function bFill(ex, chg) {
  var L = lang, parts = ex.template[L].split('___'), n = parts.length - 1, slots = [], i;
  for (i = 0; i < n; i++) slots.push(null);
  var chips = shuf(ex.chips[L].map(function (c, i) { return i; }), ex.id + L, true), line = h('div', { class: 'fillline' }), pool = h('div', { class: 'chips' }), fresh = -1;
  function paint() {
    line.innerHTML = '';
    var next = slots.indexOf(null);
    parts.forEach(function (p, k) {
      line.appendChild(h('span', { html: hl(p, L) }));
      /* the blank the next chip will land in is marked, so the rule "fills left to right" is visible */
      if (k < n) line.appendChild(h('button', { type: 'button', class: 'slot' + (slots[k] != null ? ' full' : k === next ? ' next' : '') + (k === fresh ? ' is-new' : ''), text: slots[k] != null ? ex.chips[L][slots[k]] : '…', onclick: function () { slots[k] = null; paint(); chg(); } }));
    });
    pool.innerHTML = '';
    chips.forEach(function (ci) {
      if (slots.indexOf(ci) < 0) pool.appendChild(h('button', { class: 'chip', type: 'button', text: ex.chips[L][ci], onclick: function () { var f = slots.indexOf(null); if (f >= 0) { slots[f] = ci; fresh = f; paint(); chg(); } } }));
    });
    fresh = -1;
  }
  paint();
  return { node: h('div', null, line, h('div', { class: 'lab', text: 'Word bank (tap a chip, tap a filled blank to undo)' }), pool),
    ready: function () { return slots.indexOf(null) < 0; }, progress: function () { return [slots.filter(function (x) { return x != null; }).length, n]; },
    correct: function () { return same(slots.map(function (c) { return ex.chips[L][c]; }), ex.answers[L]); } };
}

function bTrace(ex, chg) {
  var L = lang, rows = ex.rows, sels = [], tb = h('tbody');
  rows.forEach(function (r, k) {
    var opts = shuf(r.opts, ex.id + L + k);
    var sel = h('select', { 'aria-label': 'Row ' + (k + 1), onchange: function () { sel.classList.toggle('filled', sel.value !== '-1'); chg(); } }, h('option', { value: '-1', text: 'choose…' }));
    opts.forEach(function (o, i) { sel.appendChild(h('option', { value: i, text: o.t })); });
    sels.push({ sel: sel, opts: opts });
    tb.appendChild(h('tr', null, h('td', { text: String(k + 1) }), h('td', { class: 'cd', html: hl(r.code[L], L) }), h('td', null, sel)));
  });
  var node = h('table', { class: 't' }, h('thead', null, h('tr', null, h('th', { text: '#' }), h('th', { text: 'STATEMENT' }), h('th', { text: ex.colHead || 'SCREEN AFTER THIS STATEMENT' }))), tb);
  return { node: node, ready: function () { return sels.every(function (x) { return x.sel.value !== '-1'; }); },
    progress: function () { return [sels.filter(function (x) { return x.sel.value !== '-1'; }).length, sels.length]; },
    correct: function () { return sels.every(function (x) { return x.opts[+x.sel.value].ok; }); } };
}

function bMatch(ex, chg) {
  var rights = shuf(ex.pairs.map(function (p) { return p.r; }), ex.id + lang), sels = [], tb = h('tbody');
  ex.pairs.forEach(function (p) {
    var sel = h('select', { 'aria-label': 'Match for ' + p.l, onchange: function () { sel.classList.toggle('filled', sel.value !== ''); chg(); } }, h('option', { value: '', text: 'choose…' }));
    rights.forEach(function (r) { sel.appendChild(h('option', { value: r, text: r })); });
    sels.push(sel);
    tb.appendChild(h('tr', null, h('td', { class: 'cd' }, h('code', { text: p.l })), h('td', null, sel)));
  });
  return { node: h('table', { class: 't' }, tb), ready: function () { return sels.every(function (s) { return s.value !== ''; }); },
    progress: function () { return [sels.filter(function (s) { return s.value !== ''; }).length, sels.length]; },
    correct: function () { return sels.every(function (s, i) { return s.value === ex.pairs[i].r; }); } };
}

function bSort(ex, chg) {
  var L = lang, items = shuf(ex.items[L], ex.id + L), where = items.map(function () { return -1; }), cur = -1, fresh = -1;
  var pool = h('div', { class: 'chips' }), binsEl = h('div', { class: 'bins' });
  function paint() {
    pool.innerHTML = ''; binsEl.innerHTML = '';
    items.forEach(function (it, i) { if (where[i] < 0) pool.appendChild(h('button', { class: 'chip' + (cur === i ? ' sel' : ''), type: 'button', 'aria-pressed': String(cur === i), html: hl(it.t, L), onclick: function () { cur = cur === i ? -1 : i; paint(); chg(); } })); });
    ex.bins.forEach(function (b, bi) {
      var box = h('div', { class: 'bin' + (cur >= 0 ? ' target' : ''), onclick: function () { if (cur >= 0) { where[cur] = bi; fresh = cur; cur = -1; paint(); chg(); } } }, h('h4', { text: b }));
      items.forEach(function (it, i) { if (where[i] === bi) box.appendChild(h('button', { class: 'chip' + (i === fresh ? ' is-new' : ''), type: 'button', html: hl(it.t, L), onclick: function (ev) { ev.stopPropagation(); where[i] = -1; paint(); chg(); } })); });
      binsEl.appendChild(box);
    });
    fresh = -1;
  }
  paint();
  return { node: h('div', null, h('div', { class: 'lab', text: 'Statements' }), pool, binsEl), ready: function () { return where.every(function (w) { return w >= 0; }); },
    progress: function () { return [where.filter(function (w) { return w >= 0; }).length, items.length]; },
    hint: function () { return cur >= 0 ? 'Now tap the box this statement belongs in.' : ''; },
    correct: function () { return items.every(function (it, i) { return it.bin === where[i]; }); } };
}

function bWrite(ex, chg) {
  var L = lang, ta = h('textarea', { class: 'w', rows: '2', spellcheck: 'false', autocorrect: 'off', autocapitalize: 'off', autocomplete: 'off', placeholder: 'Type your line here…', 'aria-label': 'Your line of code', oninput: chg });
  return { node: ta, ready: function () { return ta.value.trim().length > 0; }, progress: function () { return [ta.value.trim() ? 1 : 0, 1]; },
    correct: function () { var v = norm(ta.value, L); return ex.accept[L].some(function (a) { return norm(a, L) === v; }); } };
}

/* ---------- solution (static) ---------- */
function solution(ex) {
  var L = lang, box = h('div', { class: 'sol' });
  function add(label, node) { box.appendChild(h('div', { class: 'lab', text: label })); box.appendChild(node); }
  switch (ex.type) {
    case 'mcq': case 'debug': case 'predict': {
      var o = ex.opts[L].filter(function (x) { return x.ok; })[0];
      add('Correct answer', ex.type === 'predict' ? h('pre', { class: 'ucode', text: o.t }) : (ex.optStyle === 'code' ? h('pre', { class: 'ucode', html: hl(o.t, L) }) : h('p', { html: fmt(o.t) })));
      if (ex.type === 'debug' && ex.fixed) add('Fixed code', codeBlock(ex.fixed[L]));
      break; }
    case 'tf': add('Correct answer', h('p', { html: '<b>' + (ex.answer[L] ? 'True' : 'False') + '</b>' })); break;
    case 'blocks': add('Correct order', codeBlock(ex.blocks[L])); break;
    case 'fill': { var line = ex.template[L]; ex.answers[L].forEach(function (a) { line = line.replace('___', a); }); add('Correct line', codeBlock(line)); break; }
    case 'trace': {
      var tb = h('tbody'); ex.rows.forEach(function (r, k) { tb.appendChild(h('tr', null, h('td', { text: String(k + 1) }), h('td', { class: 'cd', html: hl(r.code[L], L) }), h('td', { class: 'cd', text: r.opts.filter(function (x) { return x.ok; })[0].t }))); });
      add('Correct trace', h('table', { class: 't' }, tb)); break; }
    case 'match': add('Correct pairs', h('ul', { html: ex.pairs.map(function (p) { return '<li><code>' + esc(p.l) + '</code> = ' + esc(p.r) + '</li>'; }).join('') })); break;
    case 'sort': ex.bins.forEach(function (b, bi) { add(b, h('pre', { class: 'ucode', html: ex.items[L].filter(function (x) { return x.bin === bi; }).map(function (x) { return hl(x.t, L); }).join('\n') })); }); break;
    case 'write': add('Model answer', codeBlock(ex.model[L])); if (ex.accept[L].length > 1) box.appendChild(h('p', { class: 'u-step', text: 'Other correct versions are accepted too.' })); break;
    case 'mini': add('Model program', codeBlock(ex.model[L])); break;
  }
  return box;
}

/* What a wrong answer actually cost: the score never goes below 0, so the message
   says what was taken, not the nominal penalty. */
function lost(e) { return e.lastPen ? '−' + e.lastPen + ' point' + (e.lastPen === 1 ? '' : 's') : 'No points lost: your score is already 0.'; }

/* ---------- class mode ---------- */
function renderStart(box) {
  var total = maxScore(), card = h('div', { class: 'u-card start' });
  card.appendChild(h('div', { class: 'u-eyebrow', text: 'SESSION ' + session.number + ' · IN CLASS · ' + LNAME[lang].toUpperCase() }));
  card.appendChild(h('h2', { class: 'q', text: 'Ready to practice?' }));
  card.appendChild(h('p', { class: 'prompt', html: fmt('**' + EX.length + ' exercises**, from easy to hard, in **' + LNAME[lang] + '**. Maximum score: **' + total + '**. You can change the language above before you start.') }));
  var rules = h('ul', { class: 'rules', html: [
    'One exercise at a time. You can **Skip** any exercise.',
    'First try correct = full points. Come back later = half points.',
    'Wrong answers cost 2, 4, 6… up to 10 points each, so do not guess.',
    'Timers: easy ' + TIME.easy + ' s, medium ' + TIME.medium + ' s, hard ' + TIME.hard + ' s. The timer starts when you press Start. You can turn timers off above.',
    'Use **Maximize** to fill the whole screen with the exercise.'].map(function (t) { return '<li>' + fmt(t) + '</li>'; }).join('') });
  /* first two sessions: the rules in full; after that, one tap away */
  card.appendChild(uses('starts') >= 2 ? h('details', { class: 'u-notes' }, h('summary', { text: 'How scoring works' }), rules) : rules);
  card.appendChild(h('div', { class: 'note' }, h('b', { text: 'Language notes: ' + LNAME[lang] }), h('ul', { html: (session.notes[lang] || []).map(function (n) { return '<li>' + fmt(n) + '</li>'; }).join('') })));
  card.appendChild(h('div', { class: 'actions' }, h('button', { class: 'u-btn gold big-btn', type: 'button', text: 'Start practice →', onclick: function () { st().started = true; used('starts'); max = true; render(true); } })));
  box.appendChild(card);
}

function renderClass(box) {
  var s = st();
  if (!s.started) { renderStart(box); return; }
  if (s.done) { renderFinal(box); return; }
  var ex = EX[s.i], e = ex_(ex.id);
  if (RETRY.indexOf(e.st) >= 0 && e.left) e.retry = true;
  var interactive = e.st === 'new' || e.retry;
  var total = maxScore();
  var fresh = lastCheck && lastCheck.id === ex.id ? lastCheck : null;
  lastCheck = null;

  box.appendChild(h('details', { class: 'u-notes' }, h('summary', { text: 'Language notes: ' + LNAME[lang] }), h('ul', { html: (session.notes[lang] || []).map(function (n) { return '<li>' + fmt(n) + '</li>'; }).join('') })));
  var scoreNum = h('b', { text: String(s.score) });
  var scoreWrap = h('span', { class: 'u-score' }, h('span', { class: 'u-pill' }, 'Score ', scoreNum, ' / ' + total));
  var delta = fresh ? s.score - fresh.from : 0;
  /* the change floats off the pill: gold when earned, red when a guess cost points */
  if (delta) scoreWrap.appendChild(h('span', { class: 'u-delta ' + (delta > 0 ? 'up' : 'down'), 'aria-hidden': 'true', text: (delta > 0 ? '+' : '−') + Math.abs(delta) }));
  box.appendChild(h('div', { class: 'bar-row' },
    scoreWrap,
    h('div', { class: 'prog' }, h('i', { style: 'width:' + Math.round(100 * s.i / EX.length) + '%' })),
    h('span', { class: 'u-step', text: 'Exercise ' + (s.i + 1) + ' of ' + EX.length })));
  if (fresh) countTo(scoreNum, fresh.from, s.score);

  var card = h('div', { class: 'u-card' }), timerEl = h('div', { class: 'timer', text: '' });
  var meta = h('div', { class: 'meta' }, h('span', { class: 'u-badge b-' + ex.diff, text: ex.diff }), h('span', { class: 'u-badge b-type', text: TYPENAME[ex.type] }),
    h('span', { class: 'u-step', text: ex.noScore ? 'not scored' : (e.retry ? 'revisit: ' + Math.floor(PTS[ex.diff] / 2) + ' pts' : PTS[ex.diff] + ' pts') }));
  if (interactive && !e.retry && ex.type !== 'mini') meta.appendChild(timerEl);
  card.appendChild(meta);
  card.appendChild(h('h2', { class: 'q', text: ex.title }));
  card.appendChild(h('p', { class: 'prompt', html: fmt(ex.prompt[lang]) }));
  if (ex.code && (ex.type !== 'trace' || ex.showCode)) card.appendChild(codeBlock(ex.code[lang], ex.numbered));
  if (ex.type === 'mini') { card.appendChild(h('div', { class: 'lab', text: 'Output (use your own name)' })); card.appendChild(h('pre', { class: 'ucode', text: ex.target[lang] })); }

  var fb = h('div'), actions = h('div', { class: 'actions' }), ui = null;

  if (interactive) {
    if (e.retry) fb.appendChild(h('div', { class: 'fb info', html: '<b class="h">Second chance</b>You can answer again for half points. A wrong answer still costs points.' }));
    /* Says why Check is greyed out, and how far along the answer is, instead of
       leaving a disabled button to explain itself. */
    var readyLine = h('p', { class: 'u-ready', 'aria-live': 'polite' }), wasReady = false;
    var say_ = function (msg, ok, armBtn) {
      if (readyLine.textContent !== msg) readyLine.textContent = msg;
      readyLine.classList.toggle('is-ready', ok);
      if (ok && !wasReady && armBtn) replay(armBtn, 'is-armed');
      wasReady = ok;
    };
    if (ex.type === 'mini') {
      var ticks = [], ul = h('ul', { class: 'checks' }), done = h('button', { class: 'u-btn', type: 'button', text: 'I finished it', disabled: true, onclick: function () { e.st = 'done'; e.retry = false; lastCheck = { id: ex.id, from: s.score }; render(); } });
      var tally = function () {
        var n = ticks.filter(function (t) { return t.checked; }).length;
        done.disabled = n < ticks.length;
        say_(n < ticks.length ? n + ' of ' + ticks.length + ' ticked.' + (uses('checks') >= VETERAN ? '' : ' Tick every line your program does.') : 'All ticked. Press I finished it.', n === ticks.length, done);
      };
      ex.checklist.forEach(function (c) { var cb = h('input', { type: 'checkbox', onchange: tally }); ticks.push(cb); ul.appendChild(h('li', null, h('label', null, cb, h('span', { html: fmt(c) })))); });
      card.appendChild(ul); card.appendChild(readyLine); tally();
      var modelBox = h('div'); var showBtn = h('button', { class: 'u-btn ghost', type: 'button', text: 'Show model program', onclick: function () { modelBox.innerHTML = ''; modelBox.appendChild(solution(ex)); showBtn.disabled = true; } });
      actions.appendChild(done); actions.appendChild(showBtn); card.appendChild(modelBox);
    } else {
      var veteran = uses('checks') >= VETERAN, knowsKey = uses('modenter') > 0;
      var check = h('button', { class: 'u-btn', type: 'button', text: 'Check', disabled: true, onclick: function () { used('checks'); var before = s.score; stopTimer(); award(ex, ui.correct()); lastCheck = { id: ex.id, from: before }; render(); } });
      var NOUN = { blocks: 'blocks placed', fill: 'blanks filled', trace: 'rows answered', match: 'pairs matched', sort: 'statements sorted' };
      var chg = function () {
        var ok = ui.ready(), p = ui.progress(), hint = ui.hint && ui.hint();
        check.disabled = !ok;
        say_(ok ? (ex.type === 'write' && !knowsKey ? 'Ready. Press Check, or ' + MOD + ' + Enter.' : 'Ready. Press Check.')
          : hint ? hint
          : p[1] > 1 ? p[0] + ' of ' + p[1] + ' ' + NOUN[ex.type] + (veteran ? '.' : '. Check unlocks when all are done.')
          : veteran ? (ex.type === 'write' ? 'Type your line.' : 'Choose an answer.')
          : ex.type === 'write' ? 'Type your line to unlock Check.' : 'Choose an answer to unlock Check.', ok, check);
      };
      var builders = { mcq: bChoice, tf: bChoice, predict: bChoice, debug: bChoice, blocks: bBlocks, fill: bFill, trace: bTrace, match: bMatch, sort: bSort, write: bWrite };
      ui = builders[ex.type](ex, chg);
      card.appendChild(ui.node); card.appendChild(readyLine); actions.appendChild(check);
      chg();
      /* ⌘/Ctrl + Enter checks from anywhere in the card — the textarea above all */
      card.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey) && !check.disabled) { ev.preventDefault(); used('modenter', 1); check.click(); }
      });
    }
    actions.appendChild(h('button', { class: 'u-btn ghost', type: 'button', text: 'Skip', onclick: function () { stopTimer(); if (e.st === 'new') { e.st = 'skipped'; s.streak = 0; } e.retry = false; go(s.i + 1); } }));
  } else {
    var msg, stamp = fresh ? STAMP : '';
    var streak = fresh && e.st === 'full' && s.streak >= 3 ? ' <span class="u-streak">' + s.streak + ' in a row</span>' : '';
    if (e.st === 'full') msg = h('div', { class: 'fb ok', html: '<b class="h">' + stamp + 'Correct! +' + e.pts + ' points' + streak + '</b>' + fmt(ex.explain[lang]) });
    else if (e.st === 'half') msg = h('div', { class: 'fb ok', html: '<b class="h">' + stamp + 'Correct on the second try. +' + e.pts + ' points</b>' + fmt(ex.explain[lang]) });
    else if (e.st === 'done') msg = h('div', { class: 'fb ok', html: '<b class="h">' + stamp + 'Mini project done. Well done!</b>' + fmt(ex.explain[lang]) });
    else if (e.st === 'wrong1') msg = h('div', { class: 'fb no', html: '<b class="h">Not correct. ' + lost(e) + '</b>Press <b>Try again</b> for half points, or move on.' });
    else if (e.st === 'timeout') msg = h('div', { class: 'fb no', html: '<b class="h">Time is up.</b>Press <b>Try again</b> for half points, or move on.' });
    else if (e.st === 'wrong2') msg = h('div', { class: 'fb no', html: '<b class="h">Not correct this time. ' + lost(e) + '</b>' + fmt(ex.explain[lang]) });
    else msg = h('div', { class: 'fb info', html: '<b class="h">Skipped.</b>You can come back later for half points.' });
    fb.appendChild(msg);
    if (fresh) {
      msg.classList.add('is-enter');
      if (e.st === 'wrong1' || e.st === 'wrong2') card.classList.add('is-wrong');
    }
    if (['wrong1', 'timeout', 'wrong2', 'skipped'].indexOf(e.st) >= 0) actions.appendChild(h('button', { class: 'u-btn gold', type: 'button', text: 'Try again (' + Math.floor(PTS[ex.diff] / 2) + ' pts)', onclick: function () { e.left = true; e.retry = true; render(); } }));
    if (['full', 'half', 'wrong2'].indexOf(e.st) >= 0 || (e.st === 'done' && false)) card.appendChild(solution(ex));
  }
  card.appendChild(fb);

  var last = s.i === EX.length - 1;
  var prev = h('button', { class: 'u-btn ghost', type: 'button', text: '← Previous', disabled: s.i === 0, onclick: function () { go(s.i - 1); } });
  var next = h('button', { class: 'u-btn', type: 'button', text: last ? 'Finish' : 'Next →', disabled: e.st === 'new', onclick: function () { go(s.i + 1); } });
  card.appendChild(h('div', { class: 'nav' }, prev, actions, next));
  box.appendChild(card);
  if (interactive && !e.retry && ex.type !== 'mini') startTimer(ex, e, timerEl);
  /* The Check button is gone after a check; focus moves to the verdict that
     replaced it, so a keyboard or screen-reader user hears the result. */
  if (fresh && msg) {
    msg.setAttribute('tabindex', '-1');
    try { msg.focus({ preventScroll: true }); } catch (err) { msg.focus(); }
  }
}

function renderFinal(box) {
  var s = st(), total = maxScore(), topics = {}, unfinished = 0, i;
  EX.forEach(function (ex, k) {
    var e = ex_(ex.id);
    if (RETRY.indexOf(e.st) >= 0 || e.st === 'new') unfinished++;
    if (ex.noScore) return;
    var t = topics[ex.topic] || (topics[ex.topic] = { got: 0, max: 0 }); t.got += e.pts || 0; t.max += PTS[ex.diff];
  });
  var pct = Math.round(100 * s.score / total);
  var card = h('div', { class: 'u-card final' });
  card.appendChild(h('div', { class: 'u-eyebrow', text: 'SESSION ' + session.number + ' · RESULT · ' + LNAME[lang].toUpperCase() }));
  card.appendChild(h('h2', { text: pct >= 85 ? 'Excellent work!' : pct >= 65 ? 'Good job!' : pct >= 40 ? 'A good start. Keep practising.' : 'Practise a bit more, then try again.' }));
  var bigNum = h('span', { text: String(s.score) });
  card.appendChild(h('div', { class: 'big' }, bigNum, ' ', h('small', { text: '/ ' + total + ' · ' + pct + '%' })));
  if (justDone) { justDone = false; countTo(bigNum, 0, s.score); }
  card.appendChild(h('div', { class: 'lab', text: 'Topics (earned points)' }));
  var weak = [];
  Object.keys(topics).forEach(function (k) {
    var t = topics[k], r = t.got / t.max; if (r < 0.7) weak.push(k);
    card.appendChild(h('div', { class: 'tbar' }, h('span', { text: k }), h('div', { class: 'tr' }, h('i', { class: r < 0.5 ? 'weak' : r >= 0.8 ? 'good' : '', style: 'width:' + Math.round(100 * r) + '%' })), h('span', { text: t.got + ' / ' + t.max })));
  });
  card.appendChild(h('div', { class: 'fb ' + (weak.length ? 'info' : 'ok'), html: weak.length ? '<b class="h">Study these topics again:</b>' + weak.map(esc).join(', ') + '. Use the Self-practice section.' : '<b class="h">All topics are strong.</b>Go to the Self-practice section for extra challenge.' }));
  var act = h('div', { class: 'actions' });
  if (unfinished) act.appendChild(h('button', { class: 'u-btn gold', type: 'button', text: 'Retry ' + unfinished + ' unfinished (half points)', onclick: function () {
    for (i = 0; i < EX.length; i++) { var e = ex_(EX[i].id); if (RETRY.indexOf(e.st) >= 0 || e.st === 'new') { s.done = false; s.i = i; e.left = true; render(true); return; } } } }));
  act.appendChild(h('button', { class: 'u-btn', type: 'button', text: 'Go to Self-practice', onclick: function () { mode = 'practice'; render(true); } }));
  act.appendChild(h('button', { class: 'u-btn ghost', type: 'button', text: 'Back to exercises', onclick: function () { s.done = false; s.i = 0; render(true); } }));
  card.appendChild(act);
  box.appendChild(card);
}

/* ---------- self practice ---------- */
function renderPractice(box) {
  var done = PD[lang] || (PD[lang] = {}), counter = h('span', { class: 'u-pill' });
  function upd(bump) {
    var n = Object.keys(done).filter(function (k) { return done[k]; }).length;
    counter.innerHTML = 'Done <b>' + n + '</b> / ' + PR.length;
    if (bump) replay(counter, 'is-bump');
  }
  box.appendChild(h('div', { class: 'note', html: '<b>How to use this page.</b> Try each exercise alone first. Then press <b>Show answer</b> and compare. Tick <b>Done</b> when you understand it. Language: <b>' + LNAME[lang] + '</b> (change it at the top).' }));
  box.appendChild(h('div', { class: 'bar-row' }, counter));
  upd();
  [['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard']].forEach(function (lv) {
    var g = h('div', { class: 'pgroup' }, h('h3', { text: lv[1] }));
    PR.filter(function (p) { return p.level === lv[0]; }).forEach(function (p) {
      var ans = h('div', { class: 'ans' });
      var label = p.kind === 'predict' ? 'Output' : p.kind === 'debug' ? 'Fixed code' : 'Model answer';
      ans.appendChild(h('div', { class: 'lab', text: label }));
      if (p.kind === 'predict') ans.appendChild(h('pre', { class: 'ucode', text: p.answer[lang] })); else ans.appendChild(codeBlock(p.answer[lang]));
      ans.appendChild(h('p', { html: fmt(p.explain[lang]) }));
      var card = h('div', { class: 'pcard' });
      var cb = h('input', { type: 'checkbox', onchange: function () { done[p.id] = cb.checked; upd(true); } }); cb.checked = !!done[p.id];
      var btn = h('button', { class: 'u-btn sm ghost', type: 'button', text: 'Show answer', 'aria-expanded': 'false', onclick: function () { var open = card.classList.toggle('open'); btn.textContent = open ? 'Hide answer' : 'Show answer'; btn.setAttribute('aria-expanded', String(open)); } });
      card.appendChild(h('div', { class: 'meta' }, h('span', { class: 'u-badge b-' + p.level, text: p.level }), h('span', { class: 'u-badge b-type', text: TYPENAME[p.kind] || p.kind }), h('span', { class: 'u-step', text: p.id.toUpperCase().replace('S', 'Practice ') })));
      card.appendChild(h('h4', { text: p.title }));
      card.appendChild(h('p', { class: 'prompt', html: fmt(p.prompt) }));
      if (p.code) card.appendChild(codeBlock(p.code[lang]));
      card.appendChild(h('div', { class: 'actions' }, btn, h('label', { class: 'donebox' }, cb, h('span', { class: 'dtxt', text: 'Mark as done' }))));
      card.appendChild(ans); g.appendChild(card);
    });
    box.appendChild(g);
  });
  var L = session.links, cppjava = lang === 'cpp' || lang === 'java';
  if (L) box.appendChild(h('div', { class: 'u-card links' },
    h('h3', { text: L.title, style: 'font-family:var(--serif);margin-top:0' }),
    h('p', { html: fmt((cppjava ? L.introCppJava : L.introOther).replace(/\{lang\}/g, LNAME[lang])) }),
    h('ul', { html: L.items.map(function (it) { return '<li><a href="' + esc(it.href) + '"' + (it.internal ? '' : ' target="_blank" rel="noopener"') + '>' + esc(it.text) + '</a>' + (it.tail ? ' ' + fmt(it.tail) : '') + '</li>'; }).join('') })));
}

/* ---------- shell ---------- */
function render(scroll) {
  stopTimer();
  ST.lang = lang; ST.mode = mode; ST.timersOn = timersOn; ST.max = max;
  root.classList.toggle('u-max', max);
  document.documentElement.classList.toggle('u-lock', max);
  root.innerHTML = '';
  var lg = h('div', { class: 'lang', role: 'group', 'aria-label': 'Language' });
  LANGS.forEach(function (l) { lg.appendChild(h('button', { type: 'button', class: lang === l[0] ? 'on' : '', 'aria-pressed': String(lang === l[0]), text: l[1], onclick: function () {
    if (lang === l[0]) return;
    var was = lang, wasStarted = S[was] && S[was].started;
    lang = l[0]; try { localStorage.setItem(LANG_KEY, lang); } catch (e) {}
    render();
    /* Each language keeps its own score: a hidden mode unless it is said out loud.
       Said only once there is progress that would otherwise seem to vanish. */
    if (mode === 'class' && (wasStarted || (S[lang] && S[lang].started))) {
      toast('Now in ' + LNAME[lang] + '. Each language keeps its own score, so your ' + LNAME[was] + ' progress is saved as you left it.');
    } else say('Language: ' + LNAME[lang]);
  } })); });
  var tg = h('label', { class: 'tog' }); var cb2 = h('input', { type: 'checkbox', onchange: function () { timersOn = cb2.checked; render(); } }); cb2.checked = timersOn; tg.appendChild(cb2); tg.appendChild(document.createTextNode(' Timers'));
  root.appendChild(h('div', { class: 'u-toolbar' },
    h('div', { class: 'tabs' },
      h('button', { class: 'tab' + (mode === 'class' ? ' on' : ''), type: 'button', text: 'In class (' + EX.length + ')', onclick: function () { mode = 'class'; render(true); } }),
      h('button', { class: 'tab' + (mode === 'practice' ? ' on' : ''), type: 'button', text: 'Self-practice (' + PR.length + ')', onclick: function () { mode = 'practice'; render(true); } })),
    h('div', { class: 'u-tools' }, mode === 'class' ? tg : null, h('button', { class: 'u-btn ghost sm', type: 'button', text: max ? '✕ Exit full screen' : '⤢ Maximize', 'aria-pressed': String(max), onclick: function () { max = !max; render(); if (!max) root.scrollIntoView(); } }), h('span', { class: 'u-lbl', text: 'Language' }), lg)));
  var box = h('div', { class: 'u-body' + (mode === 'class' ? ' cls' : '') }); root.appendChild(box);
  if (mode === 'class') {
    renderClass(box);
  } else renderPractice(box);
  if (max) box.scrollTop = 0; else if (scroll && root.scrollIntoView) root.scrollIntoView();
}
window.addEventListener('hashchange', function onHash() { if (!document.body.contains(root)) { document.documentElement.classList.remove('u-lock'); window.removeEventListener('hashchange', onHash); } });
document.addEventListener('keydown', function onKey(e) {
  if (!document.body.contains(root)) { document.removeEventListener('keydown', onKey); document.documentElement.classList.remove('u-lock'); return; }
  if (e.key === 'Escape' && max) { max = false; render(); root.scrollIntoView(); }
});
render();
return { render: render };
}

/* ---------- site integration (used by app.js; the standalone page only calls mount) ---------- */

function token() {
  var l = document.querySelector('link[href*="css/styles.css"]');
  var m = l && l.getAttribute('href').match(/[?&]v=([^&]*)/);
  return m ? m[1] : '';
}

function loadCss(href, done) {
  var key = 'uni-css';
  var have = document.querySelector('link[data-' + key + ']');
  if (have) return done(true);
  var el = document.createElement('link');
  el.rel = 'stylesheet'; el.setAttribute('data-' + key, '');
  el.href = href + (token() ? '?v=' + token() : '');
  el.onload = function () { done(true); };
  el.onerror = function () { done(false); };
  document.head.appendChild(el);
}

/* styles + session list first; the session file only when the list says it exists,
   so a mistyped number is "not found" and not "could not load" */
function load(number, done) {
  var left = 2, ok = true;
  function step(r) {
    if (!r) ok = false;
    if (--left) return;
    if (!ok) return done(false);
    var has = number && window.UniData && window.UniData.list.some(function (x) { return x.number === number; });
    if (!has) return done(true);
    window.loadScript('data/university/s' + (number < 10 ? '0' : '') + number + '.js', done);
  }
  loadCss('css/university.css', step);
  window.loadScript('data/university/index.js', step);
}

function crumbs(last) {
  return '<div class="breadcrumb"><a href="#/">Courses</a><span>/</span>' +
    (last ? '<a href="#/university">University programming</a><span>/</span>' + esc(last) : 'University programming') + '</div>';
}

function listPage() {
  var data = window.UniData;
  if (!data || !data.list) return null;
  var rows = data.list.map(function (s) {
    return '<a class="module-row" href="#/university/s/' + s.number + '">' +
      '<span class="module-num">' + (s.number < 10 ? '0' : '') + s.number + '</span>' +
      '<span class="module-body"><strong>' + esc(s.title) + '</strong><span>' + esc(s.summary) + '</span></span>' +
      '<span class="module-count">' + s.exercises + ' exercises</span></a>';
  }).join('');
  return { title: 'University programming', description: data.description,
    html: crumbs() + '<span class="eyebrow">Fundamentals for university students</span>' +
      '<h1 class="page-title">University programming</h1><p class="page-lede">' + esc(data.description) + '</p>' +
      '<div class="module-list">' + rows + '</div><p class="page-lede">More sessions open here as they are ready.</p>' };
}

function sessionPage(number) {
  var data = window.UniData, s = data && data.sessions && data.sessions['s' + (number < 10 ? '0' : '') + number];
  if (!s) return null;
  var slides = s.slides ? '<p><a class="btn btn-ghost" href="' + esc(s.slides) + '" download>Download the slides (PDF)</a></p>' : '';
  return { title: 'Session ' + s.number + ' · ' + s.title, description: s.summary,
    html: crumbs('Session ' + s.number) + '<span class="eyebrow">Session ' + s.number + '</span>' +
      '<h1 class="page-title">' + esc(s.title) + '</h1><p class="page-lede">' + esc(s.summary) + '</p>' + slides +
      '<div class="uni" id="uni-root"></div>',
    mount: function () { mount(document.getElementById('uni-root'), s); } };
}

window.UniUI = { mount: mount, load: load, listPage: listPage, sessionPage: sessionPage };
})();
