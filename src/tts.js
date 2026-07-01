// src/tts.js
let _voiceKo = null;
let _speakSeq = 0;
const has = 'speechSynthesis' in window;

function _pickVoice() {
  if (!has) return;
  const vs = speechSynthesis.getVoices();
  _voiceKo = vs.find(v => (v.lang || '').toLowerCase().startsWith('ko')) || null;
}
if (has) { _pickVoice(); speechSynthesis.addEventListener('voiceschanged', _pickVoice); }

function _utter(text) {
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'ko-KR'; u.rate = 0.95;
  if (_voiceKo) u.voice = _voiceKo;
  return u;
}

export function speak(word) {
  if (!has) return;
  _speakSeq++;
  speechSynthesis.cancel();
  speechSynthesis.speak(_utter(word));
}

// 제시 단어 → 0.3초 → 프롬프트 문장. speakerEl에 .speaking 토글.
export function speakRound(word, sentence, speakerEl) {
  if (!has) return;
  const seq = ++_speakSeq;
  speechSynthesis.cancel();
  const off = () => speakerEl && speakerEl.classList.remove('speaking');
  const u1 = _utter(word);
  u1.onstart = () => { if (seq === _speakSeq && speakerEl) speakerEl.classList.add('speaking'); };
  u1.onerror = off;
  u1.onend = () => {
    if (seq !== _speakSeq) { off(); return; }
    setTimeout(() => {
      if (seq !== _speakSeq) { off(); return; }
      const u2 = _utter(sentence); u2.onend = off; u2.onerror = off;
      speechSynthesis.speak(u2);
    }, 300);
  };
  speechSynthesis.speak(u1);
}

// game의 연결 낭독용: 순번 검사하며 한 단계씩 읽기
export function speakChain(steps, onStep, onDone) {
  if (!has) { onDone && onDone(); return; }
  const myseq = ++_speakSeq;
  speechSynthesis.cancel();
  const GAP = 300;
  const run = (i) => {
    if (i >= steps.length) { onDone && onDone(); return; }
    if (myseq !== _speakSeq) return;        // 끼어든 발화 → 중단(호출측 fallback)
    onStep && onStep(steps[i]);
    const u = _utter(steps[i].text);
    u.onend = () => { if (myseq === _speakSeq) setTimeout(() => run(i + 1), GAP); };
    speechSynthesis.speak(u);
  };
  run(0);
  return myseq;
}

export function speakSeq() { return _speakSeq; }
export function bumpSeq() { return ++_speakSeq; }
