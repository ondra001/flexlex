// ── Nav scroll + reading progress bar ──
const nav = document.getElementById('nav');
const navProgress = document.getElementById('navProgress');
function onScroll() {
  const y = window.scrollY;
  nav.classList.toggle('nav--scrolled', y > 10);
  if (navProgress) {
    const h = document.documentElement.scrollHeight - window.innerHeight;
    const p = h > 0 ? Math.min(100, (y / h) * 100) : 0;
    navProgress.style.width = p + '%';
  }
}
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

// ── Active section highlighting in nav ──
const sections = ['features', 'modes', 'pricing', 'faq', 'download']
  .map(id => document.getElementById(id))
  .filter(Boolean);
const navLinks = document.querySelectorAll('.nav__links a[href^="#"]');
if (sections.length && navLinks.length) {
  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        navLinks.forEach(a => {
          const href = a.getAttribute('href');
          a.classList.toggle('active', href === '#' + id);
        });
      }
    });
  }, { rootMargin: '-40% 0px -55% 0px', threshold: 0 });
  sections.forEach(s => sectionObserver.observe(s));
}

// ── Mobile menu ──
const toggle = document.getElementById('navToggle');
const links = document.getElementById('navLinks');
toggle.addEventListener('click', () => {
  const isOpen = links.classList.toggle('open');
  toggle.classList.toggle('active', isOpen);
  toggle.setAttribute('aria-expanded', isOpen);
});
links.querySelectorAll('a').forEach(a => {
  a.addEventListener('click', () => {
    links.classList.remove('open');
    toggle.classList.remove('active');
    toggle.setAttribute('aria-expanded', 'false');
  });
});

// ── Flashcard flip demo ──
const demoCard = document.getElementById('demoCard');
if (demoCard) {
  let flipInterval = setInterval(() => {
    demoCard.classList.toggle('flipped');
  }, 3000);

  demoCard.addEventListener('click', () => {
    clearInterval(flipInterval);
    demoCard.classList.toggle('flipped');
    flipInterval = setInterval(() => {
      demoCard.classList.toggle('flipped');
    }, 3000);
  });
}

// ── Back to top button ──
const backToTop = document.getElementById('backToTop');
if (backToTop) {
  window.addEventListener('scroll', () => {
    backToTop.classList.toggle('visible', window.scrollY > 600);
  });
  backToTop.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

// ── Hero stat count-up animation ──
function animateCountUp(el, target, suffix = '') {
  const duration = 1200;
  const start = performance.now();
  const isNum = !isNaN(target);

  if (!isNum) {
    el.textContent = target;
    return;
  }

  function update(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    const current = Math.round(eased * target);
    el.textContent = current + suffix;
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

const heroStats = document.querySelectorAll('.hero__stat strong');
let statsAnimated = false;

const statsObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting && !statsAnimated) {
      statsAnimated = true;
      heroStats.forEach(stat => {
        const text = stat.textContent.trim();
        if (text === '8') {
          animateCountUp(stat, 8);
        } else if (text === '100%') {
          animateCountUp(stat, 100, '%');
        }
        // "Free" stays as-is
      });
      statsObserver.disconnect();
    }
  });
}, { threshold: 0.5 });

if (heroStats.length) {
  statsObserver.observe(heroStats[0].closest('.hero__stats'));
}

// ── Scroll reveal animations ──
const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
);

document.querySelectorAll(
  '.bento__item, .mode-mini, .modes__featured, .timeline__step, .why__row, .pricing-card, .faq__item, .feedback__form, .store-badge, .hero__stat'
).forEach(el => {
  el.classList.add('reveal');
  revealObserver.observe(el);
});

// Stagger children in grids/rails
document.querySelectorAll('.bento, .modes__rail, .pricing__grid, .faq__list, .hero__stats').forEach(grid => {
  [...grid.children].forEach((child, i) => {
    if (child.classList.contains('reveal')) {
      child.style.transitionDelay = `${i * 0.07}s`;
    }
  });
});

// ── Mouse glow tracking on cards ──
document.querySelectorAll('.bento__item, .mode-mini, .timeline__card, .pricing-card, .faq__item').forEach(card => {
  card.classList.add('hover-glow');
  card.addEventListener('mousemove', (e) => {
    const rect = card.getBoundingClientRect();
    card.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
    card.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
  });
});

// ── Timeline: scroll-driven rail fill + active node ──
const timelineFill = document.getElementById('timelineFill');
const timelineSteps = document.querySelectorAll('.timeline__step');
if (timelineFill && timelineSteps.length) {
  const timeline = timelineFill.closest('.timeline');
  const updateTimeline = () => {
    const rect = timeline.getBoundingClientRect();
    const vh = window.innerHeight;
    // Progress: 0 when timeline top hits viewport middle, 1 when bottom hits middle
    const mid = vh * 0.5;
    const progress = Math.max(0, Math.min(1, (mid - rect.top) / rect.height));
    timelineFill.style.height = `${progress * 100}%`;

    timelineSteps.forEach(step => {
      const sRect = step.getBoundingClientRect();
      const sMid = sRect.top + sRect.height / 2;
      step.classList.toggle('active', sMid < mid + 40);
    });
  };
  updateTimeline();
  window.addEventListener('scroll', updateTimeline, { passive: true });
  window.addEventListener('resize', updateTimeline);
}

