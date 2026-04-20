/* theme.js — Light/Dark mode toggle with localStorage persistence */
(function () {
  var html = document.documentElement;
  var saved = localStorage.getItem('pn-theme');
  // Apply saved preference immediately (before paint) to avoid flash
  html.setAttribute('data-theme', saved === 'light' ? 'light' : 'dark');

  function init() {
    var btn = document.getElementById('theme-toggle');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var current = html.getAttribute('data-theme');
      var next = current === 'light' ? 'dark' : 'light';
      html.setAttribute('data-theme', next);
      localStorage.setItem('pn-theme', next);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
