# Phase 1: 레포 재구조화 + 새 모델 모듈화 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 바이브 코딩으로 만든 단일 거대 파일(`frontend/v2/mockup/`)을, 새 역할기반 엔진(4단어×2라운드)을 쓰는 flat한 모듈 정적 웹앱으로 재편한다 — 리뷰용으로 읽기 좋고 `python3 -m http.server`로 바로 도는 상태.

**Architecture:** 레포 루트에 `index.html` + `src/`(engine/game/ui/drag/tts/effect + styles) + `data/`(역할별 단어 JSON + 단어→그림 매핑) + `assets/`(폰트·그림) + `tools/` + `test/` + `archive/`. 빌드 스크립트·base64 인라인 없음. ES 모듈 로딩, 엔진은 전역 스크립트. 옛 game/ui 코드는 새 엔진 state 형태에 맞춰 추출·적응한다.

**Tech Stack:** 순수 HTML/CSS/JS(바닐라, 프레임워크 없음), ES 모듈, Web Speech API(TTS), Pointer Events(드래그), Node(엔진 테스트). 빌드·번들러·npm 없음.

## Global Constraints

- 의존성 없는 순수 JS. 빌드 단계·번들러·npm 없음. `python3 -m http.server`(레포 루트)로 실행, `http://localhost:8000`에서 봄.
- `src/engine.js`는 `backend/kkutu-engine.js`와 **로직 동일**해야 한다(Node 테스트와 단일 소스). UMD 그대로 두고 브라우저에선 전역 스크립트로 로드.
- 새 엔진 API: `new KkutuEngine({ start, middle, end }, { optionsCount:3, rng })`. state = `{status, round, position, totalRounds, roundLength, turn, currentSyllable, options, lastWord, history, usedCount, category(w)}`. status: `idle|playing|won|lost`.
- 그림 정책: **그림 있으면 표시, 없으면 글자만**(폴백). 단어→그림 매핑은 258개만 존재.
- 한글 파일명 금지 — `data/`의 단어 파일은 영문으로 정규화.
- 기존 동작 보존: 드래그+스냅 / TTS(ko-KR) / 별 파티클 / 정답 후 "단어→글자→답" 낭독 / 탭-투-리슨 / 라운드 진행 / 종료·재시작.
- 잦은 커밋. 각 Task 끝에 커밋.

---

## File Structure

| 파일 | 책임 |
|---|---|
| `index.html` | 앱 뼈대(정적 마크업) + 모듈 진입 |
| `src/engine.js` | 게임 규칙(새 엔진, 백엔드와 동일 소스) |
| `src/game.js` | 흐름 컨트롤러: 데이터/엔진 부트스트랩, 라운드 진행, finish/restart, drag/tts/effect 주입 |
| `src/ui.js` | DOM 렌더: 라운드/진행/드롭 + 그림 폴백 |
| `src/drag.js` | 보기 카드 드래그·스냅 + 탭-투-리슨 (콜백 주입) |
| `src/tts.js` | 음성 합성 래퍼 |
| `src/effect.js` | 별 파티클·펄스 (대상 요소 인자) |
| `src/styles.css` | 스타일 |
| `data/start-words.json` `middle-words.json` `end-words.json` | 역할별 단어 풀 |
| `data/word-images.json` | 단어→그림 파일 매핑(258) |
| `assets/fonts/` `assets/img/` | 폰트·픽토그램 |
| `tools/build_words.py` | 단어 데이터 생성(참고용) |
| `test/engine.test.js` | 엔진 회귀 테스트 |
| `archive/` | 옛 frontend 루트앱·v1·mockup 빌드 |

---

# Milestone A — 레포 재구조화

순수 파일 이동·정리. 끝나면 엔진 테스트가 새 경로에서 통과한다.

### Task A1: 엔진·데이터·테스트·도구를 새 위치로 이동

