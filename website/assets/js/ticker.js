/* ticker.js — Duplicate ticker content for seamless infinite scroll */
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.ticker__track').forEach((track) => {
    track.innerHTML = track.innerHTML + track.innerHTML;
  });
});
