// src/drag.js
const DRAG_THRESH = 8;
const reduceMotion = matchMedia('(prefers-reduced-motion:reduce)').matches;

function rectsOverlap(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}
function isOverDrop(card, drop) {
  return rectsOverlap(card.getBoundingClientRect(), drop.getBoundingClientRect());
}
function armDrop(drop, word, d) {
  if (drop.classList.contains('armed')) return;
  drop.classList.add('armed');
  const src = d.imgSrc(word);
  drop.innerHTML = (src ? '<img class="opt__pic drop__ghost" draggable="false" src="' + src + '" alt="' + word + '">' : '') +
                   '<span class="opt__word drop__ghost">' + word + '</span>';
  d.spawnSparks(drop, 6);
  d.spawnSparks(drop, 3, { loop: true });
}
function disarmDrop(drop) {
  if (!drop.classList.contains('armed')) return;
  drop.classList.remove('armed');
  drop.innerHTML = '<span class="drop__q">?</span>';
}
function springBack(card) {
  card.classList.remove('holding');
  card.parentNode.querySelectorAll('.opt.dimmed').forEach(o => o.classList.remove('dimmed'));
  if (reduceMotion) { card.style.transform = ''; return; }
  card.classList.add('springback');
  card.style.transform = '';
  card.addEventListener('transitionend', function h() {
    card.classList.remove('springback'); card.style.transition = '';
    card.removeEventListener('transitionend', h);
  });
}
function snapCommit(card, word, curDx, curDy, drop, d) {
  d.lock();
  if (reduceMotion) { card.style.visibility = 'hidden'; d.onCommit(word); return; }
  const dr = drop.getBoundingClientRect();
  const c = card.getBoundingClientRect();
  const newDx = curDx + (dr.left + dr.width / 2) - (c.left + c.width / 2);
  const newDy = curDy + (dr.top + dr.height / 2) - (c.top + c.height / 2);
  const scale = dr.width / card.offsetWidth;
  card.style.transition = 'transform .26s cubic-bezier(.34,1.2,.5,1)';
  requestAnimationFrame(() => {
    card.style.transform = 'translate(' + newDx + 'px,' + newDy + 'px) scale(' + scale + ')';
  });
  setTimeout(() => { card.style.visibility = 'hidden'; d.onCommit(word); }, 270);
}

export function attachCard(card, word, d) {
  const drop = d.getDrop();
  let pid = null, sx = 0, sy = 0, dx = 0, dy = 0, dragging = false;
  card.addEventListener('pointerdown', e => {
    if (!d.isPlaying()) return;
    pid = e.pointerId; sx = e.clientX; sy = e.clientY; dx = dy = 0; dragging = false;
    card.setPointerCapture(pid);
    if (!reduceMotion) {
      card.style.transition = 'transform .14s ease, box-shadow .14s ease';
      card.style.transform = 'translateY(-2.4cqmin)';
      card.classList.add('holding');
    }
    d.speak(word);
  });
  card.addEventListener('pointermove', e => {
    if (pid === null) return;
    dx = e.clientX - sx; dy = e.clientY - sy;
    if (!dragging && Math.hypot(dx, dy) > DRAG_THRESH) {
      dragging = true;
      card.classList.remove('holding');
      card.style.transition = '';
      card.classList.add('dragging');
      card.parentNode.querySelectorAll('.opt').forEach(o => { if (o !== card) o.classList.add('dimmed'); });
    }
    if (dragging) {
      card.style.transform = reduceMotion
        ? 'translate(' + dx + 'px,' + dy + 'px)'
        : 'translate(' + dx + 'px, calc(-2.4cqmin + ' + dy + 'px))';
      if (isOverDrop(card, drop)) armDrop(drop, word, d); else disarmDrop(drop);
    }
  });
  card.addEventListener('pointerup', e => {
    if (pid === null) return;
    const id = pid; pid = null;
    try { card.releasePointerCapture(id); } catch (_) {}
    if (!dragging) {
      card.classList.remove('holding');
      card.style.transition = 'transform .14s ease, box-shadow .14s ease';
      card.style.transform = '';
      return;
    }
    card.classList.remove('dragging');
    disarmDrop(drop);
    if (isOverDrop(card, drop)) snapCommit(card, word, dx, dy, drop, d);
    else springBack(card);
  });
  card.addEventListener('pointercancel', () => {
    if (pid === null) return;
    pid = null;
    card.classList.remove('holding');
    if (dragging) { card.classList.remove('dragging'); disarmDrop(drop); springBack(card); }
    else { card.style.transition = 'transform .14s ease'; card.style.transform = ''; }
  });
}

export function attachListen(el, getText, d) {
  el.addEventListener('pointerdown', () => {
    if (!d.isPlaying()) return;
    d.speak(getText());
    d.chainPulse(el);
  });
}