**Files:**
- Create dir: `src/`, `data/`, `test/`, `tools/`, `assets/`
- Move: `backend/kkutu-engine.js` → `src/engine.js`
- Move: `backend/test-engine.js` → `test/engine.test.js`
- Move+rename: `backend/끝말잇기_1_시작단어.json` → `data/start-words.json`, `_2_중간단어.json` → `data/middle-words.json`, `_3_끝단어.json` → `data/end-words.json`
- Move: `backend/build_words.py` → `tools/build_words.py`
- Modify: `test/engine.test.js` (데이터 경로 수정)

**Interfaces:**
- Produces: `src/engine.js`가 `require`/전역 둘 다 지원(UMD 유지). `data/*.json`은 `{meta, words:[...]}` 형태.

- [ ] **Step 1: 디렉터리 생성 및 git mv**

```bash
cd /Users/yunki/Claude/Projects/word-chain
mkdir -p src data test tools assets
git mv backend/kkutu-engine.js src/engine.js
git mv backend/test-engine.js test/engine.test.js
git mv "backend/끝말잇기_1_시작단어.json" data/start-words.json
git mv "backend/끝말잇기_2_중간단어.json" data/middle-words.json
git mv "backend/끝말잇기_3_끝단어.json" data/end-words.json
git mv backend/build_words.py tools/build_words.py
```

- [ ] **Step 2: 테스트의 require/데이터 경로 수정**

`test/engine.test.js`에서 엔진 require와 데이터 로드 경로를 새 위치로 바꾼다.
- `require('./kkutu-engine.js')` → `require('../src/engine.js')`
- `dir` 기준 한글 파일명 3줄을 아래로 교체:

```js
const dir = path.join(__dirname, '..', 'data');
const s = JSON.parse(fs.readFileSync(path.join(dir, 'start-words.json'), 'utf8'));
const m = JSON.parse(fs.readFileSync(path.join(dir, 'middle-words.json'), 'utf8'));
const e = JSON.parse(fs.readFileSync(path.join(dir, 'end-words.json'), 'utf8'));
```
(원래 `dir`이 `__dirname`을 가리켰다면 위처럼 `..','data'`로 맞춘다. require의 상대경로도 `test/`에서 `src/`로 가도록 `../src/`.)

- [ ] **Step 3: 엔진 테스트 실행(회귀 확인)**

Run: `node test/engine.test.js`
Expected: `✅ 모든 검증 통과` 및 `won=5000 lost=0` (이전과 동일).

- [ ] **Step 4: 남은 backend 참고 데이터 처리**

`backend/`에 남은 `kids_nouns.json`(미사용 원본), `safe_start_words.json`(옛 모델), `README.md`(옛 API 설명)를 정리한다. README는 새 API 기준으로 docs로 이동(Task A3에서 갱신), 나머지 둘은 archive로.

```bash
mkdir -p archive
git mv backend/kids_nouns.json archive/kids_nouns.json
git mv backend/safe_start_words.json archive/safe_start_words.json
git mv backend/README.md docs/engine.md   # Task A3에서 새 API로 갱신
rmdir backend 2>/dev/null || true
```

- [ ] **Step 5: 커밋**

```bash
git add -A
git commit -m "refactor: move engine/data/test/tools to flat layout"
```

### Task A2: 옛 프론트엔드를 archive로 이동

**Files:**
- Move: `frontend/` (루트앱 index/app/style/test-app), `frontend/v1/` 전체, `frontend/v1/mockup/`, `frontend/v2/mockup/` → `archive/` 하위
- Keep(임시): `frontend/v2/font`, `frontend/v2/img`, `frontend/v2/words.json` — 다음 Task에서 assets/data로 옮기므로 아직 두거나 함께 이동

**Interfaces:**
- Produces: `archive/`에 옛 코드 보존. `archive/mockups/v2-build.py`는 Milestone B 추출의 원본 소스.

- [ ] **Step 1: 목업 빌드 원본을 archive로(추출 소스로 보존)**

```bash
mkdir -p archive/mockups archive/frontend-root archive/v1
git mv frontend/v2/mockup/build.py archive/mockups/v2-build.py
git mv frontend/v2/mockup/mockup.html archive/mockups/v2-mockup.html
git mv frontend/v2/mockup/README.md archive/mockups/v2-mockup-README.md
git mv frontend/v1/mockup archive/mockups/v1-mockup
```

