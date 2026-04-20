/* animations.js — GSAP + ScrollTrigger initialisation */
document.addEventListener('DOMContentLoaded', () => {
  if (typeof gsap === 'undefined') return;
  gsap.registerPlugin(ScrollTrigger);

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) return;

  /* --- Navbar scroll border --- */
  const navbar = document.querySelector('.navbar');
  if (navbar) {
    window.addEventListener('scroll', () => {
      navbar.classList.toggle('scrolled', window.scrollY > 10);
    }, { passive: true });
  }

  /* --- Hero headline clip reveal --- */
  const heroH1 = document.querySelector('.hero h1');
  if (heroH1) {
    heroH1.style.clipPath = 'inset(100% 0 0 0)';
    gsap.to(heroH1, {
      clipPath: 'inset(0% 0 0 0)',
      duration: 0.85,
      ease: 'power3.out',
      delay: 0.15,
    });
  }

  /* --- Hero eyebrow + subtext fade --- */
  const heroEls = document.querySelectorAll('.hero__eyebrow, .hero .section-sub, .hero__actions');
  if (heroEls.length) {
    gsap.from(heroEls, {
      opacity: 0,
      y: 18,
      duration: 0.65,
      ease: 'power2.out',
      stagger: 0.1,
      delay: 0.4,
    });
  }

  /* --- Reveal Up --- */
  document.querySelectorAll('.reveal-up').forEach((el) => {
    gsap.to(el, {
      scrollTrigger: { trigger: el, start: 'top 88%', toggleActions: 'play none none none' },
      opacity: 1,
      y: 0,
      duration: 0.7,
      ease: 'power2.out',
      delay: parseFloat(el.dataset.delay || 0),
    });
  });

  /* --- Reveal Left --- */
  document.querySelectorAll('.reveal-left').forEach((el) => {
    gsap.to(el, {
      scrollTrigger: { trigger: el, start: 'top 88%', toggleActions: 'play none none none' },
      opacity: 1,
      x: 0,
      duration: 0.65,
      ease: 'power2.out',
    });
  });

  /* --- Reveal Right --- */
  document.querySelectorAll('.reveal-right').forEach((el) => {
    gsap.to(el, {
      scrollTrigger: { trigger: el, start: 'top 88%', toggleActions: 'play none none none' },
      opacity: 1,
      x: 0,
      duration: 0.65,
      ease: 'power2.out',
    });
  });

  /* --- Reveal Fade --- */
  document.querySelectorAll('.reveal-fade').forEach((el) => {
    gsap.to(el, {
      scrollTrigger: { trigger: el, start: 'top 90%', toggleActions: 'play none none none' },
      opacity: 1,
      duration: 0.6,
      ease: 'power1.out',
    });
  });

  /* --- Stagger children --- */
  document.querySelectorAll('.stagger-children').forEach((parent) => {
    gsap.to(parent.children, {
      scrollTrigger: { trigger: parent, start: 'top 85%', toggleActions: 'play none none none' },
      opacity: 1,
      y: 0,
      duration: 0.6,
      ease: 'power2.out',
      stagger: 0.1,
    });
  });

  /* --- Counter animation --- */
  document.querySelectorAll('.counter').forEach((el) => {
    const target   = parseFloat(el.dataset.target);
    const prefix   = el.dataset.prefix  || '';
    const suffix   = el.dataset.suffix  || '';
    const decimals = parseInt(el.dataset.decimals || 0);
    const obj = { val: 0 };

    gsap.to(obj, {
      scrollTrigger: { trigger: el, start: 'top 85%', toggleActions: 'play none none none' },
      val: target,
      duration: 1.8,
      ease: 'power2.out',
      onUpdate: () => { el.textContent = prefix + obj.val.toFixed(decimals) + suffix; },
      onComplete: () => { el.textContent = prefix + target.toFixed(decimals) + suffix; },
    });
  });

  /* --- Timeline scrub --- */
  document.querySelectorAll('.timeline__item').forEach((item, i) => {
    gsap.from(item, {
      scrollTrigger: { trigger: item, start: 'top 87%', toggleActions: 'play none none none' },
      opacity: 0,
      x: -20,
      duration: 0.55,
      ease: 'power2.out',
      delay: i * 0.04,
    });
  });

  /* --- Table rows reveal --- */
  document.querySelectorAll('.data-table tbody tr').forEach((row, i) => {
    gsap.from(row, {
      scrollTrigger: { trigger: row, start: 'top 90%', toggleActions: 'play none none none' },
      opacity: 0,
      x: -16,
      duration: 0.45,
      ease: 'power1.out',
      delay: i * 0.035,
    });
  });

  /* --- Terminal mock reveal --- */
  const terminal = document.querySelector('.terminal-mock');
  if (terminal) {
    gsap.from(terminal, {
      scrollTrigger: { trigger: terminal, start: 'top 85%', toggleActions: 'play none none none' },
      opacity: 0,
      y: 30,
      duration: 0.8,
      ease: 'power2.out',
      delay: 0.2,
    });
  }
});
