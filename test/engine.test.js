/* 끝말잇기 엔진 검증 시뮬레이션 (Node) */
const fs = require('fs');
const path = require('path');
const KkutuEngine = require('../src/engine.js');

const dir = path.join(__dirname, '..', 'data');
const s = JSON.parse(fs.readFileSync(path.join(dir, 'start-words.json'), 'utf8'));
const m = JSON.parse(fs.readFileSync(path.join(dir, 'middle-words.json'), 'utf8'));
const e = JSON.parse(fs.readFileSync(path.join(dir, 'end-words.json'), 'utf8'));

const startSet = new Set(s.words.map(w => w.word));
const middleSet = new Set(m.words.map(w => w.word));
const endSet = new Set(e.words.map(w => w.word));

// 시드 난수(재현 가능)
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

const ROLES = {1:{1:'ai',2:'child',3:'ai',4:'child'},2:{1:'child',2:'ai',3:'child',4:'ai'}};
const N = 5000;
let fails = 0;
const childOptCounts = [];
const stats = {won:0, lost:0, words8:0};
let example = null;

for (let i = 0; i < N; i++) {
  const rng = mulberry32(i + 1);
  const eng = new KkutuEngine({start:s.words, middle:m.words, end:e.words}, {rng, optionsCount:3});
  let st = eng.start();
  const problems = [];

  let guard = 0;
  while (st.status === 'playing') {
    if (++guard > 50) { problems.push('무한루프'); break; }
    // 아이 차례: 보기 개수 확인
    if (st.options.length !== 3) problems.push(`아이 보기 ${st.options.length}개 (자리 r${st.round}p${st.position})`);
    childOptCounts.push(st.options.length);
    // 보기 음절 검증
    for (const o of st.options) {
      if (st.currentSyllable != null && o[0] !== st.currentSyllable)
        problems.push(`보기 시작음절 불일치: ${o} vs ${st.currentSyllable}`);
    }
    const pick = st.options[Math.floor(rng() * st.options.length)];
    st = eng.answer(pick);
  }

  if (st.status === 'won') stats.won++; else stats.lost++;
  const h = st.history;

  // 검증들
  if (st.status !== 'won') problems.push('won 아님: ' + st.status);
  if (h.length !== 8) problems.push(`총 단어 ${h.length}개`); else stats.words8++;

  // 중복 없음
  const ws = h.map(x => x.word);
  if (new Set(ws).size !== ws.length) problems.push('단어 중복 발생');

  // 라운드/자리/담당자/풀/체인 검증
  for (let r = 1; r <= 2; r++) {
    const rh = h.filter(x => x.round === r).sort((a,b)=>a.pos-b.pos);
    if (rh.length !== 4) { problems.push(`라운드${r} 단어 ${rh.length}개`); continue; }
    for (let p = 1; p <= 4; p++) {
      const cell = rh[p-1];
      if (cell.pos !== p) problems.push(`자리 어긋남 r${r}`);
      if (cell.by !== ROLES[r][p]) problems.push(`담당자 어긋남 r${r}p${p}: ${cell.by}`);
      // 자리별 풀
      const w = cell.word;
      if (p === 1 && !(startSet.has(w)||middleSet.has(w))) problems.push(`1번 풀위반 ${w}`);
      if ((p === 2 || p === 3) && !middleSet.has(w)) problems.push(`${p}번 풀위반(중간아님) ${w}`);
      if (p === 4 && !(endSet.has(w)||middleSet.has(w))) problems.push(`4번 풀위반 ${w}`);
      // 체인 연결
      if (p > 1) {
        const prev = rh[p-2].word;
        if (w[0] !== prev[prev.length-1]) problems.push(`체인 끊김 r${r}p${p}: ${prev}->${w}`);
      }
    }
  }

  if (problems.length) {
    fails++;
    if (fails <= 5) console.log(`게임 ${i}: `, problems.slice(0,4).join(' | '));
  }
  if (i === 0) example = h;
}

console.log('\n=== 결과 ===');
console.log(`총 ${N}판 | won=${stats.won} lost=${stats.lost} | 8단어=${stats.words8}`);
console.log(`실패(규칙위반) 게임 수: ${fails}`);
const bad = childOptCounts.filter(c => c !== 3).length;
console.log(`아이 차례 총 ${childOptCounts.length}회, 보기≠3 인 경우: ${bad}`);
console.log('\n예시 게임 (게임0):');
for (const x of example) {
  const pool = startSet.has(x.word)?'시작': middleSet.has(x.word)?'중간':'끝';
  console.log(`  R${x.round} ${x.pos}번 [${x.by==='ai'?'AI ':'아이'}] ${x.word} (${pool})`);
}
console.log(fails === 0 ? '\n✅ 모든 검증 통과' : `\n❌ ${fails}판에서 문제 발견`);