- [ ] **Step 2: 루트앱·v1 이동**

```bash
git mv frontend/index.html frontend/app.js frontend/style.css frontend/test-app.js archive/frontend-root/
# v1의 코드/데이터 (font/img 포함 전체)
git mv frontend/v1 archive/v1
```

- [ ] **Step 3: 상태 확인**

Run: `git -c core.quotepath=false status -s | head -40`
Expected: 위 이동들이 `R`(rename)로 스테이징됨. `frontend/`에는 `v2/`(font,img,words.json)만 남음.

- [ ] **Step 4: 커밋**

```bash
git add -A
git commit -m "chore: archive old frontend (root app, v1, mockup builds)"
```

### Task A3: 에셋 이동 + 단어→그림 매핑 추출 + 루트 위생

**Files:**
- Move: `frontend/v2/font/*` → `assets/fonts/`, `frontend/v2/img/*` → `assets/img/`
- Create: `data/word-images.json` (단어→그림 파일명 매핑)
- Delete: `backend.txt`
- Modify: 루트 `README.md`(채움), `.gitignore`(`.DS_Store` 추가)
- Move: `wordchain_v1.md` → `docs/`
- Update: `docs/engine.md` (새 API 설명)

**Interfaces:**
- Produces: `data/word-images.json` = `{ "신발": "24801", ... }` (그림 있는 258개만). `assets/img/<id>.png` 존재.

- [ ] **Step 1: 에셋 이동**

```bash
mkdir -p assets/fonts assets/img
git mv frontend/v2/font/*.ttf assets/fonts/
git mv frontend/v2/img/*.png assets/img/
```

- [ ] **Step 2: 단어→그림 매핑 추출**

`frontend/v2/words.json`(`{words:[{word,pic}]}`)에서 매핑만 뽑아 `data/word-images.json`으로 저장:

```bash
python3 - <<'PY'
import json
src = json.load(open('frontend/v2/words.json', encoding='utf-8'))['words']
m = {w['word']: str(w['pic']) for w in src if w.get('pic') is not None}
json.dump(m, open('data/word-images.json','w',encoding='utf-8'), ensure_ascii=False, indent=0)
print('wrote', len(m), 'mappings')
PY
git rm frontend/v2/words.json
rmdir frontend/v2/font frontend/v2/img frontend/v2 frontend 2>/dev/null || true
```
Expected: `wrote 258 mappings`.

- [ ] **Step 3: 매핑↔이미지 정합 검증**

```bash
python3 - <<'PY'
import json, os
m = json.load(open('data/word-images.json', encoding='utf-8'))
missing = [w for w,pid in m.items() if not os.path.exists(f'assets/img/{pid}.png')]
print('mappings', len(m), '| missing png', len(missing))
assert not missing, missing[:10]
print('OK')
PY
```
Expected: `missing png 0` / `OK`.

- [ ] **Step 4: 루트 위생**

```bash
git rm backend.txt
git mv wordchain_v1.md docs/wordchain-v1-notes.md
# .gitignore에 .DS_Store 보장 (이미 있으면 중복 안 되게)
grep -qx '.DS_Store' .gitignore || printf '.DS_Store\n' >> .gitignore
git rm --cached -r --ignore-unmatch '**/.DS_Store' 2>/dev/null || true
```

- [ ] **Step 5: 루트 README 작성**

`README.md`를 아래 내용으로 작성:

```markdown
# 끝말잇기 (유아·특수학교용)

유아·특수학교 아동을 위한 끝말잇기 웹 게임. AI와 아이가 번갈아
4단어 체인을 2라운드 잇는다. 의존성 없는 순수 HTML/CSS/JS.

## 실행

    python3 -m http.server 8000
    # 브라우저에서 http://localhost:8000 열기

## 구조

- `index.html` — 앱 진입점
- `src/` — engine(규칙) · game(흐름) · ui · drag · tts · effect · styles
- `data/` — 역할별 단어 풀 + 단어→그림 매핑
- `assets/` — 폰트 · 픽토그램(ARASAAC, CC BY-NC-SA)
- `test/engine.test.js` — 엔진 회귀 테스트 (`node test/engine.test.js`)
- `tools/`, `docs/`, `archive/`

## 엔진

`new KkutuEngine({ start, middle, end }, { optionsCount: 3 })` → `start()` / `answer(word)`.
자세한 API는 `docs/engine.md` 참고.
```

