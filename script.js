/* FlexLex — landing page behaviour.
 *
 * Deliberately small. The previous version drove a mouse spotlight, magnetic
 * buttons, 3D card tilt and glow tracking; all of that is gone along with the
 * design it belonged to. Theme switching lives in theme.js.
 */

// ── Mobile menu ──
(function () {
  var toggle = document.getElementById('navToggle');
  var links = document.getElementById('navLinks');
  if (!toggle || !links) return;

  toggle.addEventListener('click', function () {
    var open = links.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  // Any navigation closes the sheet — including the theme button.
  links.querySelectorAll('a, button').forEach(function (el) {
    el.addEventListener('click', function () {
      links.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  });
})();

// ── Active section in the nav ──
(function () {
  var ids = ['modes', 'story', 'features', 'pricing'];
  var sections = ids.map(function (id) { return document.getElementById(id); }).filter(Boolean);
  var links = document.querySelectorAll('.nav__links a[href^="#"]');
  if (!sections.length || !links.length) return;

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      links.forEach(function (a) {
        a.classList.toggle('active', a.getAttribute('href') === '#' + entry.target.id);
      });
    });
  }, { rootMargin: '-40% 0px -55% 0px', threshold: 0 });

  sections.forEach(function (s) { observer.observe(s); });
})();

// ── Back to top ──
(function () {
  var btn = document.getElementById('backToTop');
  if (!btn) return;
  window.addEventListener('scroll', function () {
    btn.classList.toggle('visible', window.scrollY > 600);
  }, { passive: true });
  btn.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
})();

// ── Story: tap a word to translate ──
// Mirrors what Story mode does on the phone, where the translation is produced
// on-device by ML Kit. Here the pairs are baked into data-t.
(function () {
  var tip = document.getElementById('tip');
  if (!tip) return;
  var open = null;

  function hide() {
    tip.classList.remove('show');
    if (open) { open.classList.remove('on'); open = null; }
  }

  document.querySelectorAll('.story__text .w').forEach(function (w) {
    w.setAttribute('tabindex', '0');
    w.setAttribute('role', 'button');

    function show(e) {
      e.stopPropagation();
      if (open === w) { hide(); return; }
      hide();
      w.classList.add('on');
      open = w;
      var r = w.getBoundingClientRect();
      tip.innerHTML = '<s>ON DEVICE</s>' + w.dataset.t;
      tip.style.left = (r.left + r.width / 2) + 'px';
      tip.style.top = r.top + 'px';
      tip.classList.add('show');
    }

    w.addEventListener('click', show);
    w.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); show(e); }
    });
  });

  document.addEventListener('click', hide);
  window.addEventListener('scroll', hide, { passive: true });
  window.addEventListener('resize', hide);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') hide(); });
})();
