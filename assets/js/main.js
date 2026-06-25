/* ana.mn — soft club runtime. Vanilla, no deps. All motion guarded. */
(function () {
  'use strict';
  var rm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- reveal on scroll ---- */
  var els = document.querySelectorAll('.reveal');
  if (rm || !('IntersectionObserver' in window)) {
    els.forEach(function (el) { el.classList.add('in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          var d = parseInt(e.target.getAttribute('data-delay') || '0', 10);
          e.target.style.transitionDelay = (d * 90) + 'ms';
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    els.forEach(function (el) { io.observe(el); });
  }

  /* ---- live San Francisco clock (transit board) ---- */
  var clock = document.getElementById('clock');
  if (clock) {
    var fmt;
    try {
      fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Los_Angeles', hour: '2-digit', minute: '2-digit', hour12: false
      });
    } catch (err) { fmt = null; }
    var tick = function () {
      var t = fmt ? fmt.format(new Date()) : '';
      clock.textContent = 'SF ' + (t || '');
    };
    tick();
    setInterval(tick, 15000);
  }

  if (rm) return; /* everything below is motion */

  /* ---- hero kinetic chrome: "líquida" breathes its width/weight on pointer ---- */
  var l2 = document.querySelector('.hero__l2');
  var hero = document.querySelector('.hero');
  if (l2 && hero) {
    var rafH = null;
    hero.addEventListener('pointermove', function (ev) {
      if (rafH) return;
      rafH = requestAnimationFrame(function () {
        var r = hero.getBoundingClientRect();
        var x = Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width));
        var wdth = 88 + x * 37;        /* 88 -> 125 */
        var wght = 640 + x * 220;      /* 640 -> 860 */
        l2.style.fontVariationSettings = "'wght' " + wght.toFixed(0) + ", 'wdth' " + wdth.toFixed(1);
        rafH = null;
      });
    });
    hero.addEventListener('pointerleave', function () {
      l2.style.fontVariationSettings = "'wght' 820, 'wdth' 118";
    });
  }

  /* ---- footer wordmark: kinetic width/weight driven by scroll progress
          through the contact section (like a train pulling away) ---- */
  var mark = document.getElementById('colophon-mark');
  var contact = document.getElementById('contact');
  if (mark && contact && 'requestAnimationFrame' in window) {
    var rafF = null;
    var update = function () {
      rafF = null;
      var r = contact.getBoundingClientRect();
      var vh = window.innerHeight || 800;
      /* progress 0 (section entering) -> 1 (section bottom reaching viewport top) */
      var prog = (vh - r.top) / (vh + r.height);
      prog = Math.min(1, Math.max(0, prog));
      var wdth = 70 + prog * 54;       /* 70 -> 124 */
      var wght = 560 + prog * 300;     /* 560 -> 860 */
      mark.style.fontVariationSettings = "'wght' " + wght.toFixed(0) + ", 'wdth' " + wdth.toFixed(1);
    };
    var onScroll = function () { if (!rafF) rafF = requestAnimationFrame(update); };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    update();
  }
})();

/* ===========================================================================
   DYNAMIC BACKGROUND ENGINE — parallax + cross-fade + breathing.
   One rAF loop, transform/opacity only. Reduced-motion = CSS static (no loop).
   =========================================================================== */