- [ ] **Step 6: docs/engine.md를 새 API로 갱신**

`docs/engine.md`(옛 README)의 "사용법"·"API" 부분을 새 엔진 기준으로 교체: 생성자 `new KkutuEngine({start,middle,end}, {optionsCount,rng})`, 메서드 `start()`/`answer(word)`, state 필드(`status/round/position/totalRounds/roundLength/turn/currentSyllable/options/lastWord/history/usedCount/category`). 게임 모델: 2라운드×4단어, 역할 교대.

- [ ] **Step 7: 커밋**

```bash
git add -A
git commit -m "chore: move assets, extract word-image map, root hygiene + README"
```

---

# Milestone B — 새 엔진 위 모듈 정적 앱

`archive/mockups/v2-build.py`의 인라인 CSS/JS를 원본 삼아 모듈로 추출하고, 새 엔진 state에 맞춰 적응한다.

> **추출 규칙(중요):** `v2-build.py`의 CSS/JS는 Python f-string 안이라 `{{`·`}}`가 각각 리터럴 `{`·`}`다. 추출 시 **`{{`→`{`, `}}`→`}`로 되돌린다.** 또 f-string 치환 토큰 `{words_js}`, `{img_js}`, `{TARGET}`은 코드가 아니라 데이터 주입점이므로 새 방식(아래)으로 대체한다.

### Task B1: index.html 뼈대 + 데이터/엔진 부트스트랩

**Files:**
- Create: `index.html`
- Create: `src/game.js` (부트스트랩 골격만)

**Interfaces:**
- Produces: 전역 `window.KkutuEngine`(engine.js 스크립트), `src/game.js`가 `data/*.json` 3개 fetch 후 `new KkutuEngine({start,middle,end})` 생성.

- [ ] **Step 1: index.html 작성**

`archive/mockups/v2-build.py`의 `<div class="page">…</div>`(라운드 마크업: topbar/progress/now/link/drop/prompt/options/credit)를 정적 HTML로 옮긴다. 단, 목업 전용 **비율 토글 `.controls`와 크레딧은 일단 유지**(열린 항목 — 후속 결정). 헤드에 폰트 `@font-face`(assets/fonts의 ttf)와 `styles.css` 링크, 바디 끝에 엔진(전역 스크립트)→game(모듈) 순 로드:

```html
<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>끝말잇기</title>
  <link rel="stylesheet" href="src/styles.css">
</head>
<body>
  <!-- v2-build.py의 .page 마크업을 여기에 그대로 -->
  <script src="src/engine.js"></script>
  <script type="module" src="src/game.js"></script>
</body>
</html>
```
(폰트 `@font-face`는 `src/styles.css` 상단에 두고 `src: url('../assets/fonts/Jua-Regular.ttf')` 형태로 참조. base64 아님.)

- [ ] **Step 2: game.js 부트스트랩 골격**

```js
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
```

- [ ] **Step 3: 로컬 서버로 부트 검증**

Run: `python3 -m http.server 8000` 후 브라우저 `http://localhost:8000`, 콘솔 확인.
Expected: 콘솔에 `boot ok playing [...]`(보기 배열), 에러 없음. (CSS·렌더는 아직 없음.)

- [ ] **Step 4: 커밋**

```bash
git add index.html src/game.js
git commit -m "feat(app): index skeleton + data/engine bootstrap"
```

### Task B2: effect.js (별 파티클·펄스)

**Files:**
- Create: `src/effect.js`

**Interfaces:**
- Produces: `export function spawnSparks(target, n, opts={})`, `export function clearSparks(target)`, `export function chainPulse(el)`. (옛 코드는 `$('drop')`·전역 `reduceMotion`에 의존 → 대상 요소를 인자로, reduceMotion은 모듈 내부에서 `matchMedia`로 판정.)

