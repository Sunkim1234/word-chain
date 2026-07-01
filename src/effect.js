// src/effect.js
const reduceMotion = matchMedia('(prefers-reduced-motion:reduce)').matches;

export function clearSparks(target) {
  target.querySelectorAll('.spark').forEach(s => s.remove());
}

export function spawnSparks(target, n, opts = {}) {
  if (reduceMotion) return;
  for (let i = 0; i < n; i++) {
    const s = document.createElement('span');
    s.className = 'spark' + (i % 2 ? ' orange' : '') + (opts.loop ? ' loop' : '');
    s.textContent = '✦';
    s.style.left = (8 + Math.random() * 84) + '%';
    s.style.top = (8 + Math.random() * 84) + '%';
    s.style.animationDelay = (Math.random() * (opts.loop ? 1.2 : 0.25)).toFixed(2) + 's';
    if (opts.big) s.style.fontSize = '7.5cqmin';
    target.appendChild(s);
    if (!opts.loop) setTimeout(() => s.remove(), 900);
  }
}

export function chainPulse(el) {
  if (!el || reduceMotion) return;
  el.classList.remove('chainpop', 'intro');
  void el.offsetWidth;
  el.classList.add('chainpop');
}
