# 끝말잇기 프론트엔드 프로토타입 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 `backend/kkutu-engine.js` 게임 엔진에 연결되는 최소 플레이어블 HTML+CSS 프로토타입을 만들어, 브라우저에서 한 판을 끝까지(5턴) 플레이할 수 있게 한다.

**Architecture:** 프레임워크·번들러 없는 3파일 분리(B안). `index.html`(구조) + `style.css`(스타일) + `app.js`(UI 레이어). 엔진은 전역 `KkutuEngine`로 로드하고, `app.js`는 ① 엔진 호출(start/answer) ② `state` → 화면 렌더만 담당한다. 상태는 엔진이 단독 소유하며 `app.js`는 매번 `state`로 화면만 다시 그린다. `app.js`는 엔진과 동일한 UMD 패턴으로 감싸 순수 함수 `toView(state)`를 Node에서 단위 테스트할 수 있게 한다.

**Tech Stack:** 순수 JavaScript(ES2017), HTML5, CSS3. 테스트는 Node 내장 `assert`. 로컬 정적 서버는 `python3 -m http.server`.

## Global Constraints

- 프레임워크·번들러·외부 의존성 금지. 순수 JS만 사용한다.
- `backend/` 안의 파일(`kkutu-engine.js`, JSON)은 수정하지 않는다.
- 엔진 옵션은 `{ targetAnswers: 5 }`. 보기는 엔진이 주는 그대로(전부 정답) 사용 — 오답 추가 안 함.
- 단어 데이터 경로(프론트 기준 상대경로): `../backend/kids_nouns_safe_2plus.json`.
- 엔진 스크립트 경로: `../backend/kkutu-engine.js`.
- 실행은 로컬 서버로만: `python3 -m http.server 8000` → `http://localhost:8000/frontend/`.
- 엔진 공개 API: `new KkutuEngine(words, opts)`, `engine.start(startWord?)`, `engine.answer(word)`. `state` 형태: `{ status, currentSyllable, options, childAnswers, targetAnswers, lastWord, history, usedCount, category }`. `status` 값: `'idle' | 'playing' | 'won' | 'lost'`.

---

## 파일 구조

```
word-chain/
├─ backend/                  ← 그대로 (수정 없음)
│   ├─ kkutu-engine.js
│   └─ kids_nouns_safe_2plus.json
└─ frontend/                 ← 신규 (기존 1byte 'frontend' 파일 제거 후 디렉토리 생성)
    ├─ index.html            ← 구조 + 엔진/JSON 로드
    ├─ style.css             ← 최소 스타일
    ├─ app.js                ← UI 레이어 (UMD; toView 순수함수 + DOM 렌더/와이어링)
    └─ test-app.js           ← Node 단위 테스트 (toView)
```

각 파일 책임:
- `app.js` — 순수 함수 `toView(state)`(state→렌더용 view 객체)와, 브라우저에서만 도는 DOM 함수 `init/render/onCardClick`. UMD로 감싸 Node에서 `toView`를 import 가능.
- `test-app.js` — `toView`의 동작을 Node `assert`로 검증.
- `index.html` — 시멘틱 골격 + `kkutu-engine.js`, `app.js` 로드.
- `style.css` — 아이용 큰 카드/자막 최소 스타일.

---

## Task 1: 순수 view 함수 `toView(state)` + 테스트

**Files:**
- Create: `frontend/app.js`
- Test: `frontend/test-app.js`
- 선행 정리: 기존 1byte 파일 `frontend`(파일) 제거 후 `frontend/`(디렉토리) 생성

**Interfaces:**
- Consumes: 엔진 `state` 객체 리터럴(테스트에서 직접 만듦). 실제 엔진은 Task 2에서 연결.
- Produces: `toView(state) -> { status: string, progress: string, prompt: string, lastWord: string|null, options: string[] }`. 다른 Task(2)의 `render`가 이 함수를 사용한다.

- [ ] **Step 1: 기존 stray 파일 제거 후 디렉토리 생성**

```bash
rm -f frontend && mkdir -p frontend
```

- [ ] **Step 2: 실패하는 테스트 작성**

Create `frontend/test-app.js`:

```js
// toView 순수 함수 단위 테스트 (Node)
const assert = require('assert');
const { toView } = require('./app.js');

// 1) 플레이 중 상태
const playing = toView({
  status: 'playing',
  childAnswers: 1,
  targetAnswers: 5,
  currentSyllable: '소',
  lastWord: '염소',
  options: ['소금', '소나무'],
});
assert.strictEqual(playing.status, 'playing');
assert.strictEqual(playing.progress, '1 / 5');
assert.strictEqual(playing.prompt, "'소'(으)로 시작하는 말은?");
assert.strictEqual(playing.lastWord, '염소');
assert.deepStrictEqual(playing.options, ['소금', '소나무']);

// 2) options 원본을 복사하는지(외부 변형 방지)
const src = ['가지', '가방'];
const v = toView({ status: 'playing', childAnswers: 0, targetAnswers: 5, currentSyllable: '가', lastWord: '바다가', options: src });
v.options.push('침입');
assert.deepStrictEqual(src, ['가지', '가방']);

// 3) 완주(won) 상태
const won = toView({ status: 'won', childAnswers: 5, targetAnswers: 5, currentSyllable: '소', lastWord: '바나나', options: [] });
assert.strictEqual(won.status, 'won');
assert.deepStrictEqual(won.options, []);

// 4) currentSyllable 없을 때 prompt는 빈 문자열
const idle = toView({ status: 'idle', childAnswers: 0, targetAnswers: 5, currentSyllable: null, lastWord: null, options: [] });
assert.strictEqual(idle.prompt, '');
assert.strictEqual(idle.lastWord, null);

console.log('toView: all tests passed');
```

- [ ] **Step 3: 테스트 실행해 실패 확인**

Run: `cd frontend && node test-app.js`
Expected: FAIL — `Cannot find module './app.js'` (아직 app.js 없음)

- [ ] **Step 4: 최소 구현 작성**

Create `frontend/app.js`:

```js
/**
 * 끝말잇기 UI 레이어.
 * UMD: 브라우저에서는 전역 App, Node(테스트)에서는 module.exports.
 * 순수 함수 toView(state)만 우선 구현. DOM 렌더는 Task 2에서 추가.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.App = factory();
})(typeof self !== 'undefined' ? self : this, function () {

  /** 엔진 state -> 화면 렌더용 view 객체 (순수 함수, 부수효과 없음) */
  function toView(state) {
    return {
      status: state.status,
      progress: state.childAnswers + ' / ' + state.targetAnswers,
      prompt: state.currentSyllable
        ? "'" + state.currentSyllable + "'(으)로 시작하는 말은?"
        : '',
      lastWord: state.lastWord != null ? state.lastWord : null,
      options: state.options ? state.options.slice() : [],
    };
  }

  return { toView };
});
```

- [ ] **Step 5: 테스트 실행해 통과 확인**

Run: `cd frontend && node test-app.js`
Expected: PASS — `toView: all tests passed`

- [ ] **Step 6: 커밋**

```bash
git add frontend/app.js frontend/test-app.js
git rm --cached frontend 2>/dev/null || true
git commit -m "feat(frontend): add pure toView state mapper with tests"
```

---

## Task 2: HTML 골격 + DOM 렌더/와이어링

**Files:**
- Create: `frontend/index.html`
- Modify: `frontend/app.js` (UMD factory 안에 `init`/`render`/`onCardClick`와 DOM 가드 블록 추가)

**Interfaces:**
- Consumes: Task 1의 `toView(state)`; 전역 `KkutuEngine`(엔진 스크립트); JSON `../backend/kids_nouns_safe_2plus.json`의 `data.words`.
- Produces: 브라우저에서 자동 실행되는 게임 화면. 별도 export 추가 없음(`toView`만 export 유지).

- [ ] **Step 1: index.html 작성**

Create `frontend/index.html`:

```html
<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>끝말잇기</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <main id="app">
    <header>
      <div id="progress"></div>
      <h1 id="prompt">불러오는 중…</h1>
    </header>
    <section id="stage">
      <div id="last-word"></div>
    </section>
    <section id="options"></section>
    <section id="result" hidden>
      <p id="result-msg"></p>
      <button id="restart">다시하기</button>
    </section>
  </main>
  <script src="../backend/kkutu-engine.js"></script>
  <script src="app.js"></script>
</body>
</html>
```

- [ ] **Step 2: app.js에 DOM 함수와 가드 블록 추가**

Modify `frontend/app.js` — `function toView(state) {...}` 정의 바로 다음, `return { toView };` 바로 앞에 아래 코드를 삽입한다:

