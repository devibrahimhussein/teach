/* ==========================================================================
   Router + renderer. Vanilla, no dependencies.
   Routes:  #/                        course list
            #/c/<courseId>            module list
            #/c/<courseId>/m/<n>      module page (objectives + exercises)
            #/<id>                    an announced course from data/soon.js
            #/university              university course: session list
            #/university/s/<n>        one session (slides + exercises), js/university.js
   ========================================================================== */

(function () {
  'use strict';

  var LANGS = [
    { id: 'cpp',  label: 'C++' },
    { id: 'java', label: 'Java' }
  ];
  var LANG_KEY = 'teach.lang';

  function currentLang() {
    var stored = null;
    try { stored = localStorage.getItem(LANG_KEY); } catch (e) { /* file:// */ }
    return (stored === 'java' || stored === 'cpp') ? stored : 'cpp';
  }

  function setLang(lang) {
    try { localStorage.setItem(LANG_KEY, lang); } catch (e) { /* ignore */ }
  }

  /* ---------- text helpers ---------- */

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* Escapes HTML, then turns `inline code` into <code> spans. */
  function fmt(s) {
    return esc(s).replace(/`([^`]+)`/g, function (_, c) { return '<code>' + c + '</code>'; });
  }

  /* Titles are authored with markdown-ish backticks. Headings render them as <code>;
     nav labels and aria text drop them entirely. */
  function plain(s) { return String(s == null ? '' : s).replace(/`/g, ''); }

  function langLabel(id) {
    for (var i = 0; i < LANGS.length; i++) if (LANGS[i].id === id) return LANGS[i].label;
    return id;
  }

  /* ---------- small components ---------- */

  function langSelector(lang) {
    return '<div class="langsel" role="group" aria-label="Programming language">' +
      LANGS.map(function (l) {
        var on = l.id === lang;
        /* both states carry a class attribute so classList.toggle stays symmetric */
        return '<button type="button" class="lang-opt' + (on ? ' active' : '') + '"' +
          ' data-lang="' + l.id + '" aria-pressed="' + (on ? 'true' : 'false') + '">' +
          esc(l.label) + '</button>';
      }).join('') +
      '</div>';
  }

  function codeBlock(code, title) {
    return '<div class="code-head">' +
        '<span class="eyebrow">' + esc(title) + '</span>' +
        '<button type="button" class="copy-btn" data-copy="1">Copy</button>' +
      '</div>' +
      /* focusable so a keyboard user can scroll a long line into view */
      '<pre class="code" tabindex="0"><code>' + esc(code) + '</code></pre>';
  }

  /* Published for js/quiz.js, which renders inside the same page and must look
     identical. Same idea as window.Curriculum and window.starterCpp. */
  window.UI = {
    esc: esc,
    fmt: fmt,
    plain: plain,
    codeBlock: codeBlock,
    langSelector: langSelector,
    langLabel: langLabel,
    currentLang: currentLang
  };

  function field(label, body) {
    if (!body) return '';
    return '<div class="field"><span class="eyebrow">' + esc(label) + '</span>' +
      '<div class="body">' + fmt(body) + '</div></div>';
  }

  function samplesTable(samples) {
    if (!samples || !samples.length) return '';
    var rows = samples.map(function (s, i) {
      /* the case number is a row header, which is what gives the two data cells
         in the row a header to be announced under */
      return '<tr>' +
        '<th scope="row" class="n">' + (i + 1) + '</th>' +
        '<td>' + cell(s.input) + '</td>' +
        '<td>' + cell(s.output) + '</td>' +
        '</tr>';
    }).join('');
    return '<div class="field"><span class="eyebrow">Sample cases</span>' +
      '<div class="samples-wrap" tabindex="0"><table class="samples">' +
      '<thead><tr><th scope="col"><span class="sr-only">Case</span></th>' +
      '<th scope="col">Input</th><th scope="col">Output</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table></div></div>';
  }

  function cell(text) {
    if (text === '' || text == null) return '<span class="none">(nothing)</span>';
    if (text === '-') return '<span class="none">(no input)</span>';
    return '<pre>' + esc(text) + '</pre>';
  }

  /* ---------- exercise card ---------- */

  /* The only part of a card that changes with the language. Kept separate so the
     selector can rewrite it in place, without re-rendering (and re-scrolling) the page. */
  function langAreaInner(ex, lang) {
    var spec = ex[lang] || {};
    var starter = spec.starter ||
      (lang === 'cpp' ? window.starterCpp(spec.includes) : window.starterJava(spec.scanner));

    return '<span class="eyebrow">' + esc(langLabel(lang)) + ' notes</span>' +
      '<ul>' + (spec.notes || []).map(function (n) {
        return '<li>' + fmt(n) + '</li>';
      }).join('') + '</ul>' +
      codeBlock(starter, 'Starter template');
  }

  function exerciseCard(ex, index, lang, oi) {
    var diff = (ex.difficulty || 'Easy').toLowerCase();

    return '<article class="card" id="ex-' + (oi + 1) + '-' + (index + 1) + '" ' +
             'data-obj="' + oi + '" data-ex="' + index + '">' +
      '<div class="card-head">' +
        '<div class="card-title">' +
          '<span class="eyebrow">Exercise ' + (index + 1) + '</span>' +
          '<h3>' + esc(ex.title) + '</h3>' +
        '</div>' +
        '<div class="card-tools">' +
          '<span class="badge ' + diff + '">' + esc(ex.difficulty || 'Easy') + '</span>' +
          langSelector(lang) +
        '</div>' +
      '</div>' +

      '<p class="desc">' + fmt(ex.description) + '</p>' +
      field('Input', ex.input) +
      field('Output', ex.output) +
      samplesTable(ex.samples) +

      '<div class="lang-area">' + langAreaInner(ex, lang) + '</div>' +

      (ex.hint
        ? '<details class="hint"><summary>Hint</summary><p>' + fmt(ex.hint) + '</p></details>'
        : '') +

      '</article>';
  }

  /* ---------- objective ---------- */

  function objectiveBlock(obj, oi, lang) {
    var example = obj.example && obj.example[lang];
    return '<section class="objective" id="obj-' + (oi + 1) + '">' +
      '<div class="objective-head">' +
        '<span class="rule-label">Objective ' + (oi + 1) + '</span>' +
        '<h2>' + fmt(obj.title) + '</h2>' +
      '</div>' +
      (obj.summary ? '<p class="objective-summary">' + fmt(obj.summary) + '</p>' : '') +
      (obj.points && obj.points.length
        ? '<ul class="keypoints">' + obj.points.map(function (p) {
            return '<li>' + fmt(p) + '</li>';
          }).join('') + '</ul>'
        : '') +
      (example
        ? '<div class="example-block" data-obj="' + oi + '">' +
            codeBlock(example, langLabel(lang) + ' example') + '</div>'
        : '') +
      '<div class="exercise-grid">' +
        (obj.exercises || []).map(function (ex, i) {
          return exerciseCard(ex, i, lang, oi);
        }).join('') +
      '</div>' +
      '</section>';
  }

  /* ---------- services ---------- */

  var WA_GLYPH =
    '<svg class="wa-glyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"></path>' +
    '</svg>';

  function waLink(message) {
    var number = (window.CONTACT && window.CONTACT.whatsapp) || '';
    return 'https://wa.me/' + number + (message ? '?text=' + encodeURIComponent(message) : '');
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  /* Shared by the hero and every service block, so they stay visually identical. */
  /* AVIF and WebP ahead of the PNG, two widths each. The figure is capped at 480
     CSS px and hidden below 620px, so `sizes` never asks for the 900w file on a
     phone. `fetchpriority` marks it as the desktop LCP candidate; index.html
     preloads the same AVIF candidates so the fetch starts before this HTML exists. */
  var PORTRAIT_SIZES = '(max-width: 620px) 240px, (max-width: 999px) min(88vw, 480px), 480px';

  function portraitFigure() {
    return '<figure class="hero-portrait">' +
      '<picture>' +
        '<source type="image/avif" sizes="' + PORTRAIT_SIZES + '" ' +
          'srcset="img/ibrahim-hussein-480.avif 480w, img/ibrahim-hussein.avif 900w">' +
        '<source type="image/webp" sizes="' + PORTRAIT_SIZES + '" ' +
          'srcset="img/ibrahim-hussein-480.webp 480w, img/ibrahim-hussein.webp 900w">' +
        '<img src="img/ibrahim-hussein.png" alt="Mr. Ibrahim Hussein" ' +
             'width="900" height="1125" decoding="async" fetchpriority="high">' +
      '</picture>' +
      '<figcaption>' +
        '<strong>' + esc(window.CONTACT.name) + '</strong>' +
        '<span>' + esc(window.CONTACT.place) + '</span>' +
      '</figcaption>' +
    '</figure>';
  }

  function statsRow(pairs) {
    return '<div class="hero-stats">' + pairs.map(function (p) {
      return '<span><strong>' + esc(p[0]) + '</strong> ' + esc(p[1]) + '</span>';
    }).join('') + '</div>';
  }

  /* The inner half of a hero slide: copy on the left, shared portrait on the right. */
  function serviceSlideInner(s) {
    return '<div class="hero-copy">' +
        '<span class="hero-eyebrow">' + esc(s.eyebrow) + '</span>' +
        '<h2 class="hero-title is-inline">' + esc(s.title) +
          ' <em>' + esc(s.titleAccent) + '</em></h2>' +
        '<p class="hero-lede">' + esc(s.lede) + '</p>' +
        '<div class="hero-majors">' +
          '<span class="rule-label">' + esc(s.deliveryLabel) + '</span>' +
          '<div class="pill-row">' +
            s.delivery.map(function (d) {
              return '<span class="pill pill-solid">' + esc(d) + '</span>';
            }).join('') +
          '</div>' +
        '</div>' +
        '<div class="hero-actions">' +
          '<a class="btn btn-whatsapp" href="' + esc(waLink(s.cta.message)) + '" ' +
             'target="_blank" rel="noopener">' + WA_GLYPH + esc(s.cta.label) + '</a>' +
          '<a class="btn btn-ghost" href="tel:+' + esc(window.CONTACT.whatsapp) + '">Call ' +
             esc(window.CONTACT.display) + '</a>' +
        '</div>' +
        statsRow(s.stats || []) +
      '</div>' +
      portraitFigure();
  }

  function ctaRow(cta) {
    return '<div class="service-cta">' +
        '<a class="btn btn-whatsapp" href="' + esc(waLink(cta.message)) + '" ' +
           'target="_blank" rel="noopener">' + WA_GLYPH + esc(cta.label) + '</a>' +
        '<span class="service-cta-note">Or call ' + esc(window.CONTACT.display) + '</span>' +
      '</div>';
  }

  function serviceDetail(s) {
    return '<div class="service-detail" id="service-' + esc(s.id) + '">' +

      '<span class="rule-label">' + esc(s.subjectsLabel) + '</span>' +
      '<div class="subject-grid">' +
        s.subjects.map(function (name, i) {
          return '<div class="subject">' +
            '<span class="subject-num">' + pad2(i + 1) + '</span>' +
            '<span class="subject-name">' + esc(name) + '</span>' +
          '</div>';
        }).join('') +
      '</div>' +

      ctaRow(s.cta) +

      '</div>';
  }

  /* The Programming & OOP offering, built to the same shape as serviceDetail above:
     what it covers, then its CTA. The courses are what it covers,
     so the grid sits where a service puts its subject list. */
  function courseOffering(grid) {
    var p = window.CoursePricing;
    if (!p) return '<div class="course-grid">' + grid + '</div>';

    return '<h2 class="section-title">' + esc(p.title) + '</h2>' +
      '<div class="service-detail" id="offer-courses">' +
        '<span class="rule-label">' + esc(p.coursesLabel) + '</span>' +
        '<div class="course-grid">' + grid + '</div>' +
        ctaRow(p.cta) +
      '</div>';
  }

  function allServices() { return window.Services || []; }

  /* ---------- home-only blocks ---------- */

  /* Numbered path from a first WhatsApp message to a first session. */
  function stepsBlock() {
    var s = window.HomeContent && window.HomeContent.steps;
    if (!s || !s.items || !s.items.length) return '';

    return '<h2 class="section-title">' + esc(s.title) + '</h2>' +
      '<div class="steps" id="how-sessions-work">' +
        '<span class="rule-label">' + esc(s.label) + '</span>' +
        '<ol class="step-flow">' +
          s.items.map(function (it, i) {
            return '<li class="step">' +
              '<span class="step-head">' +
                '<span class="step-num">' + pad2(i + 1) + '</span>' +
                '<strong class="step-title">' + esc(it.title) + '</strong>' +
              '</span>' +
              '<span class="step-body">' + fmt(it.body) + '</span>' +
            '</li>';
          }).join('') +
        '</ol>' +
      '</div>';
  }

  /* Disclosures rather than a wall of text: the questions read as a list, and only
     the answer someone came for is opened. */
  function faqBlock() {
    var f = window.HomeContent && window.HomeContent.faq;
    if (!f || !f.items || !f.items.length) return '';

    return '<h2 class="section-title">' + esc(f.title) + '</h2>' +
      '<div class="faq" id="faq">' +
        '<span class="rule-label">' + esc(f.label) + '</span>' +
        '<div class="faq-list">' +
          f.items.map(function (it) {
            return '<details class="faq-item">' +
              '<summary>' + esc(it.q) + '</summary>' +
              '<p>' + fmt(it.a) + '</p>' +
            '</details>';
          }).join('') +
        '</div>' +
      '</div>';
  }

  /* ---------- hero slider ---------- */

  function chevron(dir) {
    var d = dir === 'left' ? 'M15 4 L7 12 L15 20' : 'M9 4 L17 12 L9 20';
    return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
      '<path d="' + d + '" fill="none" stroke="currentColor" stroke-width="2.4" ' +
      'stroke-linecap="round" stroke-linejoin="round"></path></svg>';
  }

  /* items: [{ label, inner }] — one hero per slide. A single item renders as a
     plain hero with no carousel chrome. */
  function heroSlider(items) {
    if (!items.length) return '';
    if (items.length === 1) return '<section class="hero">' + items[0].inner + '</section>';

    var slides = items.map(function (it, i) {
      /* a plain <div>: `group` is not an allowed role on <article> */
      return '<div class="hero hero-slide" role="group" aria-roledescription="slide" ' +
        'aria-label="' + esc(it.label) + ', slide ' + (i + 1) + ' of ' + items.length + '"' +
        /* inert="" rather than bare inert, so it matches what go() writes later */
        (i === 0 ? '' : ' aria-hidden="true" inert=""') + '>' + it.inner + '</div>';
    }).join('');

    /* the fill span doubles as the autoplay progress bar and its clock */
    var dots = items.map(function (it, i) {
      /* the button is the 44px tap area; the pill inside is what is drawn */
      return '<button type="button" class="hero-dot' + (i === 0 ? ' is-active' : '') + '" ' +
        'data-slide-to="' + i + '" aria-label="Show ' + esc(it.label) + '"' +
        (i === 0 ? ' aria-current="true"' : '') + '>' +
        '<span class="hero-dot-pill"><span class="hero-dot-fill"></span></span></button>';
    }).join('');

    /* WCAG 2.2.2: anything that moves on its own for more than 5s needs a pause */
    var pause = '<button type="button" class="hero-pause" data-slide-pause ' +
      'aria-label="Pause slideshow" aria-pressed="false">' +
      '<svg class="i-pause" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
        '<rect x="6" y="5" width="4" height="14" rx="1"></rect>' +
        '<rect x="14" y="5" width="4" height="14" rx="1"></rect></svg>' +
      '<svg class="i-play" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
        '<path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z"></path></svg>' +
      '</button>';

    return '<section class="hero-slider" role="region" aria-roledescription="carousel" ' +
             'aria-label="Tutoring highlights">' +
        '<div class="hero-viewport"><div class="hero-track">' + slides + '</div></div>' +
        '<button type="button" class="hero-arrow is-prev" data-slide-step="-1" ' +
          'aria-label="Previous slide">' + chevron('left') + '</button>' +
        '<button type="button" class="hero-arrow is-next" data-slide-step="1" ' +
          'aria-label="Next slide">' + chevron('right') + '</button>' +
        '<div class="hero-nav">' + dots + pause + '</div>' +
      '</section>';
  }

  /* Live controller, rebuilt after every render.

     Autoplay is driven by the progress-fill animation rather than a timer: the active
     dot fills over the slide duration and its `animationend` advances the carousel.
     That keeps the bar and the advance exactly in step, and lets CSS handle pausing. */
  var slider = { go: null, index: 0, restart: function () {} };

  function initSlider() {
    slider.go = null;

    var root = document.querySelector && document.querySelector('.hero-slider');
    if (!root) return;

    var track = root.querySelector('.hero-track');
    var slides = root.querySelectorAll('.hero-slide');
    var dots = root.querySelectorAll('.hero-dot');
    if (!track || slides.length < 2) return;

    var index = 0;
    var reduced = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function go(next) {
      index = ((next % slides.length) + slides.length) % slides.length;
      slider.index = index;
      track.style.transform = 'translateX(' + (-index * 100) + '%)';
      for (var i = 0; i < slides.length; i++) {
        var on = i === index;
        /* inert keeps the off-screen slide's links and buttons out of the tab order */
        if (on) { slides[i].removeAttribute('aria-hidden'); slides[i].removeAttribute('inert'); }
        else { slides[i].setAttribute('aria-hidden', 'true'); slides[i].setAttribute('inert', ''); }
        dots[i].classList.toggle('is-active', on);
        if (on) dots[i].setAttribute('aria-current', 'true');
        else dots[i].removeAttribute('aria-current');
      }
      restartFill();
    }

    /* Re-triggers the fill animation on the newly active dot. Stripping the
       animation and reading offsetWidth forces the reflow that lets it replay. */
    function restartFill() {
      if (reduced) return;
      var fill = dots[index].querySelector('.hero-dot-fill');
      if (!fill || !fill.style) return;
      fill.style.animation = 'none';
      void fill.offsetWidth;
      fill.style.animation = '';
    }

    slider.go = go;
    slider.restart = restartFill;

    if (root.addEventListener) {
      /* Hovering does not stop the carousel — the pointer sits over the hero for most
         of a visit, which would leave it frozen on the first slide. Keyboard focus
         still pauses it, so tabbing through a slide's links never moves them away. */
      root.addEventListener('focusin', function () { root.classList.add('is-paused'); });
      root.addEventListener('focusout', function () { root.classList.remove('is-paused'); });

      /* A full bar is the cue to advance. Skipped entirely under reduced motion,
         where the shortened animation would otherwise fire back to back. */
      if (!reduced) {
        root.addEventListener('animationend', function (e) {
          if (e.target && e.target.className &&
              String(e.target.className).indexOf('hero-dot-fill') > -1) {
            go(index + 1);
          }
        });
      }

      root.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight') go(index + 1);
        else if (e.key === 'ArrowLeft') go(index - 1);
      });

      var startX = null;
      root.addEventListener('touchstart', function (e) {
        startX = e.touches[0].clientX;
      }, { passive: true });
      root.addEventListener('touchend', function (e) {
        if (startX === null) return;
        var dx = e.changedTouches[0].clientX - startX;
        startX = null;
        if (Math.abs(dx) > 45) go(index + (dx < 0 ? 1 : -1));
      }, { passive: true });
    }
  }

  /* ---------- views ---------- */

  function viewHome() {
    var cards = Curriculum.allCourses().map(function (c, i) {
      var ready = readyModules(c);
      /* A course with nothing published says so plainly, instead of a row of zeroes. */
      var meta = ready
        ? '<span><strong>' + ready + '</strong> modules</span>' +
          '<span><strong>' + Curriculum.countExercises(c) + '</strong> exercises</span>'
        : '<span><strong>' + c.modules.length + '</strong> modules planned</span>' +
          '<span class="tag">Coming soon</span>';
      return '<a class="course-card' + (i === 0 ? ' is-featured' : '') + '" href="#/c/' + esc(c.id) + '">' +
        '<span class="eyebrow">' + esc(c.subtitle) + '</span>' +
        '<h2>' + esc(c.title) + '</h2>' +
        '<p>' + esc(c.description) + '</p>' +
        '<div class="course-meta">' + meta + '</div></a>';
    }).join('');

    var courses = Curriculum.allCourses();
    var published = courses.reduce(function (n, c) { return n + Curriculum.countExercises(c); }, 0);
    /* only modules a student can open today */
    var modules = courses.reduce(function (n, c) { return n + readyModules(c); }, 0);

    var majors = ['Data Science', 'Computer Science', 'IT', 'MIS', 'Engineering'];

    var platformSlide =
        '<div class="hero-copy">' +
        '<span class="hero-eyebrow">Private Tutoring</span>' +
        '<h1 class="hero-title">Programming<em>&amp; OOP</em></h1>' +
        '<p class="hero-lede">Build a strong foundation in code &mdash; from first principles ' +
        'to object-oriented mastery.</p>' +
        '<div class="hero-majors">' +
          '<span class="rule-label">Designed for majors in</span>' +
          '<div class="pill-row">' +
            majors.map(function (m) { return '<span class="pill">' + esc(m) + '</span>'; }).join('') +
          '</div>' +
        '</div>' +
        '<div class="hero-actions">' +
          '<a class="btn btn-primary" href="#/c/fundamentals">Start Programming Fundamentals</a>' +
          '<a class="btn btn-ghost" href="#/quiz/fundamentals">Take the free level test</a>' +
        '</div>' +
        statsRow([
          [courses.length, 'courses'],
          [modules, 'modules'],
          [published, 'exercises published'],
          ['C++', '& Java']
        ]) +
        '</div>' +
        portraitFigure();

    var slides = [{ label: 'Programming & OOP', inner: platformSlide }].concat(
      allServices().map(function (s) {
        return { label: s.title + ' ' + s.titleAccent, inner: serviceSlideInner(s) };
      })
    );

    return heroSlider(slides) +
      courseOffering(cards) +
      allServices().map(function (s) {
        return '<h2 class="section-title">' + esc(s.title + ' ' + s.titleAccent) + '</h2>' +
          serviceDetail(s);
      }).join('') +
      stepsBlock() +
      faqBlock();
  }

  function readyModules(course) {
    return course.modules.filter(function (m) { return m.status !== 'pending'; }).length;
  }

  /* How to use a module page. Lives on the course page, where the student is about
     to open one, rather than at the foot of the home page next to "How sessions work". */
  var HOW_TO_PANEL =
    '<div class="panel">' +
      '<span class="rule-label">How to use a module</span>' +
      '<ul>' +
        '<li>Read the short explanation and example at the top of each objective.</li>' +
        '<li>Solve the three exercises yourself, in order.</li>' +
        '<li>Switch between C++ and Java at the top-right of any exercise. The problem never changes &mdash; only the syntax notes and the starter template do.</li>' +
      '</ul>' +
    '</div>';

  function viewCourse(courseId) {
    var course = Curriculum.getCourse(courseId);
    if (!course) return notFound();

    var rows = course.modules.map(function (m) {
      var pending = m.status === 'pending';
      var count = Curriculum.moduleExercises(m);
      var inner =
        '<span class="module-num">' + (m.number < 10 ? '0' : '') + m.number + '</span>' +
        '<span class="module-body">' +
          '<strong>' + esc(m.title) + '</strong>' +
          '<span>' + esc(m.summary || m.note || '') + '</span>' +
        '</span>' +
        (pending
          ? '<span class="tag">Coming soon</span>'
          : '<span class="module-count">' + count + ' exercises</span>');

      /* Pending modules link too: their page lists what the module will cover. */
      return '<a class="module-row' + (pending ? ' is-pending' : '') + '" ' +
        'href="#/c/' + esc(course.id) + '/m/' + m.number + '">' + inner + '</a>';
    }).join('');

    /* Only courses that have a question bank offer the test. */
    var quizCta = (window.Quiz && Quiz.has(course.id))
      ? '<a class="quiz-cta" href="#/quiz/' + esc(course.id) + '">' +
          '<span class="quiz-cta-body">' +
            '<span class="eyebrow">Free level test</span>' +
            '<strong>Find out what you already know</strong>' +
            '<span>' + Quiz.countQuestions(course.id) + ' multiple-choice questions across ' +
              Quiz.countTopics(course.id) + ' objectives. The score at the end lists the ' +
              'objectives you know and the ones still to study.</span>' +
          '</span>' +
          '<span class="quiz-cta-go">Start &rarr;</span>' +
        '</a>'
      : '';

    return '<nav class="breadcrumb" aria-label="Breadcrumb"><a href="#/">Home</a><span>/</span>' + esc(course.title) + '</nav>' +
      '<span class="eyebrow">' + esc(course.subtitle) + '</span>' +
      '<h1 class="page-title">' + esc(course.title) + '</h1>' +
      '<p class="page-lede">' + esc(course.description) + '</p>' +
      (readyModules(course) ? HOW_TO_PANEL : '') +
      '<div class="module-list">' + rows + '</div>' +
      quizCta;
  }

  function viewModule(courseId, number, lang) {
    var course = Curriculum.getCourse(courseId);
    var mod = Curriculum.getModule(courseId, number);
    if (!course || !mod) return notFound();

    var crumb = '<nav class="breadcrumb" aria-label="Breadcrumb">' +
      '<a href="#/">Home</a><span>/</span>' +
      '<a href="#/c/' + esc(course.id) + '">' + esc(course.title) + '</a><span>/</span>' +
      'Module ' + mod.number + '</nav>';

    var head = '<span class="eyebrow">Module ' + mod.number + '</span>' +
      '<h1 class="page-title">' + esc(mod.title) + '</h1>' +
      (mod.summary ? '<p class="page-lede">' + esc(mod.summary) + '</p>' : '');

    if (mod.status === 'pending' || !mod.objectives) {
      return crumb + head +
        '<div class="pending-note"><strong>Coming soon.</strong> ' +
        esc(mod.note || 'The exercises for this module are being written.') +
        (mod.plannedTopics && mod.plannedTopics.length
          ? '<span class="rule-label">What it will cover</span>' +
            '<ul class="planned-topics">' + mod.plannedTopics.map(function (t) {
              return '<li>' + esc(t) + '</li>';
            }).join('') + '</ul>'
          : '') +
        '</div>' +
        ctaRow({ label: 'Ask when it opens',
          message: 'Hello, I am interested in ' + course.title + ', Module ' + mod.number +
                   ' (' + plain(mod.title) + '). When does it open?' }) +
        pager(course, mod);
    }

    var body = mod.objectives.map(function (o, i) {
      return objectiveBlock(o, i, lang);
    }).join('');

    return crumb + head +
      '<div class="module-layout">' +
        moduleNav(mod) +
        '<div class="module-main">' + body + pager(course, mod) + '</div>' +
      '</div>';
  }

  /* Sticky index of the module: every objective, with its three exercises nested
     underneath. Buttons rather than anchors, since an in-page #hash would clobber
     the route. On narrow screens it collapses into a <details> disclosure. */
  function moduleNav(mod) {
    var exerciseCount = mod.objectives.reduce(function (n, o) {
      return n + (o.exercises || []).length;
    }, 0);

    var items = mod.objectives.map(function (o, oi) {
      var exercises = (o.exercises || []).map(function (ex, i) {
        return '<li>' +
          '<button type="button" class="nav-ex" data-scroll="ex-' + (oi + 1) + '-' + (i + 1) + '">' +
            '<span class="nav-ex-num">' + (i + 1) + '</span>' +
            '<span class="nav-ex-title">' + esc(plain(ex.title)) + '</span>' +
            '<span class="nav-ex-dot ' + (ex.difficulty || 'Easy').toLowerCase() + '" ' +
              'title="' + esc(ex.difficulty || 'Easy') + '" aria-hidden="true"></span>' +
            '<span class="sr-only">, ' + esc(ex.difficulty || 'Easy') + '</span>' +
          '</button>' +
        '</li>';
      }).join('');

      return '<li>' +
        '<button type="button" class="nav-obj" data-scroll="obj-' + (oi + 1) + '">' +
          '<span class="nav-obj-num">' + (oi + 1) + '</span>' +
          '<span class="nav-obj-title">' + esc(plain(o.title)) + '</span>' +
        '</button>' +
        '<ol class="nav-exercises">' + exercises + '</ol>' +
      '</li>';
    }).join('');

    return '<details class="module-nav">' +
        '<summary>' +
          '<span class="rule-label">In this module</span>' +
          '<span class="module-nav-count">' + mod.objectives.length + ' objectives &middot; ' +
            exerciseCount + ' exercises</span>' +
        '</summary>' +
        '<nav class="module-nav-inner" aria-label="Module contents">' +
          '<ol class="nav-objectives">' + items + '</ol>' +
          /* the dots otherwise explain themselves only in a hover tooltip */
          '<p class="nav-legend" aria-hidden="true">' +
            '<span><i class="nav-ex-dot easy"></i>Easy</span>' +
            '<span><i class="nav-ex-dot medium"></i>Medium</span>' +
            '<span><i class="nav-ex-dot hard"></i>Hard</span>' +
          '</p>' +
        '</nav>' +
      '</details>';
  }

  function pager(course, mod) {
    var mods = course.modules;
    var idx = mods.indexOf(mod);
    var prev = idx > 0 ? mods[idx - 1] : null;
    var next = idx > -1 && idx < mods.length - 1 ? mods[idx + 1] : null;
    /* "Previous module" / "Next module" in words: a bare arrow is read aloud as
       "leftwards arrow" and tells a sighted visitor nothing about where it goes. */
    var link = function (m, label, arrow) {
      if (!m) return '<span></span>';
      return '<a href="#/c/' + esc(course.id) + '/m/' + m.number + '">' +
        '<span class="pager-label">' + arrow + ' ' + label + '</span>' +
        esc(plain(m.title)) + '</a>';
    };
    return '<nav class="pager" aria-label="Modules">' +
      link(prev, 'Previous module', '<span aria-hidden="true">&larr;</span>') +
      link(next, 'Next module', '<span aria-hidden="true">&rarr;</span>') + '</nav>';
  }

  /* The announced-but-unwritten courses. The whole page is the announcement: a badge,
     the name, why it is not here yet and one way to ask about it. No syllabus is
     shown — the topics are not agreed, and listing them would promise a shape the
     course may not take. */
  function soonCourse(id) {
    var list = window.SoonCourses || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return null;
  }

  function viewSoon(c) {
    var title = c.title || 'This course';
    var accent = c.titleAccent || '';

    return '<nav class="breadcrumb" aria-label="Breadcrumb"><a href="#/">Home</a><span>/</span>' +
        esc((title + ' ' + accent).trim()) + '</nav>' +

      '<div class="soon-page">' +
        '<span class="soon-badge">' + esc(c.eyebrow || 'Coming soon') + '</span>' +
        '<h1 class="soon-title">' + esc(title) +
          (accent ? ' <em>' + esc(accent) + '</em>' : '') + '</h1>' +
        (c.lede ? '<p class="soon-lede">' + esc(c.lede) + '</p>' : '') +
        '<p class="soon-note">' +
          esc(c.note || 'This course is being prepared. Sessions open once it is ' +
                        'ready.') + '</p>' +
        ctaRow(c.cta || { label: 'Ask about this course',
          message: 'Hello, I am interested in the ' + title + ' course. When does it start?' }) +
      '</div>';
  }

  function notFound() {
    return '<nav class="breadcrumb" aria-label="Breadcrumb"><a href="#/">Home</a></nav>' +
      '<h1 class="page-title">Page not found</h1>' +
      '<p class="page-lede">That course or module does not exist. ' +
      '<a href="#/">Back to the home page</a>.</p>';
  }

  /* ---------- routing ---------- */

  var SITE = 'Mr Ibrahim Hussein — Technology & Programming';
  var HOME_DESCRIPTION =
    'Private tutoring in programming and OOP, in Beirut or online. C++ and Java ' +
    'exercises with worked examples, plus a free level test.';
  var descriptionTag = null;

  /* The router owns the document title and description: with one HTML file behind
     every route, they would otherwise describe the home page everywhere. */
  function setMeta(title, description) {
    document.title = title ? plain(title) + ' — ' + SITE : SITE;
    if (!descriptionTag) descriptionTag = document.querySelector('meta[name="description"]');
    if (descriptionTag && description) descriptionTag.setAttribute('content', plain(description));
  }

  /* The link that was clicked is destroyed by the repaint, which drops keyboard and
     screen-reader focus onto <body>. Every paint after the first moves it to the new
     view instead, the way a full page load would. #app carries tabindex="-1". */
  var painted = false;

  function paint(html) {
    var app = document.getElementById('app');
    app.innerHTML = html;
    window.scrollTo(0, 0);
    initSlider();
    initModuleNav();
    if (window.QuizUI) QuizUI.paintBars(app);
    if (painted) {
      try { app.focus({ preventScroll: true }); } catch (e) { app.focus(); }
    }
    painted = true;
  }

  /* Shown while a deferred file is in flight. It replaces a view the visitor asked
     for, so it is announced; the fixed height keeps the footer where it was. */
  function loadingView(label) {
    return '<div class="route-loading" role="status">' +
      '<span class="route-loading-bar"></span>' +
      '<p>Loading ' + esc(label) + '…</p></div>';
  }

  function loadFailed(what) {
    return '<nav class="breadcrumb" aria-label="Breadcrumb"><a href="#/">Home</a></nav>' +
      '<h1 class="page-title">Could not load ' + esc(what) + '</h1>' +
      '<p class="page-lede">The connection dropped before the content arrived. ' +
      '<button type="button" class="linklike" data-reload>Try again</button>, ' +
      'or go <a href="#/">back to the home page</a>.</p>';
  }

  /* Only the newest navigation may paint: a visitor who moves on while a file is in
     flight must not have the old destination appear underneath them. */
  var routeToken = 0;

  /* #/c/<course>/m/<n>/<anchor> lands on one objective or exercise — the links a
     search result points at. The anchor is scrolled to, focused and flashed. */
  function revealTarget(id) {
    var el = id && document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ block: 'start' });
    el.setAttribute('tabindex', '-1');
    try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
    el.classList.remove('is-target');
    void el.offsetWidth;
    el.classList.add('is-target');
  }

  function routeModule(courseId, number, lang, target) {
    var course = Curriculum.getCourse(courseId);
    var mod = Curriculum.getModule(courseId, number);
    if (!course || !mod) { setMeta('Page not found'); return paint(notFound()); }

    setMeta('Module ' + mod.number + ' ' + mod.title + ' — ' + course.title, mod.summary);
    if (!mod.deferred) {
      paint(viewModule(courseId, number, lang));
      return revealTarget(target);
    }

    var token = routeToken;
    paint(loadingView('Module ' + mod.number + ', ' + plain(mod.title)));
    Curriculum.loadModule(courseId, number, function (loaded) {
      if (token !== routeToken) return;
      paint(loaded ? viewModule(courseId, number, lang) : loadFailed('this module'));
      if (loaded) revealTarget(target);
    });
  }

  /* ---------- search ---------- */

  /* Everything a student might look for: courses, modules (with a pending module's
     planned topics), objectives and exercises, the announced courses and the level
     test. Objectives and exercises exist only once their module file has loaded,
     so the index is rebuilt on every query rather than cached. */
  function searchIndex() {
    var items = [];
    Curriculum.allCourses().forEach(function (c) {
      items.push({ kind: 'Course', rank: 0, title: c.title, where: c.subtitle,
        text: c.subtitle + ' ' + c.description, href: '#/c/' + c.id });

      c.modules.forEach(function (m) {
        var base = '#/c/' + c.id + '/m/' + m.number;
        var place = c.title + ' · Module ' + m.number + ', ' + plain(m.title);
        items.push({
          kind: m.status === 'pending' ? 'Module · coming soon' : 'Module', rank: 1,
          title: 'Module ' + m.number + ': ' + plain(m.title), where: c.title,
          text: plain((m.summary || '') + ' ' + (m.plannedTopics || []).join(' ')),
          href: base
        });
        (m.objectives || []).forEach(function (o, oi) {
          items.push({ kind: 'Objective', rank: 2, title: plain(o.title), where: place,
            text: plain(o.summary || ''), href: base + '/obj-' + (oi + 1) });
          (o.exercises || []).forEach(function (ex, i) {
            items.push({
              kind: 'Exercise · ' + (ex.difficulty || 'Easy'), rank: 3,
              title: plain(ex.title), where: place + ' · ' + plain(o.title),
              text: plain(ex.description || ''),
              href: base + '/ex-' + (oi + 1) + '-' + (i + 1)
            });
          });
        });
      });

      if (window.Quiz && Quiz.has(c.id)) {
        items.push({ kind: 'Level test', rank: 1, title: 'Level test: ' + c.title,
          where: 'Free, multiple choice',
          text: 'quiz exam assessment evaluation test placement', href: '#/quiz/' + c.id });
      }
    });

    (window.SoonCourses || []).forEach(function (s) {
      var name = (s.title + ' ' + (s.titleAccent || '')).trim();
      items.push({ kind: 'Course · coming soon', rank: 0, title: name, where: 'Announced',
        text: s.lede || '', href: '#/' + s.id });
    });
    return items;
  }

  function searchWords(q) {
    return String(q || '').toLowerCase().split(/\s+/).filter(Boolean);
  }

  /* Every word must appear somewhere; a word in the title outranks one in the body. */
  function searchMatches(q) {
    var words = searchWords(q);
    if (!words.length) return [];
    return searchIndex().map(function (it) {
      var title = it.title.toLowerCase();
      var all = title + ' ' + it.where.toLowerCase() + ' ' + it.text.toLowerCase();
      for (var i = 0; i < words.length; i++) if (all.indexOf(words[i]) < 0) return null;
      var inTitle = words.filter(function (w) { return title.indexOf(w) > -1; }).length;
      it.score = inTitle * 10 - it.rank;
      return it;
    }).filter(Boolean).sort(function (a, b) { return b.score - a.score; });
  }

  function highlight(text, q) {
    var words = searchWords(q).map(function (w) {
      return w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    });
    if (!words.length) return esc(text);
    return String(text).split(new RegExp('(' + words.join('|') + ')', 'gi'))
      .map(function (part, i) { return i % 2 ? '<mark>' + esc(part) + '</mark>' : esc(part); })
      .join('');
  }

  var search = { loading: false, failed: false };
  var SEARCH_LIMIT = 40;

  function searchStatus(q, count) {
    var tail = search.loading ? ' Still loading the exercises…' :
      search.failed ? ' Some modules could not be loaded, so a few exercises may be missing.' : '';
    if (!searchWords(q).length) {
      return 'Search ' + Curriculum.allCourses().reduce(function (n, c) {
        return n + Curriculum.countExercises(c);
      }, 0) + ' exercises, every objective and module, and the level test.' + tail;
    }
    if (!count) return 'No results for “' + q.trim() + '”.' + tail;
    return count + ' result' + (count === 1 ? '' : 's') + ' for “' + q.trim() + '”' +
      (count > SEARCH_LIMIT ? ', showing the first ' + SEARCH_LIMIT : '') + '.' + tail;
  }

  function searchList(q, hits) {
    if (!searchWords(q).length) return '';
    if (!hits.length) {
      return '<div class="search-empty panel">' +
        '<span class="rule-label">Nothing matched</span>' +
        '<ul>' +
          '<li>Check the spelling, or try a shorter word: “loop” finds more than “looping”.</li>' +
          '<li>Search by topic (“arrays”, “switch”) or by what an exercise does (“discount”, “average”).</li>' +
          '<li>Or browse <a href="#/c/fundamentals">Programming Fundamentals</a> module by module.</li>' +
        '</ul></div>';
    }
    return '<ol class="search-results">' + hits.slice(0, SEARCH_LIMIT).map(function (it) {
      return '<li><a href="' + esc(it.href) + '">' +
        '<span class="search-kind">' + esc(it.kind) + '</span>' +
        '<span class="search-title">' + highlight(it.title, q) + '</span>' +
        '<span class="search-where">' + esc(it.where) + '</span>' +
      '</a></li>';
    }).join('') + '</ol>';
  }

  function viewSearch(q) {
    var hits = searchMatches(q);
    return '<nav class="breadcrumb" aria-label="Breadcrumb"><a href="#/">Home</a>' +
        '<span>/</span>Search</nav>' +
      '<h1 class="page-title">Search</h1>' +
      '<form class="search-form" role="search" data-search-form>' +
        '<label class="eyebrow" for="search-q">Courses, modules, objectives and exercises</label>' +
        '<input class="search-input" id="search-q" type="search" autocomplete="off" ' +
          'spellcheck="false" enterkeyhint="search" value="' + esc(q) + '">' +
        '<p class="search-hint">Results update as you type. Press <kbd>/</kbd> on any page to come back here.</p>' +
      '</form>' +
      '<p class="search-status" id="search-status" role="status">' + esc(searchStatus(q, hits.length)) + '</p>' +
      '<div id="search-list">' + searchList(q, hits) + '</div>';
  }

  /* Repaints only the status and the list, so the field keeps focus and caret. */
  function updateSearch(q) {
    var status = document.getElementById('search-status');
    var list = document.getElementById('search-list');
    if (!status || !list) return;
    var hits = searchMatches(q);
    status.textContent = searchStatus(q, hits.length);
    list.innerHTML = searchList(q, hits);
  }

  function currentQuery() {
    var input = document.getElementById('search-q');
    return input ? input.value : '';
  }

  function routeSearch(q) {
    setMeta('Search', 'Search every course, module, objective and exercise.');
    paint(viewSearch(q));
    var input = document.getElementById('search-q');
    if (input) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }

    /* exercises live in the deferred module files: fetch every published one */
    var pending = [];
    Curriculum.allCourses().forEach(function (c) {
      c.modules.forEach(function (m) {
        if (m.deferred && m.src && m.status !== 'pending') pending.push([c.id, m.number]);
      });
    });
    if (!pending.length) return;

    var token = routeToken, left = pending.length;
    search.loading = true;
    search.failed = false;
    updateSearch(q);
    pending.forEach(function (p) {
      Curriculum.loadModule(p[0], p[1], function (mod) {
        if (!mod || mod.deferred) search.failed = true;
        if (--left) return;
        search.loading = false;
        if (token === routeToken) updateSearch(currentQuery());
      });
    });
  }

  var searchTimer = null;

  document.addEventListener('input', function (e) {
    if (!e.target || e.target.id !== 'search-q') return;
    var q = e.target.value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () {
      updateSearch(q);
      /* keeps the query in the address so Back and a shared link return to it;
         replaceState fires no hashchange, so the page is not rebuilt mid-typing */
      if (history.replaceState) {
        history.replaceState(null, '', '#/search' + (q.trim() ? '?q=' + encodeURIComponent(q.trim()) : ''));
      }
    }, 120);
  });

  document.addEventListener('submit', function (e) {
    if (!e.target || !e.target.hasAttribute('data-search-form')) return;
    e.preventDefault();
    /* Enter opens the best match */
    var first = document.querySelector('#search-list .search-results a');
    if (first) location.hash = first.getAttribute('href');
  });

  /* "/" from anywhere opens search — a convention from GitHub, YouTube and Slack. */
  document.addEventListener('keydown', function (e) {
    if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
    var t = e.target;
    if (t && t.closest && t.closest('input, textarea, select, [contenteditable]')) return;
    e.preventDefault();
    var input = document.getElementById('search-q');
    if (input) input.focus();
    else location.hash = '#/search';
  });

  function routeQuiz(courseId, lang) {
    var course = Curriculum.getCourse(courseId);
    setMeta('Level test' + (course ? ' — ' + course.title : ''),
      'A free multiple-choice level test that scores which objectives you already know.');

    if (window.QuizUI && Quiz.topics(courseId).length) {
      return paint(QuizUI.page(courseId, lang) || notFound());
    }
    if (!Quiz.has(courseId)) { setMeta('Page not found'); return paint(notFound()); }

    var token = routeToken;
    paint(loadingView('the level test'));

    /* engine and question bank travel together, and only for this route */
    loadScript('js/quiz.js', function (engineOk) {
      Quiz.load(courseId, function (bankOk) {
        if (token !== routeToken) return;
        paint(engineOk && bankOk && window.QuizUI
          ? (QuizUI.page(courseId, lang) || notFound())
          : loadFailed('the level test'));
      });
    });
  }

  /* University programming course. The engine, its stylesheet and the session data
     travel together and only for this route, the way the evaluation test does. */
  function routeUniversity(number) {
    var token = routeToken;
    setMeta('University programming', 'A hands-on introduction to programming for university students, in C, C++, Java or Python.');
    paint(loadingView('the university course'));
    loadScript('js/university.js', function (engineOk) {
      if (token !== routeToken) return;
      if (!engineOk || !window.UniUI) return paint(loadFailed('the university course'));
      UniUI.load(number, function (ok) {
        if (token !== routeToken) return;
        if (!ok) return paint(loadFailed('the university course'));
        var page = number ? UniUI.sessionPage(number) : UniUI.listPage();
        if (!page) { setMeta('Page not found'); return paint(notFound()); }
        setMeta(page.title, page.description);
        paint(page.html);
        if (page.mount) page.mount();
      });
    });
  }

  /* "You are here" in the header: the link whose route is the current one, or an
     ancestor of it (a module page lights up its course). */
  function markNav(hash) {
    var links = document.querySelectorAll('.site-nav a, .header-search');
    var path = hash.replace(/\?.*$/, '').replace(/\/+$/, '');
    for (var i = 0; i < links.length; i++) {
      var target = links[i].getAttribute('href').replace(/^#/, '');
      var here = path === target || path.indexOf(target + '/') === 0;
      if (here) links[i].setAttribute('aria-current', 'page');
      else links[i].removeAttribute('aria-current');
    }
  }

  function render() {
    var hash = location.hash.replace(/^#/, '');
    var lang = currentLang();
    var soon, course;
    var m;

    routeToken++;
    markNav(hash);

    if ((m = hash.match(/^\/university(?:\/s\/(\d+))?\/?$/))) {
      routeUniversity(m[1] ? Number(m[1]) : 0);
    } else if ((m = hash.match(/^\/c\/([\w-]+)\/m\/(\d+)(?:\/((?:obj|ex)-[\d-]+))?/))) {
      routeModule(m[1], m[2], lang, m[3]);
    } else if ((m = hash.match(/^\/search\/?(?:\?q=(.*))?$/))) {
      var q = '';
      try { q = decodeURIComponent(m[1] || ''); } catch (err) { q = m[1] || ''; }
      routeSearch(q);
    } else if ((m = hash.match(/^\/([\w-]+)\/?$/)) && (soon = soonCourse(m[1]))) {
      setMeta((soon.title + ' ' + (soon.titleAccent || '')).trim(), soon.lede);
      paint(viewSoon(soon));
    } else if ((m = hash.match(/^\/quiz\/([\w-]+)/))) {
      routeQuiz(m[1], lang);
    } else if ((m = hash.match(/^\/c\/([\w-]+)/))) {
      course = Curriculum.getCourse(m[1]);
      setMeta(course && course.title, course && course.description);
      paint(viewCourse(m[1]));
    } else if (/^\/?$/.test(hash)) {
      setMeta(null, HOME_DESCRIPTION);
      paint(viewHome());
    } else {
      setMeta('Page not found');
      paint(notFound());
    }
  }

  /* ---------- module sidebar ---------- */

  var WIDE = '(min-width: 1100px)';
  var navScrollHandler = null;
  var navResizeHandler = null;

  function isWide() {
    return !window.matchMedia || window.matchMedia(WIDE).matches;
  }

  /* Open on desktop (where the summary is hidden), collapsed on mobile. */
  function syncNavDisclosure(nav) {
    nav.open = isWide();
  }

  function initModuleNav() {
    if (navScrollHandler && window.removeEventListener) {
      window.removeEventListener('scroll', navScrollHandler);
      window.removeEventListener('resize', navResizeHandler);
    }
    navScrollHandler = navResizeHandler = null;

    var nav = document.querySelector && document.querySelector('.module-nav');
    if (!nav) return;
    syncNavDisclosure(nav);

    var buttons = nav.querySelectorAll('[data-scroll]');
    var entries = [];
    for (var i = 0; i < buttons.length; i++) {
      var id = buttons[i].getAttribute('data-scroll');
      var el = document.getElementById(id);
      if (el) entries.push({ btn: buttons[i], el: el, id: id });
    }
    if (!entries.length) return;

    var ticking = false;

    function update() {
      ticking = false;
      /* the last thing whose top has passed under the sticky header is "current" */
      var active = entries[0];
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].el.getBoundingClientRect().top <= 140) active = entries[i];
      }
      /* an exercise also lights up the objective that owns it */
      var owner = 'obj-' + (active.id.split('-')[1] || '');
      for (i = 0; i < entries.length; i++) {
        var e = entries[i];
        e.btn.classList.toggle('is-current', e === active);
        e.btn.classList.toggle('is-owner', e.id === owner && e !== active);
      }
    }

    navScrollHandler = function () {
      if (!ticking) { ticking = true; window.requestAnimationFrame(update); }
    };
    navResizeHandler = function () { syncNavDisclosure(nav); };

    if (window.addEventListener) {
      window.addEventListener('scroll', navScrollHandler, { passive: true });
      window.addEventListener('resize', navResizeHandler);
    }
    update();
  }

  /* ---------- language switching ---------- */

  function currentModule() {
    var m = location.hash.replace(/^#/, '').match(/^\/c\/([\w-]+)\/m\/(\d+)/);
    return m ? Curriculum.getModule(m[1], m[2]) : null;
  }

  /* Rewrites only the language-dependent regions. The page is never re-rendered, so
     the scroll position, the open hints and the browser history all stay untouched. */
  function swapLanguage(lang) {
    setLang(lang);

    var i, buttons = document.querySelectorAll('.langsel button');
    for (i = 0; i < buttons.length; i++) {
      var on = buttons[i].getAttribute('data-lang') === lang;
      buttons[i].classList.toggle('active', on);
      buttons[i].setAttribute('aria-pressed', on ? 'true' : 'false');
    }

    /* the test asks language-specific questions, so it is redrawn whole */
    if (window.QuizUI && QuizUI.isActive()) { QuizUI.refresh(false); return; }

    var mod = currentModule();
    if (!mod || !mod.objectives) return;   // course list and pending pages have no code

    var examples = document.querySelectorAll('.example-block[data-obj]');
    for (i = 0; i < examples.length; i++) {
      var obj = mod.objectives[Number(examples[i].getAttribute('data-obj'))];
      var snippet = obj && obj.example && obj.example[lang];
      if (snippet) examples[i].innerHTML = codeBlock(snippet, langLabel(lang) + ' example');
    }

    var cards = document.querySelectorAll('.card[data-obj]');
    for (i = 0; i < cards.length; i++) {
      var owner = mod.objectives[Number(cards[i].getAttribute('data-obj'))];
      var ex = owner && owner.exercises[Number(cards[i].getAttribute('data-ex'))];
      var area = cards[i].querySelector('.lang-area');
      if (ex && area) area.innerHTML = langAreaInner(ex, lang);
    }
  }

  /* ---------- events ---------- */

  document.addEventListener('click', function (e) {
    var btn = e.target.closest ? e.target.closest('button') : null;
    if (!btn) return;

    if (btn.hasAttribute('data-lang')) {
      var next = btn.getAttribute('data-lang');
      if (next !== currentLang()) swapLanguage(next);
      return;
    }

    if (window.QuizUI && QuizUI.click(btn)) return;

    if (btn.hasAttribute('data-slide-to') && slider.go) {
      slider.go(Number(btn.getAttribute('data-slide-to')));
      slider.restart();
      return;
    }

    if (btn.hasAttribute('data-slide-pause')) {
      var root = btn.closest('.hero-slider');
      var stopped = root.classList.toggle('is-stopped');
      btn.setAttribute('aria-pressed', stopped ? 'true' : 'false');
      btn.setAttribute('aria-label', stopped ? 'Play slideshow' : 'Pause slideshow');
      return;
    }

    if (btn.hasAttribute('data-slide-step') && slider.go) {
      slider.go(slider.index + Number(btn.getAttribute('data-slide-step')));
      slider.restart();
      return;
    }

    if (btn.hasAttribute('data-scroll')) {
      var target = document.getElementById(btn.getAttribute('data-scroll'));
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      /* on mobile the sidebar is a disclosure — close it once a choice is made */
      var nav = btn.closest('.module-nav');
      if (nav && !isWide()) nav.open = false;
      return;
    }

    if (btn.hasAttribute('data-reload')) {
      location.reload();
      return;
    }

    if (btn.hasAttribute('data-copy')) {
      var pre = btn.parentElement.nextElementSibling;
      if (pre) copyText(pre.innerText, btn);
    }
  });

  /* The button's own label carries the result, and role="status" on it is not
     allowed, so a shared polite live region announces it to screen readers. */
  var announcer = null;

  function announce(msg) {
    if (!announcer) {
      announcer = document.createElement('div');
      announcer.className = 'sr-only';
      announcer.setAttribute('role', 'status');
      document.body.appendChild(announcer);
    }
    announcer.textContent = '';
    setTimeout(function () { announcer.textContent = msg; }, 50);
  }

  function copyText(text, btn) {
    var flash = function (label, msg, ms) {
      if (!btn.hasAttribute('data-label')) btn.setAttribute('data-label', btn.textContent);
      btn.textContent = label;
      announce(msg);
      clearTimeout(btn._t);
      btn._t = setTimeout(function () { btn.textContent = btn.getAttribute('data-label'); }, ms);
    };
    var done = function () { flash('Copied', 'Code copied to the clipboard', 1200); };
    /* Never fail silently: select the code so one keystroke finishes the job. */
    var failed = function () {
      var pre = btn.parentElement.nextElementSibling;
      if (pre && window.getSelection) {
        var range = document.createRange();
        range.selectNodeContents(pre);
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      }
      var keys = /Mac|iPhone|iPad/.test(navigator.platform || '') ? '⌘C' : 'Ctrl+C';
      flash('Press ' + keys, 'Copy failed. The code is selected, press ' + keys + ' to copy it', 3000);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallback(text, done, failed); });
    } else {
      fallback(text, done, failed);
    }
  }

  function fallback(text, done, failed) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.className = 'copy-scratch';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    if (ok) done(); else failed();
  }

  window.addEventListener('hashchange', render);
  render();
})();
