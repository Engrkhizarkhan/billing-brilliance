/* docs-search.js — In-page search and active-link highlighting for docs */
document.addEventListener('DOMContentLoaded', () => {
  const input    = document.querySelector('.docs-search-input');
  const links    = document.querySelectorAll('.docs-nav__link');
  const sections = document.querySelectorAll('.docs-section');

  /* Search filtering */
  if (input) {
    input.addEventListener('input', () => {
      const q = input.value.trim().toLowerCase();
      links.forEach((link) => {
        const match = !q || link.textContent.toLowerCase().includes(q);
        link.style.display = match ? '' : 'none';
      });
      sections.forEach((section) => {
        const match = !q || section.textContent.toLowerCase().includes(q);
        section.style.display = match ? '' : 'none';
      });
    });
  }

  /* Active link on scroll */
  if (sections.length && links.length) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.id;
            links.forEach((link) => {
              link.classList.toggle('active', link.getAttribute('href') === '#' + id);
            });
          }
        });
      },
      { rootMargin: '-15% 0px -70% 0px' }
    );
    sections.forEach((s) => observer.observe(s));
  }
});