```js
  // --- 브라우저 DOM 레이어 -------------------------------------------------
  let engine = null;

  async function init() {
    const promptEl = document.getElementById('prompt');
    try {
      const res = await fetch('../backend/kids_nouns_safe_2plus.json');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      engine = new KkutuEngine(data.words, { targetAnswers: 5 });
      render(engine.start());
    } catch (e) {
      promptEl.textContent = '단어 데이터를 불러오지 못했습니다. 로컬 서버(python3 -m http.server)로 실행했는지 확인하세요.';
    }
  }

  function render(state) {
    const v = toView(state);
    document.getElementById('progress').textContent = v.progress;
    document.getElementById('last-word').textContent = v.lastWord || '';
    const promptEl = document.getElementById('prompt');
    const optionsEl = document.getElementById('options');
    const resultEl = document.getElementById('result');

    if (v.status === 'playing') {
      promptEl.textContent = v.prompt;
      resultEl.hidden = true;
      optionsEl.hidden = false;
      optionsEl.innerHTML = '';
      for (const word of v.options) {
        const btn = document.createElement('button');
        btn.className = 'card';
        btn.textContent = word;
        btn.addEventListener('click', function () { onCardClick(word); });
        optionsEl.appendChild(btn);
      }
    } else {
      optionsEl.hidden = true;
      optionsEl.innerHTML = '';
      resultEl.hidden = false;
      promptEl.textContent = v.status === 'won' ? '성공! 🎉' : '아쉽지만 끝났어요';
      document.getElementById('result-msg').textContent =
        v.status === 'won' ? '끝까지 잘 이었어요!' : '';
    }
  }

  function onCardClick(word) {
    render(engine.answer(word));
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', function () {
      document.getElementById('restart').addEventListener('click', function () {
        render(engine.start());
      });
      init();
    });
  }

```

- [ ] **Step 3: toView 단위 테스트가 여전히 통과하는지 확인 (회귀 방지)**

Run: `cd frontend && node test-app.js`
Expected: PASS — `toView: all tests passed` (DOM 코드는 `typeof document` 가드로 Node에서 건너뜀)

- [ ] **Step 4: 브라우저에서 수동 확인**

Run:
```bash
cd /Users/yunki/Claude/Projects/word-chain
python3 -m http.server 8000
```
브라우저에서 `http://localhost:8000/frontend/` 열기.
Expected:
- 상단에 진행도 `0 / 5`와 "'X'(으)로 시작하는 말은?" 자막이 보인다.
- 보기 카드 2~3개가 보이고, 클릭하면 진행도가 오르고 다음 음절로 바뀐다.
- 개발자도구 콘솔에 에러가 없다.
(확인 후 서버는 Ctrl+C로 종료)

- [ ] **Step 5: 커밋**

```bash
git add frontend/index.html frontend/app.js
git commit -m "feat(frontend): wire engine to DOM render and play flow"
```

---

## Task 3: 최소 스타일링 (아이용 큰 카드/자막)

**Files:**
- Create: `frontend/style.css`

**Interfaces:**
- Consumes: `index.html`의 id/class — `#app`, `#progress`, `#prompt`, `#stage`, `#last-word`, `#options`, `.card`, `#result`, `#restart`.
- Produces: 시각 스타일만. JS 동작 변경 없음.

- [ ] **Step 1: style.css 작성**

Create `frontend/style.css`:

```css
* { box-sizing: border-box; }

body {
  margin: 0;
  font-family: "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif;
  background: #f3f7ff;
  color: #1d2540;
}

#app {
  max-width: 720px;
  margin: 0 auto;
  min-height: 100vh;
  padding: 24px 16px 40px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
}

#progress {
  align-self: flex-end;
  font-size: 20px;
  font-weight: 700;
  color: #5566aa;
}

#prompt {
  font-size: 34px;
  font-weight: 800;
  text-align: center;
  margin: 8px 0;
}

#stage { min-height: 80px; display: flex; align-items: center; }

#last-word {
  font-size: 48px;
  font-weight: 800;
  color: #2a6df4;
  padding: 8px 24px;
  background: #fff;
  border-radius: 20px;
  box-shadow: 0 6px 18px rgba(42, 109, 244, 0.15);
}

#options {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 18px;
  width: 100%;
}

.card {
  font-family: inherit;
  font-size: 36px;
  font-weight: 800;
  padding: 28px 36px;
  min-width: 160px;
  border: none;
  border-radius: 24px;
  background: #fff;
  color: #1d2540;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.10);
  cursor: pointer;
  transition: transform 0.08s ease, box-shadow 0.08s ease;
}

.card:hover { transform: translateY(-3px); box-shadow: 0 10px 22px rgba(0, 0, 0, 0.14); }
.card:active { transform: translateY(0); }

#result { text-align: center; }
#result-msg { font-size: 24px; font-weight: 700; margin: 8px 0 16px; }

#restart {
  font-family: inherit;
  font-size: 24px;
  font-weight: 800;
  padding: 16px 32px;
  border: none;
  border-radius: 18px;
  background: #2a6df4;
  color: #fff;
  cursor: pointer;
}
```