- [ ] **Step 1: effect.js 작성**

`v2-build.py`의 `spawnSparks`/`clearSparks`/`chainPulse`를 옮기되, `drop = $('drop')`을 인자 `target`으로 바꾸고 `{{ }}`를 unescape:

```js
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
```

- [ ] **Step 2: 문법 확인**

Run: `node --check src/effect.js`
Expected: 출력 없음(성공).

- [ ] **Step 3: 커밋**

```bash
git add src/effect.js
git commit -m "feat(app): extract effect.js (sparks, pulse)"
```

### Task B3: tts.js (음성)

**Files:**
- Create: `src/tts.js`

**Interfaces:**
- Produces: `export function speak(word)`, `export function speakRound(word, sentence, speakerEl)`, `export function speakChainStep(...)` 또는 game이 쓸 저수준 `utter`. 스피커 버튼 시각효과는 `speakerEl`을 인자로 받아 처리. 발화 순번(`_speakSeq`)은 모듈 내부 상태.

- [ ] **Step 1: tts.js 작성**

`v2-build.py`의 TTS 블록(`_pickVoice/_utter/speak/speakRound/bindSpeaking/_speakSeq`)을 옮긴다. `promptSpeaker` 전역 참조를 함수 인자(`speakerEl`)로 바꾸고 `{{ }}` unescape:

```js
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
```

- [ ] **Step 2: 문법 확인**

Run: `node --check src/tts.js`
Expected: 출력 없음.

- [ ] **Step 3: 커밋**

```bash
git add src/tts.js
git commit -m "feat(app): extract tts.js (speech)"
```

### Task B4: drag.js (드래그·스냅·탭듣기)

**Files:**
- Create: `src/drag.js`

**Interfaces:**
- Consumes: effect의 `spawnSparks`, tts의 `speak` — 단, 직접 import하지 않고 game이 주입한다.
- Produces: `export function attachCard(card, word, deps)` / `export function attachListen(el, getText, deps)`. `deps = { isPlaying, getDrop, onCommit, speak, spawnSparks, clearSparks, chainPulse }`. `onCommit(word)`은 스냅 확정 시 game이 받는다.

- [ ] **Step 1: drag.js 작성**

`v2-build.py`의 `DRAG_THRESH/rectsOverlap/isOverDrop/armDrop/disarmDrop/attachCard/attachListen/springBack/snapCommit`을 옮긴다. 전역 의존(`locked`,`state`,`$('drop')`,`speak`,`spawnSparks`,`commit`)을 `deps`로 주입받게 바꾸고 `{{ }}` unescape:

```js
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
  drop.innerHTML = '<img class="opt__pic drop__ghost" src="' + (d.imgSrc(word) || '') + '" alt="">' +
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
```

- [ ] **Step 2: 문법 확인**

Run: `node --check src/drag.js`
Expected: 출력 없음.

- [ ] **Step 3: 커밋**

```bash
git add src/drag.js
git commit -m "feat(app): extract drag.js (drag/snap, tap-to-listen) with injected deps"
```

### Task B5: styles.css

**Files:**
- Create: `src/styles.css`

- [ ] **Step 1: CSS 추출**

`archive/mockups/v2-build.py`의 `html = f'''<style>` 다음 줄부터 `</style>` 직전까지(약 70~244행)를 `src/styles.css`로 옮긴다. **`{{`→`{`, `}}`→`}` unescape.** 폰트는 파일 상단에 `@font-face`로:

```css
@font-face { font-family:'Jua'; src:url('../assets/fonts/Jua-Regular.ttf') format('truetype'); font-display:swap; }
@font-face { font-family:'GowunDodum'; src:url('../assets/fonts/GowunDodum-Regular.ttf') format('truetype'); font-display:swap; }
/* 이하 v2-build.py에서 추출한 본문 CSS (unescaped) */
```

- [ ] **Step 2: 잔여 이스케이프 점검**

Run: `grep -n '{{\|}}' src/styles.css || echo "clean"`
Expected: `clean` (이중 중괄호 잔여 없음).

- [ ] **Step 3: 커밋**

