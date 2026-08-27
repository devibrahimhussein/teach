/* ==========================================================================
   Boot: the preloader gate and the on-demand script loader.

   This is the one script in the head that is not deferred — the gate has to run
   before the first paint, or the second view of a session flashes the overlay.
   It is deliberately tiny; everything else on the page is deferred.
   ========================================================================== */

(function () {
  'use strict';

  /* ---------- cache-busting token ----------
     Read off this file's own <script src>, so the ?v= in index.html stays the
     single place the token is written. Files fetched later (deferred module data,
     the test engine) reuse it. */
  var VERSION = (function () {
    var el = document.currentScript;
    var m = el && el.src && el.src.match(/[?&]v=([^&]*)/);
    return m ? m[1] : '';
  })();

  /* Fetches a script once. Concurrent callers for the same URL share one request.
     A plain <script> element rather than fetch(), because the site is expected to
     run from file:// too, where XHR and fetch are blocked. */
  var scripts = {};

  window.loadScript = function (src, done) {
    var entry = scripts[src];
    if (entry && entry.state === 'done') return done(entry.ok);
    if (entry) return entry.waiting.push(done);

    entry = scripts[src] = { state: 'loading', ok: false, waiting: [done] };

    function settle(ok) {
      if (entry.state === 'done') return;
      entry.state = 'done';
      entry.ok = ok;
      var waiting = entry.waiting;
      entry.waiting = [];
      for (var i = 0; i < waiting.length; i++) waiting[i](ok);
    }

    var el = document.createElement('script');
    el.src = src + (VERSION ? '?v=' + VERSION : '');
    el.async = false;              /* keep declaration order between chained loads */
    el.onload = function () { settle(true); };
    el.onerror = function () { settle(false); };
    document.head.appendChild(el);
  };

  /* ---------- skip link ----------
     A plain href="#app" would be swallowed by the hash router and land on the
     not-found view, so the link moves focus itself. Wired here rather than in
     app.js so it works from the first paint, before the app has downloaded. */
  document.addEventListener('click', function (e) {
    var link = e.target.closest && e.target.closest('.skip-link');
    if (!link) return;
    e.preventDefault();
    var main = document.getElementById('app');
    if (!main) return;
    main.focus();
    main.scrollIntoView();
  });

  /* ---------- preloader gate ----------
     Shown on the first view of a session only. sessionStorage throws on file:// in
     some browsers — there we just show it and forget. */
  var seen = null;
  try {
    seen = sessionStorage.getItem('teach.preloaded');
    sessionStorage.setItem('teach.preloaded', '1');
  } catch (e) { /* no memory available */ }

  if (seen) return;
  document.documentElement.className += ' is-loading';

  /* Dismissed once the router has painted its first view — that is DOMContentLoaded,
     since every script on the page is deferred — after a short floor so the overlay
     reads as a beat rather than a flicker. Waiting on `load` instead would hold the
     page behind the portrait download for no gain. */
  var MIN_MS = 550, FADE_MS = 450, MAX_WAIT_MS = 4000;
  var start = Date.now(), dismissed = false;

  function dismiss() {
    if (dismissed) return;
    dismissed = true;
    setTimeout(function () {
      var html = document.documentElement;
      html.className = html.className.replace(/\bis-loading\b/, '').replace(/\s+/g, ' ').trim();
      var el = document.querySelector('.preloader');
      if (!el) return;
      el.className += ' is-gone';
      setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, FADE_MS);
    }, Math.max(0, MIN_MS - (Date.now() - start)));
  }

  if (document.readyState !== 'loading') dismiss();
  else document.addEventListener('DOMContentLoaded', dismiss);
  setTimeout(dismiss, MAX_WAIT_MS);   /* never trap the page behind a stalled asset */
})();