- [ ] **Step 2: 브라우저에서 수동 확인**

Run:
```bash
cd /Users/yunki/Claude/Projects/word-chain
python3 -m http.server 8000
```
`http://localhost:8000/frontend/` 새로고침.
Expected:
- 카드가 크고 둥글게, 자막이 크게 보인다.
- 카드에 마우스 올리면 살짝 떠오른다.
- 레이아웃이 한 화면에 깔끔히 들어온다.
(확인 후 Ctrl+C)

- [ ] **Step 3: 커밋**

```bash
git add frontend/style.css
git commit -m "feat(frontend): add kid-friendly card and prompt styling"
```

---

## Task 4: 엔드투엔드 한 판 완주 수동 검증

**Files:** (코드 변경 없음 — 통합 검증 전용)

**Interfaces:**
- Consumes: Task 1~3의 전체 결과.
- Produces: 한 판 완주가 동작한다는 확인. 문제가 있으면 해당 Task로 돌아가 수정.

- [ ] **Step 1: 회귀 테스트 실행**

Run: `cd frontend && node test-app.js`
Expected: PASS — `toView: all tests passed`

- [ ] **Step 2: 브라우저에서 한 판 끝까지 플레이**

Run:
```bash
cd /Users/yunki/Claude/Projects/word-chain
python3 -m http.server 8000
```
`http://localhost:8000/frontend/`에서 카드를 5번 눌러 끝까지 진행.
Expected:
- 매 차례 보기가 2~3개 나오고, 모두 현재 음절로 시작한다.
- 진행도가 `0/5 → 5/5`로 오른다.
- 마지막에 "성공! 🎉"과 "다시하기" 버튼이 보인다.
- "다시하기"를 누르면 새 판이 시작된다.
- 도중에 보기가 0개가 되거나 막히는 경우가 없다(여러 번 다시하기로 반복 확인).
- 콘솔 에러 없음.
(확인 후 Ctrl+C)

- [ ] **Step 3: 최종 커밋(필요 시)**

이전 Task에서 모두 커밋되었다면 추가 커밋 없음. 검증 중 수정이 있었다면:

```bash
git add -A && git commit -m "fix(frontend): address e2e verification findings"
```

---

## Self-Review

- **Spec 커버리지:**
  - 엔진 연결 + 한 판 플레이 → Task 1·2.
  - 시작어/자막/보기 카드/진행도/완주 표시 → Task 2(렌더) + Task 3(스타일).
  - 3파일 분리(B안) → Task 1~3에서 index.html/style.css/app.js 생성(+테스트 파일).
  - 기존 1byte `frontend` 파일 제거 후 디렉토리화 → Task 1 Step 1.
  - 보기는 전부 정답(오답 미추가), `targetAnswers: 5` → Global Constraints + Task 2 코드.
  - 로컬 서버 실행 → Task 2·3·4 검증 스텝.
  - JSON fetch 실패 안내 → Task 2 `init`의 catch.
  - 방어적 `lost` 처리 → Task 2 `render`의 else 분기.
  - 비목표(오답/10라운드/TTS/그림/애니메이션/사용단어 정리) → 계획에서 제외(스펙과 일치).
- **플레이스홀더 스캔:** 없음. 모든 코드 스텝에 실제 코드 포함.
- **타입 일관성:** `toView`가 반환하는 `{ status, progress, prompt, lastWord, options }`를 Task 2 `render`가 동일 키로 소비. 엔진 `state` 키(`status/currentSyllable/options/childAnswers/targetAnswers/lastWord`)와 일관.