```bash
git add src/styles.css
git commit -m "feat(app): extract styles.css (unescaped, font-face to assets)"
```

### Task B6: ui.js (렌더 + 그림 폴백)

**Files:**
- Create: `src/ui.js`

**Interfaces:**
- Consumes: `data/word-images.json`(game이 로드해 주입), drag의 `attachCard`(game이 주입).
- Produces: `export function makeUI({ imgSrc, attachOption })` → `{ renderRound(state, onSpeakRound), renderProgress(state), fillDrop(word), showFinish(onRestart), clearFinish() }`. `imgSrc(word)`는 매핑 있으면 `assets/img/<id>.png`, 없으면 `null`(글자만).

- [ ] **Step 1: ui.js 작성**

`v2-build.py`의 `renderRound/renderProgress/fillDrop/finish`를 옮기되, **새 state(`round/position/totalRounds/roundLength/history`)에 맞춰 진행표시를 바꾸고**, 그림은 `imgSrc(word)`로 폴백 처리(`null`이면 `<img>` 생략, 글자만):

```js
// src/ui.js
const $ = id => document.getElementById(id);

export function makeUI({ imgSrc, attachOption }) {
  // 그림 폴백: 매핑 있으면 <img>, 없으면 텍스트만
  const pic = (word, cls) => {
    const src = imgSrc(word);
    return src ? '<img class="' + cls + '" draggable="false" src="' + src + '" alt="' + word + '">' : '';
  };

  // 진행: 전체 8칸(2라운드×4) 중 history.length 만큼 done
  function renderProgress(state) {
    const total = state.totalRounds * state.roundLength;   // 8
    const done = state.history.length;
    const p = $('progress'); p.innerHTML = '';
    for (let k = 0; k < total; k++) {
      const s = document.createElement('span');
      s.className = 'step ' + (k < done ? 'done' : (k === done ? 'cur' : 'todo'));
      p.appendChild(s);
    }
    p.setAttribute('aria-label', '진행 ' + done + ' / ' + total);
  }

  function renderRound(state, onSpeakRound) {
    const now = state.lastWord;
    const syl = state.currentSyllable;
    $('nowPic').src = imgSrc(now) || ''; $('nowPic').alt = now || '';
    $('nowPic').style.display = imgSrc(now) ? '' : 'none';
    $('nowWord').innerHTML = now ? now.slice(0, -1) + '<span class="syl">' + now.slice(-1) + '</span>' : '';
    $('linkTok').textContent = syl || '';
    $('promptText').innerHTML = "'<span class=\"syl\">" + (syl || '') + "</span>' 로 시작하는 말은?";

    const drop = $('drop');
    drop.className = 'drop'; drop.innerHTML = '<span class="drop__q">?</span>';

    const opts = $('options'); opts.innerHTML = '';
    state.options.forEach(w => {
      const b = document.createElement('button');
      b.className = 'opt'; b.type = 'button';
      b.innerHTML = pic(w, 'opt__pic') + '<span class="opt__word">' + w + '</span>';
      attachOption(b, w);          // game이 주입한 drag 부착기
      opts.appendChild(b);
    });
    const v = document.createElement('button');
    v.className = 'opt opt--voice'; v.type = 'button';
    v.setAttribute('aria-label', '말하기 (준비 중)');
    v.innerHTML = '<span class="opt__mic" aria-hidden="true">🎤</span><span class="opt__word">말하기</span>';
    opts.appendChild(v);

    renderProgress(state);
    const nowCard = document.querySelector('.now__card');
    nowCard.classList.remove('intro'); void nowCard.offsetWidth; nowCard.classList.add('intro');
    onSpeakRound(now, $('promptText').textContent);
  }

  function fillDrop(word) {
    const drop = $('drop');
    drop.className = 'drop drop--filled';
    drop.innerHTML = pic(word, 'opt__pic') + '<span class="opt__word">' + word + '</span>';
  }

  function showFinish(onRestart) {
    const wrap = document.querySelector('.wrap');
    if (wrap.querySelector('.finish')) return;
    const o = document.createElement('div');
    o.className = 'finish';
    o.innerHTML =
      '<h2 class="finish__title">다 이었어요!</h2>' +
      '<button class="finish__btn" type="button" aria-label="다음">' +
      '<svg class="finish__check" viewBox="0 0 32 32" aria-hidden="true">' +
      '<path d="M6 16.5L13 23.5L26 8.5" fill="none" stroke="#fff" stroke-width="5.2" stroke-linecap="round" stroke-linejoin="round"/>' +
      '</svg></button>';
    wrap.appendChild(o);
    o.querySelector('.finish__btn').addEventListener('click', onRestart);
  }
  function clearFinish() { document.querySelectorAll('.finish').forEach(n => n.remove()); }

  return { renderRound, renderProgress, fillDrop, showFinish, clearFinish };
}
```

