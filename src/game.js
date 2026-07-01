// src/game.js — 데이터 로드 + 엔진 생성 (렌더는 다음 Task)
const [s, m, e] = await Promise.all([
  fetch('data/start-words.json').then(r => r.json()),
  fetch('data/middle-words.json').then(r => r.json()),
  fetch('data/end-words.json').then(r => r.json()),
]);
const engine = new window.KkutuEngine(
  { start: s.words, middle: m.words, end: e.words },
  { optionsCount: 3 }
);
let state = engine.start();
console.log('boot ok', state.status, state.options);
