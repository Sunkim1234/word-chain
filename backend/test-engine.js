// 엔진 자체 검증: 수천 판을 랜덤으로 플레이해 5턴 100% 도달 확인 + 통계
const fs = require('fs');
const KkutuEngine = require('./kkutu-engine.js');

const data = JSON.parse(fs.readFileSync('kids_nouns_safe_2plus.json', 'utf8'));

// 재현 가능한 시드 난수
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(12345);
const engine = new KkutuEngine(data.words, { targetAnswers: 5, rng });
console.log('안전 시작 단어 수:', engine.safeStartWords.length);

const N = 5000;
let won = 0, lost = 0, badOptions = 0, repeats = 0;
const optDist = { 1: 0, 2: 0, 3: 0 };

for (let i = 0; i < N; i++) {
  let state = engine.start();
  const seen = new Set(state.history.map((h) => h.word));
  let safe = true;
  while (state.status === 'playing') {
    const opts = state.options;
    optDist[opts.length] = (optDist[opts.length] || 0) + 1;
    if (opts.length < 2) badOptions++;
    // 모든 보기가 현재 음절로 시작하는 정답인지 검증
    for (const o of opts) {
      if (o[0] !== state.currentSyllable) safe = false;
      if (seen.has(o)) safe = false; // 보기에 이미 쓴 단어가 있으면 안 됨
    }
    const choice = opts[Math.floor(rng() * opts.length)];
    if (seen.has(choice)) repeats++;
    seen.add(choice);
    state = engine.answer(choice);
    // AI가 방금 둔 단어도 중복 아닌지
    if (state.lastWord && state.history.filter((h) => h.word === state.lastWord).length > 1) repeats++;
  }
  if (state.status === 'won') won++; else lost++;
}

console.log(`\n${N}판 결과`);
console.log(`  승리(아이 5번 답 완주): ${won}/${N} = ${(won / N * 100).toFixed(1)}%`);
console.log(`  실패(도중 막힘): ${lost}`);
console.log(`  보기 2개 미만으로 떨어진 차례: ${badOptions}`);
console.log(`  단어 재사용(중복) 발생: ${repeats}`);
console.log(`  제시된 보기 개수 분포: 2개=${optDist[2]}, 3개=${optDist[3]}` +
  ` (3개 비율 ${(optDist[3] / (optDist[2] + optDist[3]) * 100).toFixed(0)}%)`);

// 샘플 한 판 출력
const s0 = mulberry32(777);
const e2 = new KkutuEngine(data.words, { targetAnswers: 5, rng: s0 });
let st = e2.start();
console.log('\n샘플 한 판 진행:');
console.log('  AI 시작:', st.history[0].word);
let guard = 0;
while (st.status === 'playing' && guard++ < 20) {
  console.log(`  [${st.currentSyllable}]로 시작하는 보기: ${st.options.join(', ')}`);
  const pick = st.options[0];
  st = e2.answer(pick);
  console.log(`    아이 선택: ${pick}` + (st.history.slice(-1)[0].by === 'ai' && st.status === 'playing'
    ? ` -> AI: ${st.lastWord}` : ''));
}
console.log('  결과:', st.status, '| 아이가 답한 횟수:', st.childAnswers);