// ── Modes rail: arrow controls ──
const modesRail = document.getElementById('modesRail');
if (modesRail) {
  document.querySelectorAll('.modes__rail-arrow').forEach(btn => {
    btn.addEventListener('click', () => {
      const dir = parseInt(btn.dataset.dir, 10) || 1;
      const firstCard = modesRail.querySelector('.mode-mini');
      const step = firstCard ? firstCard.offsetWidth + 14 : 280;
      modesRail.scrollBy({ left: dir * step * 2, behavior: 'smooth' });
    });
  });
}

// ── Inject reveal animation styles ──
const style = document.createElement('style');
style.textContent = `
  .reveal {
    opacity: 0;
    transform: translateY(24px);
    transition: opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1),
                transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .revealed {
    opacity: 1 !important;
    transform: translateY(0) !important;
  }
`;
document.head.appendChild(style);

// ── Check reduced-motion preference ──
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ── Hero mouse spotlight ──
const hero = document.querySelector('.hero');
const heroSpotlight = document.getElementById('heroSpotlight');
if (hero && heroSpotlight && !reduceMotion) {
  hero.addEventListener('mousemove', (e) => {
    const rect = hero.getBoundingClientRect();
    heroSpotlight.style.setProperty('--spot-x', (e.clientX - rect.left) + 'px');
    heroSpotlight.style.setProperty('--spot-y', (e.clientY - rect.top) + 'px');
  });
}

// ── Phone 3D tilt ──
const heroVisual = document.getElementById('heroVisual');
const phoneMockup = document.getElementById('phoneMockup');
if (heroVisual && phoneMockup && !reduceMotion) {
  let idleFloat = true;
  heroVisual.addEventListener('mousemove', (e) => {
    const rect = heroVisual.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    phoneMockup.classList.add('phone-mockup--tilt');
    phoneMockup.style.transform = `rotateY(${x * 12}deg) rotateX(${-y * 12}deg) translateZ(0)`;
    idleFloat = false;
  });
  heroVisual.addEventListener('mouseleave', () => {
    phoneMockup.classList.remove('phone-mockup--tilt');
    phoneMockup.style.transform = '';
    idleFloat = true;
  });
}

// ── Multilingual demo cycling ──
const demoWordEl = document.getElementById('demoWord');
const demoTranslationEl = document.getElementById('demoTranslation');
const demoSetNameEl = document.getElementById('demoSetName');
const demoCardEl = document.getElementById('demoCard');
if (demoWordEl && demoTranslationEl && demoSetNameEl) {
  const pairs = [
    { word: 'Schmetterling', translation: 'Butterfly', set: 'German Basics' },
    { word: 'Mariposa', translation: 'Butterfly', set: 'Spanish Nature' },
    { word: 'Papillon', translation: 'Butterfly', set: 'French Nature' },
    { word: '蝶', translation: 'Butterfly', set: 'Japanese Kanji' },
    { word: 'Farfalla', translation: 'Butterfly', set: 'Italian Basics' }
  ];
  let i = 0;
  function swap() {
    i = (i + 1) % pairs.length;
    const p = pairs[i];
    [demoWordEl, demoTranslationEl].forEach(el => el.classList.add('swap'));
    setTimeout(() => {
      demoWordEl.textContent = p.word;
      demoTranslationEl.textContent = p.translation;
      demoSetNameEl.textContent = p.set;
      [demoWordEl, demoTranslationEl].forEach(el => el.classList.remove('swap'));
    }, 400);
  }
  // Swap word every other flip (keep the flip animation from original script)
  let flipCount = 0;
  const origObserver = new MutationObserver((mutations) => {
    mutations.forEach(m => {
      if (m.type === 'attributes' && m.attributeName === 'class' && demoCardEl.classList.contains('flipped')) {
        flipCount++;
        if (flipCount % 2 === 0) setTimeout(swap, 300);
      }
    });
  });
  if (demoCardEl) origObserver.observe(demoCardEl, { attributes: true });
}

// ── Magnetic buttons ──
if (!reduceMotion) {
  document.querySelectorAll('.btn--primary, .btn--lg, .pricing-card__btn').forEach(btn => {
    btn.addEventListener('mousemove', (e) => {
      const rect = btn.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      btn.style.transform = `translate(${x * 0.15}px, ${y * 0.25}px)`;
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = '';
    });
  });
}

// ── SRS bars cascade on reveal ──
const srsVisual = document.querySelector('.bento__visual--srs');
if (srsVisual) {
  const srsObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        srsVisual.classList.add('animate');
        srsObserver.unobserve(srsVisual);
      }
    });
  }, { threshold: 0.4 });
  srsObserver.observe(srsVisual);
}

// ── Subtle 3D tilt on bento + timeline cards ──
if (!reduceMotion) {
  document.querySelectorAll('.bento__item, .timeline__card, .pricing-card, .mode-mini').forEach(card => {
    card.style.transformStyle = 'preserve-3d';
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      card.style.transform = `perspective(1000px) rotateY(${x * 4}deg) rotateX(${-y * 4}deg) translateY(-4px)`;
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
    });
  });
}