- [ ] **Step 2: 문법 확인**

Run: `node --check src/ui.js`
Expected: 출력 없음.

- [ ] **Step 3: 커밋**

```bash
git add src/ui.js
git commit -m "feat(app): ui.js render with round-based progress + image fallback"
```

### Task B7: game.js (배선 + 흐름)

**Files:**
- Modify: `src/game.js` (B1의 부트스트랩을 전체 흐름으로 확장)

**Interfaces:**
- Consumes: `window.KkutuEngine`, `ui.makeUI`, `drag.attachCard/attachListen`, `tts.*`, `effect.*`, `data/word-images.json`.

- [ ] **Step 1: game.js 전체 작성**

```js
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
```

- [ ] **Step 2: 문법 확인**

Run: `node --check src/game.js`
Expected: top-level await 때문에 node --check가 실패할 수 있음 → 대신 모듈 문맥 확인: `node --input-type=module --check < src/game.js`
Expected: 출력 없음.

- [ ] **Step 3: 커밋**

```bash
git add src/game.js
git commit -m "feat(app): game.js wiring (engine+ui+drag+tts+effect), round flow"
```

### Task B8: 통합 검증 (localhost)

**Files:** 없음(검증).

- [ ] **Step 1: 엔진 회귀**

Run: `node test/engine.test.js`
Expected: `✅ 모든 검증 통과`, `won=5000`.

- [ ] **Step 2: 앱 동작 확인**

Run: `python3 -m http.server 8000` 후 `http://localhost:8000`.
체크리스트(각각 눈으로 확인):
- 첫 화면에 제시 단어(그림 또는 글자) + 보기 카드 2~3개 + ?칸 표시, 진행 8칸 중 일부 done.
- 보기 카드 **누르면 단어 음성**(ko-KR), **드래그→?칸 위에서 글로우+별**, 손 떼면 스냅 확정.
- 확정 후 "직전단어→연결글자→내답" 순 **낭독+펄스**, 그다음 라운드 갱신(AI가 다음 단어 놓음).
- 제시 단어 카드/연결고리칸 **탭하면 해당 단어·글자 음성**.
- 2라운드(8단어) 완료 시 **"다 이었어요!"** 종료 화면, 체크 버튼 누르면 새 판.
- **그림 없는 단어**(예: 김밥, 펭귄)는 글자만 깔끔히 표시(깨진 이미지 아이콘 없음).
- 콘솔 에러 없음.

- [ ] **Step 3: 최종 커밋(필요 시)**

```bash
git add -A
git commit -m "test(app): verify new-model modular app on localhost" --allow-empty
```

---

## Self-Review 메모

- **Spec 커버리지:** 레포 구조(§3)→A1~A3, src 6모듈(§4)→B2~B7, 새 엔진/모델(§1.5)→B1/B7, 그림 폴백(§6.1)→B6/A3, 검증(§7)→B8. 목업 껍데기(§6.2)·한승 html(§6.3)·미사용 이미지(§6.5)는 **열린 항목으로 남김**(이 계획서 범위 밖, 후속 결정).
- **알려진 한계:** DOM/드래그/TTS는 헤드리스 테스트가 없어 B8에서 **육안 검증**한다(프로토타입 한계, 정직하게 명시). 엔진만 자동 회귀.
- **font:** 단순화를 위해 ttf 직접 사용(spec의 woff2 변환은 후속 최적화).
