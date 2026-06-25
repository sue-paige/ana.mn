/* ana.mn — liquid memory runtime. Vanilla, no deps. All motion guarded. */
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

/* ===========================================================================
   INTRO DRAIN + HALFTONE HAUNT
   Dispersal cover drains into liquid droplets -> persistent foreground halftone.
   Session-gated (plays once per visit). Reduced-motion = no drain, faint haunt.
   =========================================================================== */
(function () {
  'use strict';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  var haunt = document.getElementById('haunt');
  if (!haunt) return;
  var HAUNT_HOLD = 0.07;

  /* haunt drift — continuous, transform only */
  var sy = window.pageYOffset || 0, ticking = false, dt0 = performance.now();
  function applyDrift() {
    ticking = false;
    var t = (performance.now() - dt0) / 1000;
    var py = sy * -0.06, bx = Math.sin(t * 0.32) * 7, by = Math.cos(t * 0.24) * 9, sc = 1 + Math.sin(t * 0.18) * 0.012;
    haunt.style.transform = 'translate3d(' + bx.toFixed(2) + 'px,' + (py + by).toFixed(2) + 'px,0) scale(' + sc.toFixed(4) + ')';
  }
  if (!reduce) {
    window.addEventListener('scroll', function () {
      sy = window.pageYOffset || document.documentElement.scrollTop || 0;
      if (!ticking) { ticking = true; requestAnimationFrame(applyDrift); }
    }, { passive: true });
    (function breathe() { applyDrift(); requestAnimationFrame(breathe); })();
  }

  var intro = document.getElementById('intro');
  if (reduce || !intro) {
    if (intro && intro.parentNode) intro.parentNode.removeChild(intro);
    haunt.style.opacity = reduce ? '0.05' : String(HAUNT_HOLD);
    return;
  }

  /* ---- DIRECTION A: rain-rivulet drain ---- */
  document.documentElement.classList.add('intro-lock');     // lock scroll during the drain
  var warp = document.getElementById('introWarp');
  var liquid = document.getElementById('introLiquid');
  var sheen = document.getElementById('introSheen');
  var gooTurb = document.getElementById('gooTurb');
  var gooDisp = document.getElementById('gooDisp');
  var gooBlur = document.getElementById('gooBlur');

  var DURATION = 3000, HOLD_FRAC = 0.16, start = null, rafId = 0, finished = false;
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function easeInOutCubic(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
  function easeInCubic(t) { return t * t * t; }

  function render(t) {
    var front = easeInOutCubic(t) * 128;                    // erase front recedes top->bottom
    if (liquid) liquid.style.setProperty('--front', front.toFixed(2));
    if (sheen) sheen.style.setProperty('--front', front.toFixed(2));
    var ripple = Math.sin(Math.PI * Math.min(1, t * 1.04)); // 0..1..0 tearing swell
    var gscale = 16 + easeOutCubic(t) * 30 + ripple * 70;
    if (gooDisp) gooDisp.setAttribute('scale', (gscale < 0 ? 0 : gscale).toFixed(1));
    if (gooBlur) gooBlur.setAttribute('stdDeviation', (0.5 + easeOutCubic(t) * 1.8 + ripple * 0.9).toFixed(2));
    if (gooTurb) gooTurb.setAttribute('baseFrequency', (0.009 + t * 0.012).toFixed(4) + ' ' + (0.006 + t * 0.020).toFixed(4));
    var fade = t < 0.55 ? 1 : 1 - easeInCubic((t - 0.55) / 0.45);   // whole cover eases out late
    if (warp) warp.style.opacity = fade.toFixed(3);
    if (sheen) sheen.style.opacity = (0.8 * fade).toFixed(3);
    var hp = t < 0.26 ? 0 : easeOutCubic((t - 0.26) / 0.74);        // halftone bloom handoff
    haunt.style.opacity = (hp * HAUNT_HOLD * 2.7).toFixed(4);
  }

  function frame(ts) {
    if (start === null) start = ts;
    var raw = clamp01((ts - start) / DURATION);
    var t = clamp01((raw - HOLD_FRAC) / (1 - HOLD_FRAC));   // hold cover, then bleed
    render(t);
    if (t < 1) rafId = requestAnimationFrame(frame);
    else finish();
  }

  function finish() {
    if (finished) return; finished = true;
    cancelAnimationFrame(rafId);
    document.documentElement.classList.remove('intro-lock');       // release scroll
    if (warp) { warp.style.opacity = '0'; warp.style.filter = 'none'; }  // kill the goo filter
    intro.style.display = 'none';
    if (intro.parentNode) intro.parentNode.removeChild(intro);
    haunt.style.transition = 'opacity 1100ms cubic-bezier(.2,.7,.2,1)';
    haunt.style.opacity = String(HAUNT_HOLD);                       // settle the bloom to resting
  }

  function begin() { rafId = requestAnimationFrame(frame); }
  if (document.readyState === 'complete') requestAnimationFrame(begin);
  else {
    window.addEventListener('load', function () { requestAnimationFrame(begin); }, { once: true });
    setTimeout(function () { if (start === null) begin(); }, 700);
  }
})();

/* ===========================================================================
   TAP TO LIQUIFY — tapping an image ripples it (turbulence wobble), then settles.
   One shared filter, one image at a time; filter removed at rest (zero idle cost).
   =========================================================================== */
(function () {
  'use strict';
  var disp = document.getElementById('tapDisp');
  var turb = document.getElementById('tapTurb');
  if (!disp || !turb) return;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  if (reduce) return;

  var DUR = 920, current = null, raf = null, start = 0, seed = 1;

  function pulse(ts) {
    var t = (ts - start) / DUR;
    if (t >= 1) { stop(); return; }
    var env = Math.sin(Math.PI * t);            // 0 -> 1 -> 0 over the pulse
    var e = env * env * (3 - 2 * env);          // smootherstep on the swell
    disp.setAttribute('scale', (e * 34).toFixed(2));
    turb.setAttribute('baseFrequency', (0.009 + e * 0.010).toFixed(4) + ' ' + (0.011 + e * 0.013).toFixed(4));
    raf = requestAnimationFrame(pulse);
  }
  function clear(img) { if (img) { img.style.filter = ''; img.style.willChange = ''; } }
  function stop() { disp.setAttribute('scale', '0'); clear(current); current = null; if (raf) { cancelAnimationFrame(raf); raf = null; } }
  function trigger(img) {
    if (current && current !== img) clear(current);
    current = img;
    turb.setAttribute('seed', String((seed++ % 90) + 1));
    img.style.filter = 'url(#tapLiquid)';
    img.style.willChange = 'filter';
    start = performance.now();
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(pulse);
  }

  var containers = document.querySelectorAll('figure.cell, .hero__strip, .portal');
  Array.prototype.forEach.call(containers, function (c) {
    var img = c.querySelector('img');
    if (!img) return;
    c.style.cursor = 'pointer';
    c.addEventListener('click', function () { trigger(img); });
  });
})();

/* ===========================================================================
   WATER DROPLETS — hyperreal liquid-glass beads. SVG lens refracts the page,
   her image reflects on the skin; tap splats them (image blooms clear). Pointer
   parallax + gyroscope. Layer is pointer-events:none + hit-test so the page
   stays clickable. Reduced-motion = static droplets.
   =========================================================================== */
(function () {
  'use strict';
  var layer = document.getElementById('droplets');
  if (!layer) return;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;

  /* build the sphere displacement map (R = x-shift, G = y-shift) for #lensMap */
  (function buildNormalMap() {
    var N = 128, c = N / 2, cv = document.createElement('canvas');
    cv.width = cv.height = N;
    var ctx = cv.getContext('2d'); if (!ctx) return;
    var img = ctx.createImageData(N, N), data = img.data, maxShift = 100;
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) {
      var dx = x - c + 0.5, dy = y - c + 0.5, r = Math.sqrt(dx * dx + dy * dy) / c, amp;
      if (r >= 1) amp = 0; else { var bow = Math.pow(r, 1.7), edge = r > 0.88 ? (1 - (r - 0.88) / 0.12) : 1; amp = bow * edge; }
      var ux = r > 0 ? dx / (r * c) : 0, uy = r > 0 ? dy / (r * c) : 0, i = (y * N + x) * 4;
      data[i] = Math.max(0, Math.min(255, Math.round(128 + ux * amp * maxShift)));
      data[i + 1] = Math.max(0, Math.min(255, Math.round(128 + uy * amp * maxShift)));
      data[i + 2] = 128; data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    var url = cv.toDataURL('image/png'), fe = document.getElementById('lensMap');
    if (fe) { fe.setAttributeNS('http://www.w3.org/1999/xlink', 'href', url); fe.setAttribute('href', url); }
  })();

  var REFL = ['url(/assets/img/submerge.webp)', 'url(/assets/img/greenneon.webp)', 'url(/assets/img/inkwater.webp)'];
  var SPEC = [
    { x: 16, y: 24, d: 96, r: 0 },
    { x: 74, y: 18, d: 74, r: 1 },
    { x: 33, y: 48, d: 118, r: 2 },
    { x: 85, y: 44, d: 66, r: 0 },
    { x: 23, y: 72, d: 100, r: 1 },
    { x: 65, y: 80, d: 84, r: 2 }
  ];
  if (window.innerWidth < 620) SPEC = [SPEC[0], SPEC[2], SPEC[4], SPEC[5]];  // lighter on phones

  var drops = [];
  SPEC.forEach(function (s) {
    var el = document.createElement('div');
    el.className = 'drop';
    el.style.left = s.x + 'vw'; el.style.top = s.y + 'vh';
    el.style.setProperty('--d', s.d + 'px');
    el.style.setProperty('--refl', REFL[s.r % REFL.length]);
    el.innerHTML = '<span class="lens"></span><span class="reflect"></span><span class="body-g"></span><span class="rim"></span><span class="spec"></span><span class="ripple"></span>';
    el._w = 0.4 + (s.d / 130);
    el.addEventListener('animationend', function () { el.classList.remove('splat'); });
    drops.push(el); layer.appendChild(el);
  });

  /* tap = splat (hit-test; the page underneath stays fully clickable) */
  window.addEventListener('pointerdown', function (e) {
    if (reduce) return;
    var cx = e.clientX, cy = e.clientY;
    for (var i = 0; i < drops.length; i++) {
      var r = drops[i].getBoundingClientRect();
      var mx = r.left + r.width / 2, my = r.top + r.height / 2, rad = r.width / 2 + 6;
      if ((cx - mx) * (cx - mx) + (cy - my) * (cy - my) <= rad * rad) {
        drops[i].classList.remove('splat'); void drops[i].offsetWidth; drops[i].classList.add('splat');
      }
    }
  }, { passive: true });

  if (reduce) return;  // static droplets, no parallax/gyro

  /* motion: one coalescing rAF eases drift + highlight toward targets */
  var tgtMX = 0, tgtMY = 0, tgtHL = 0, tgtHV = 0, curMX = 0, curMY = 0, curHL = 0, curHV = 0, raf = 0, idle = true;
  function frame() {
    raf = 0;
    curMX += (tgtMX - curMX) * 0.12; curMY += (tgtMY - curMY) * 0.12;
    curHL += (tgtHL - curHL) * 0.12; curHV += (tgtHV - curHV) * 0.12;
    for (var i = 0; i < drops.length; i++) {
      var el = drops[i], w = el._w;
      el.style.setProperty('--mx', (curMX * w).toFixed(2) + 'px');
      el.style.setProperty('--my', (curMY * w).toFixed(2) + 'px');
      el.style.setProperty('--hlx', curHL.toFixed(2) + 'px');
      el.style.setProperty('--hly', curHV.toFixed(2) + 'px');
    }
    var settled = Math.abs(tgtMX - curMX) < 0.05 && Math.abs(tgtMY - curMY) < 0.05 && Math.abs(tgtHL - curHL) < 0.05 && Math.abs(tgtHV - curHV) < 0.05;
    if (!settled) schedule(); else idle = true;
  }
  function schedule() { idle = false; if (!raf) raf = requestAnimationFrame(frame); }

  var hasGyro = false;
  window.addEventListener('pointermove', function (e) {
    if (hasGyro) return;
    var nx = e.clientX / window.innerWidth - 0.5, ny = e.clientY / window.innerHeight - 0.5;
    tgtMX = nx * 10; tgtMY = ny * 10; tgtHL = -nx * 7; tgtHV = -ny * 7; schedule();
  }, { passive: true });

  function onTilt(e) {
    if (e.gamma == null && e.beta == null) return;
    hasGyro = true;
    var g = Math.max(-30, Math.min(30, e.gamma || 0)), b = Math.max(-30, Math.min(30, (e.beta || 0) - 45));
    tgtMX = (g / 30) * 8; tgtMY = (b / 30) * 8; tgtHL = -(g / 30) * 8; tgtHV = -(b / 30) * 8; schedule();
  }
  function enableGyro() {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      DeviceOrientationEvent.requestPermission().then(function (st) { if (st === 'granted') window.addEventListener('deviceorientation', onTilt, { passive: true }); }).catch(function () {});
    } else if ('ondeviceorientation' in window) {
      window.addEventListener('deviceorientation', onTilt, { passive: true });
    }
  }
  enableGyro();
  window.addEventListener('touchstart', enableGyro, { once: true, passive: true });

  var lastY = window.scrollY, sticky = 0;
  window.addEventListener('scroll', function () {
    if (sticky) return;
    sticky = requestAnimationFrame(function () {
      sticky = 0; var dy = window.scrollY - lastY; lastY = window.scrollY;
      tgtHV = Math.max(-9, Math.min(9, -dy * 0.25)); schedule();
    });
  }, { passive: true });

  var bt = 0;
  setInterval(function () {
    if (hasGyro) return;
    bt += 0.5;
    if (idle) { tgtHL = Math.sin(bt) * 1.4; tgtHV = Math.cos(bt * 0.8) * 1.0; schedule(); }
  }, 1600);
})();
