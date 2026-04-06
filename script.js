// ── Nav scroll effect ──
const nav = document.getElementById('nav');
window.addEventListener('scroll', () => {
  nav.classList.toggle('nav--scrolled', window.scrollY > 10);
});

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
  '.bento__item, .mode-card, .step, .why__card, .pricing-card, .faq__item, .feedback__form, .store-badge, .hero__stat'
).forEach(el => {
  el.classList.add('reveal');
  revealObserver.observe(el);
});

// Stagger children in grids
document.querySelectorAll('.bento, .modes__grid, .steps, .why__grid, .pricing__grid, .faq__list, .hero__stats').forEach(grid => {
  [...grid.children].forEach((child, i) => {
    if (child.classList.contains('reveal') || child.classList.contains('step__connector')) {
      child.style.transitionDelay = `${i * 0.07}s`;
    }
  });
});

// ── Mouse glow tracking on all cards ──
document.querySelectorAll('.bento__item, .mode-card, .why__card, .pricing-card, .faq__item').forEach(card => {
  card.classList.add('hover-glow');
  card.addEventListener('mousemove', (e) => {
    const rect = card.getBoundingClientRect();
    card.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
    card.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
  });
});

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
  .step__connector {
    opacity: 0;
    transition: opacity 0.4s 0.2s;
  }
  .step.revealed ~ .step__connector,
  .step__connector:has(+ .step.revealed) {
    opacity: 1;
  }
`;
document.head.appendChild(style);
