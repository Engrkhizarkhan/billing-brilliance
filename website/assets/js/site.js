/* Shared navigation and an email enquiry composer. No contact data is stored. */
(() => {
  const toggle = document.querySelector('.menu-toggle');
  const menu = document.querySelector('#main-menu');
  const closeMenu = () => {
    menu?.classList.remove('is-open');
    toggle?.setAttribute('aria-expanded', 'false');
    toggle?.setAttribute('aria-label', 'Open navigation');
  };
  toggle?.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    menu.classList.toggle('is-open', open);
  });
  menu?.addEventListener('click', (event) => {
    if (event.target.closest('a')) closeMenu();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && toggle?.getAttribute('aria-expanded') === 'true') {
      closeMenu();
      toggle.focus();
    }
  });
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.navbar')) closeMenu();
  });
  window.matchMedia('(min-width: 961px)').addEventListener('change', closeMenu);

  // Existing detail-page accordions use checkboxes. Make their labels keyboard operable.
  document.querySelectorAll('.accordion__label, .accordion__header').forEach((label) => {
    const input = document.getElementById(label.htmlFor);
    if (!input) return;
    label.tabIndex = 0;
    label.setAttribute('role', 'button');
    label.setAttribute('aria-expanded', String(input.checked));
    input.addEventListener('change', () => label.setAttribute('aria-expanded', String(input.checked)));
    label.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        input.checked = !input.checked;
        input.dispatchEvent(new Event('change'));
      }
    });
  });

  const form = document.getElementById('enquiry-form');
  if (!form) return;
  const result = document.getElementById('enquiry-result');
  const preview = document.getElementById('enquiry-preview');
  const status = document.getElementById('enquiry-status');
  form.addEventListener('input', () => { result.hidden = true; });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const institution = String(data.get('institution')).trim();
    const subject = `FinTap walkthrough: ${institution}`;
    const body = `Hello FinTap team,\n\nI’d like to learn more about FinTap for our institution.\n\nName: ${String(data.get('name')).trim()}\nEmail: ${String(data.get('email')).trim()}\nInstitution: ${institution}\nType: ${data.get('type')}\n\nWhat we’d like to discuss:\n${String(data.get('message')).trim() || 'A walkthrough of the platform and a discussion of our payment requirements.'}\n\nThank you.`;
    document.getElementById('enquiry-mailto').href = `mailto:hello@fintap.pk?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    preview.value = `To: hello@fintap.pk\nSubject: ${subject}\n\n${body}`;
    status.textContent = 'Your enquiry is ready. Open it in your email app, or copy it into your preferred email service.';
    result.hidden = false;
    preview.focus({ preventScroll: true });
    result.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'nearest' });
  });
  document.getElementById('copy-enquiry').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(preview.value);
      status.textContent = 'Enquiry copied. Paste it into an email to hello@fintap.pk and send when you’re ready.';
    } catch {
      preview.focus();
      preview.select();
      status.textContent = 'Select and copy the prepared enquiry below, then paste it into your email service.';
    }
  });
})();
