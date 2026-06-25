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
