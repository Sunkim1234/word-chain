// src/game.js
import { makeUI } from './ui.js';
import { attachCard, attachListen } from './drag.js';
import { speak, speakRound, speakChain, speakSeq, bumpSeq } from './tts.js';
import { spawnSparks, clearSparks, chainPulse } from './effect.js';

const reduceMotion = matchMedia('(prefers-reduced-motion:reduce)').matches;
const $ = id => document.getElementById(id);

const [s, m, e, imgMap] = await Promise.all([
  fetch('data/start-words.json').then(r => r.json()),
  fetch('data/middle-words.json').then(r => r.json()),
  fetch('data/end-words.json').then(r => r.json()),
  fetch('data/word-images.json').then(r => r.json()),
]);

const engine = new window.KkutuEngine(
  { start: s.words, middle: m.words, end: e.words },
  { optionsCount: 3 }
);
let state = engine.start();
let locked = false;

const imgSrc = word => (imgMap[word] ? 'assets/img/' + imgMap[word] + '.png' : null);
const promptSpeaker = document.querySelector('.prompt__speaker');

// drag가 쓸 의존성
const dragDeps = {
  isPlaying: () => !locked && state.status === 'playing',
  getDrop: () => $('drop'),
  lock: () => { locked = true; },
  onCommit: (word) => commit(word),
  speak,
  spawnSparks, clearSparks, chainPulse,
  imgSrc,
};
const attachOption = (card, word) => attachCard(card, word, dragDeps);

const ui = makeUI({ imgSrc, attachOption });

function render() {
  ui.renderRound(state, (now, sentence) => speakRound(now, sentence, promptSpeaker));
}

function commit(word) {
  const prevWord = state.lastWord;
  const syl = state.currentSyllable;
  ui.fillDrop(word);
  spawnSparks($('drop'), 10, { big: true });
  state = engine.answer(word);
  const startChain = () => playChainThenAdvance(prevWord, syl, word);
  if (reduceMotion) startChain(); else setTimeout(startChain, 800);
}

// 정답 후: 직전 단어 → 연결 글자 → 내 답 낭독+펄스 → 다음 라운드
function playChainThenAdvance(prevWord, syl, answer) {
  const nowCard = document.querySelector('.now__card');
  const linkTok = $('linkTok');
  const drop = $('drop');
  let advanced = false;
  const go = () => { if (!advanced) { advanced = true; advance(); } };
  if (!('speechSynthesis' in window)) { chainPulse(nowCard); setTimeout(go, 1200); return; }
  const fb = setTimeout(go, 3500);
  speakChain(
    [{ text: prevWord, el: nowCard }, { text: syl, el: linkTok }, { text: answer, el: drop }],
    step => chainPulse(step.el),
    () => { clearTimeout(fb); go(); }
  );
}

function advance() {
  if (state.status !== 'playing') { ui.renderProgress(state); ui.showFinish(restart); return; }
  render();
  locked = false;
}

function restart() {
  ui.clearFinish();
  state = engine.start();
  locked = false;
  render();
}

// 프롬프트 스피커: 다시 듣기
promptSpeaker.addEventListener('click', () => {
  if (!('speechSynthesis' in window)) return;
  bumpSeq();
  speechSynthesis.cancel();
  speak($('promptText').textContent);
});

// 탭-투-리슨: 제시 단어 카드 / 연결고리칸
attachListen(document.querySelector('.now__card'), () => state.lastWord, dragDeps);
attachListen($('linkTok'), () => state.currentSyllable, dragDeps);

// 비율 토글(목업 전용 — 열린 항목)
const dev = $('device');
document.querySelectorAll('.controls button').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('.controls button').forEach(x => x.classList.remove('active'));
  b.classList.add('active'); dev.className = 'device' + (b.dataset.r ? ' ' + b.dataset.r : '');
}));

render();