(function () {
  'use strict';
  var stage = document.getElementById('bgstage');
  if (!stage) return;
  var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function $(id) { return document.getElementById(id); }

  /* build SVG tick rulers once */
  (function rulers() {
    var top = $('bg-ruler-top'), left = $('bg-ruler-left');
    if (!top || !left) return;
    var i, x, y, big, s = '';
    for (i = 0; i <= 40; i++) { x = 22 + i * (956 / 40); big = (i % 5 === 0); s += '<line class="bg-tick" x1="' + x.toFixed(1) + '" y1="22" x2="' + x.toFixed(1) + '" y2="' + (big ? 38 : 30) + '"/>'; }
    top.innerHTML = s; s = '';
    for (i = 0; i <= 40; i++) { y = 22 + i * (956 / 40); big = (i % 5 === 0); s += '<line class="bg-tick" x1="22" y1="' + y.toFixed(1) + '" x2="' + (big ? 38 : 30) + '" y2="' + y.toFixed(1) + '"/>'; }
    left.innerHTML = s;
  })();

  var roScr = $('ro-scr'), roLat = $('ro-lat'), roLon = $('ro-lon'), roGate = $('ro-gate');
  if (REDUCED) { if (roScr) roScr.textContent = '000.0%'; return; }

  var generic = Array.prototype.filter.call(
    document.querySelectorAll('.layer[data-speed]'),
    function (el) { return el.id !== 'bg-portal' && el.id !== 'bg-ghost'; }
  ).map(function (el) { return { el: el, speed: parseFloat(el.getAttribute('data-speed')) || 0 }; });

  var bgArch = $('bg-arch'), bgInk = $('bg-ink'), bgStreak = $('bg-streak'),
      bgPortal = $('bg-portal'),
      bgFig = $('bg-fig'), bgVig = $('bg-vig'), bgScrim = $('bg-scrim'),
      bgMesh = $('bg-mesh'), bgGrid = $('bg-grid');
  var bgTexDoc = $('bg-tex-doc'), bgTexFig = $('bg-tex-fig'), bgTexWater = $('bg-tex-water');
  var ghostA = $('ghost-a'), ghostA2 = $('ghost-a2'), ghostB = $('ghost-b');
  var contact = $('contact');

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function ramp(p, a, b) { return clamp((p - a) / (b - a), 0, 1); }
  function band(p, a, b, c, d) { if (p <= a || p >= d) return 0; if (p < b) return ramp(p, a, b); if (p > c) return 1 - ramp(p, c, d); return 1; }

  var targetY = window.pageYOffset || 0, smoothY = targetY;
  var vh = window.innerHeight, docH = 1, running = false;
  function measure() { vh = window.innerHeight; docH = Math.max(1, document.documentElement.scrollHeight - vh); }

  function set(el, o) { if (el) el.style.opacity = o.toFixed(3); }

  function frame(now) {
    smoothY = lerp(smoothY, targetY, 0.12);
    var y = smoothY, prog = clamp(y / docH, 0, 1);
    var t = (now || 0) * 0.001;  /* seconds, for breathing */

    /* parallax — generic layers translate at their own speed */
    for (var i = 0; i < generic.length; i++) {
      generic[i].el.style.transform = 'translate3d(0,' + (-y * generic[i].speed).toFixed(2) + 'px,0)';
    }

    /* contact proximity (robust, rect-based) */
    var cIn = 0, cActive = false;
    if (contact) {
      var rt = contact.getBoundingClientRect().top;
      cIn = clamp((vh - rt) / (vh * 0.9), 0, 1);
      cActive = rt < vh * 0.5;
    }

    /* portal bloom — centered + scroll drift + slow breathing */
    if (bgPortal) {
      bgPortal.style.transform = 'translate3d(' + (Math.sin(t * 0.32) * 16).toFixed(2) + 'px,' + ((-y * 0.06) + Math.cos(t * 0.24) * 18).toFixed(2) + 'px,0)';
    }
    /* ghost words — STRONG animation: continuous sway + width-stretch breathing */
    var gx = Math.sin(t * 0.26) * 40;             /* continuous horizontal sway */
    var gsx = 1 + Math.sin(t * 0.42) * 0.07;      /* width breathing (cheap scaleX) */
    var gsx2 = 1 + Math.cos(t * 0.34) * 0.06;
    if (ghostA) ghostA.style.transform = 'translate(-50%,-50%) translate3d(' + (gx - y * 0.06).toFixed(2) + 'px,' + (y * 0.13).toFixed(2) + 'px,0) scaleX(' + gsx.toFixed(3) + ')';
    if (ghostA2) ghostA2.style.transform = 'translate(-50%,-50%) translate3d(' + (gx * 0.7 + 30 - y * 0.06).toFixed(2) + 'px,' + (y * 0.13 + 22).toFixed(2) + 'px,0) scaleX(' + gsx.toFixed(3) + ')';
    if (ghostB) ghostB.style.transform = 'translate(-50%,-50%) translate3d(' + (-gx * 1.1 + y * 0.09).toFixed(2) + 'px,' + (-y * 0.07 - 230).toFixed(2) + 'px,0) scaleX(' + gsx2.toFixed(3) + ')';

    /* cross-fades (prog 0..1 over the whole page) + breathing on atmospherics */
    var br = 0.92 + 0.08 * Math.sin(t * 0.5);
    /* IMAGES = subtle texture only (kept low) */
    set(bgArch, 0.05 + 0.10 * band(prog, -1, 0, 0.18, 0.46));
    set(bgInk, 0.10 * band(prog, 0, 0.03, 0.16, 0.34) * br);
    set(bgStreak, 0.16 * band(prog, 0.10, 0.26, 0.52, 0.80));
    set(bgFig, 0.30 * band(prog, 0.04, 0.16, 0.38, 0.62));
    /* faint ghost-image texture — her work surfacing and fully dissolving */
    set(bgTexDoc, 0.10 * band(prog, 0.02, 0.12, 0.26, 0.42) * br);
    set(bgTexFig, 0.09 * band(prog, 0.34, 0.46, 0.58, 0.74) * br);
    set(bgTexWater, 0.10 * band(prog, 0.50, 0.62, 0.78, 0.93) * br);
    set(bgPortal, 0.55 * cIn * br);
    set(bgVig, 0.5 + 0.4 * cIn);
    set(bgScrim, 1 - 0.72 * cIn);
    /* LINES = stronger; also gently pulse so they read as "alive" */
    if (bgMesh) set(bgMesh, 0.6 * (1 - 0.6 * cIn));
    if (bgGrid) set(bgGrid, (0.72 + 0.08 * Math.sin(t * 0.6)) * (1 - 0.25 * cIn));

    if (cActive) document.body.classList.add('contact-active');
    else document.body.classList.remove('contact-active');

    /* live readout */
    if (roScr) roScr.textContent = (prog * 100).toFixed(1).replace(/^(\d)\./, '00$1.').replace(/^(\d\d)\./, '0$1.');
    if (roLat) roLat.textContent = (37.7749 + (prog - 0.5) * 0.05).toFixed(4);
    if (roLon) roLon.textContent = (-122.4194 + (prog - 0.5) * 0.04).toFixed(4);
    if (roGate) roGate.textContent = String.fromCharCode(65 + Math.min(4, Math.floor(prog * 5)));

    requestAnimationFrame(frame);
  }

  function onScroll() { targetY = window.pageYOffset || document.documentElement.scrollTop || 0; }

  measure();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', function () { measure(); }, { passive: true });
  window.addEventListener('load', measure);
  requestAnimationFrame(frame);
})();
