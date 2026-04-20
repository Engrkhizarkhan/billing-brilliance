/* copy-code.js — Copy-to-clipboard for code blocks */
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.code-block__copy').forEach((btn) => {
    btn.addEventListener('click', () => {
      const block = btn.closest('.code-block');
      const pre   = block && block.querySelector('pre');
      if (!pre) return;

      navigator.clipboard.writeText(pre.textContent.trim()).then(() => {
        const orig = btn.textContent;
        btn.textContent = 'COPIED';
        btn.style.borderColor = 'var(--green)';
        btn.style.color       = 'var(--green)';
        setTimeout(() => {
          btn.textContent       = orig;
          btn.style.borderColor = '';
          btn.style.color       = '';
        }, 2000);
      }).catch(() => {
        /* Fallback: select text */
        const range = document.createRange();
        range.selectNodeContents(pre);
        window.getSelection().removeAllRanges();
        window.getSelection().addRange(range);
      });
    });
  });
});
