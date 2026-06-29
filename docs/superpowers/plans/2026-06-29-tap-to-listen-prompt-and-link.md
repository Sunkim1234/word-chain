# 제시 단어 카드 · 연결고리칸 탭-투-리슨(TTS) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** v2 목업에서 상단 제시 단어 카드(`.now__card`)와 연결고리칸 글자(`#linkTok`)를 누르면 각각 현재 단어/글자를 TTS로 재생한다.

**Architecture:** 정답 카드의 드래그 로직(`attachCard`)과 별개로, 드래그 없이 "탭=듣기"만 처리하는 가벼운 헬퍼 `attachListen(el, getText)`를 추가한다. 두 대상 노드는 라운드마다 재생성되지 않으므로 초기화 시 한 번만 바인딩하고, 내용은 `getText` 콜백으로 매번 최신 `state` 값을 읽는다.

**Tech Stack:** 순수 HTML/CSS/JS 단일 파일 목업(`frontend/v2/mockup/mockup.html`), Web Speech API(`speechSynthesis`).

## Global Constraints

- 대상 파일은 `frontend/v2/mockup/mockup.html` 하나만 수정한다. v1·다른 화면 변경 금지.
- 트리거는 정답 카드와 동일하게 `pointerdown` 즉시 재생.
- 재생은 **내 차례에만**: `locked` 이거나 `state.status !== 'playing'` 이면 무시.
- 탭 피드백은 기존 `chainPulse(el)` 재사용. 새 애니메이션 CSS 추가 금지.
- 자동화 테스트 프레임워크가 없으므로 검증은 브라우저 수동 확인으로 한다.

---

### Task 1: `attachListen` 헬퍼 추가 + 두 요소 바인딩

**Files:**
- Modify: `frontend/v2/mockup/mockup.html` — `attachCard` 함수 정의 직후(약 632줄, `}` 닫힘 다음)에 헬퍼 추가; `prompt__speaker` 클릭 핸들러 옆(약 779줄)에 바인딩 추가.

**Interfaces:**
- Consumes (파일 내 기존 심볼): 전역 변수 `locked`, `state`(`state.status`, `state.lastWord`, `state.currentSyllable`), 함수 `speak(text)`, `chainPulse(el)`, 헬퍼 `$ = id => document.getElementById(id)`.
- Produces: `function attachListen(el, getText)` — `el`에 `pointerdown` 리스너를 붙여, 내 차례일 때만 `speak(getText())` + `chainPulse(el)` 실행.

- [ ] **Step 1: `attachListen` 헬퍼 추가**

`attachCard` 함수의 닫는 `}`(약 632줄) 바로 다음 줄에 삽입:

```js
  // 드래그 없는 요소용: 탭=듣기 (제시 단어 카드 / 연결고리칸)
  function attachListen(el, getText) {
    el.addEventListener('pointerdown', () => {
      if (locked || state.status !== 'playing') return;  // 내 차례에만
      speak(getText());                                   // 누르는 즉시 재생
      chainPulse(el);                                     // 펄스 피드백
    });
  }
```

- [ ] **Step 2: 두 요소 바인딩 추가**

`prompt__speaker` 클릭 핸들러 블록(약 779–781줄) 바로 다음에 삽입:

```js
  // 제시 단어 카드 / 연결고리칸: 누르면 해당 단어·글자 듣기
  attachListen(document.querySelector('.now__card'), () => state.lastWord);
  attachListen($('linkTok'), () => state.currentSyllable);
```

- [ ] **Step 3: 브라우저에서 동작 확인**

`frontend/v2/mockup/mockup.html`을 브라우저로 연다(예: `open frontend/v2/mockup/mockup.html`).
확인 항목:
- 내 차례에 상단 단어 카드를 누르면 그 단어가 들리고 카드가 `chainpop` 펄스를 보인다.
- 내 차례에 연결고리칸 글자를 누르면 그 글자가 들리고 펄스를 보인다.
- 정답을 드래그한 직후 체인 낭독(locked) 중에는 두 요소를 눌러도 반응 없음.
- 기존 정답 카드 드래그/탭, `prompt__speaker` 버튼은 그대로 동작.

Expected: 위 4개 항목 모두 충족.

- [ ] **Step 4: Commit**

```bash
git add frontend/v2/mockup/mockup.html
git commit -m "feat(mockup): tap-to-listen on prompt card and link token"
```

---

### Task 2: 접근성 / 어포던스 속성 추가

**Files:**
- Modify: `frontend/v2/mockup/mockup.html` — HTML 본문 `.now__card`(약 192줄)와 `#linkTok`(약 196줄) 요소; CSS 영역(`.now__card` / `.link__tok` 규칙 근처)에 `cursor: pointer` 추가.

**Interfaces:**
- Consumes: Task 1에서 바인딩한 두 요소.
- Produces: 시각/스크린리더 어포던스만 추가. JS 동작 변경 없음.

- [ ] **Step 1: HTML에 role/aria/tabindex 추가**

`.now__card` 여는 태그(약 192줄)를 다음으로 교체:

```html
          <div class="now__card" role="button" tabindex="0" aria-label="단어 다시 듣기">
```

`#linkTok` `span`(약 196줄) 안의 해당 토큰을 다음으로 교체:

```html
<span class="link__tok" id="linkTok" role="button" tabindex="0" aria-label="글자 듣기"></span>
```

- [ ] **Step 2: CSS에 cursor: pointer 추가**

`.now__card` 규칙과 `.link__tok` 규칙(CSS 영역, 약 1줄대 `<style>` 내부)에 각각 `cursor:pointer;` 선언을 추가한다. 해당 셀렉터를 찾아(예: 에디터 검색 `.now__card {`, `.link__tok {`) 기존 선언 뒤에 `cursor:pointer;`를 넣는다.

예시(`.link__tok` 규칙이 `.link__tok { ... }` 형태라면):

```css
  .link__tok { /* 기존 선언들 */ cursor:pointer; }
```

`.now__card`도 동일하게 `cursor:pointer;` 추가.

- [ ] **Step 3: 브라우저에서 확인**

`frontend/v2/mockup/mockup.html`을 새로고침.
확인 항목:
- 두 요소 위에 마우스를 올리면 포인터(손가락) 커서가 보인다.
- Task 1의 탭→재생 동작이 여전히 정상.

Expected: 커서 변경 + 재생 동작 유지.

- [ ] **Step 4: Commit**

```bash
git add frontend/v2/mockup/mockup.html
git commit -m "feat(mockup): a11y affordances for tap-to-listen targets"
```

---

## Self-Review

**1. Spec coverage:**
- 공통 헬퍼 `attachListen` → Task 1 Step 1 ✓
- `.now__card` → `speak(state.lastWord)`, `#linkTok` → `speak(state.currentSyllable)` → Task 1 Step 2 ✓
- 트리거 pointerdown 즉시, 내 차례에만, chainPulse 피드백 → Task 1 Step 1 ✓
- 초기화 시 한 번만 바인딩 → Task 1 Step 2(핸들러 영역 1회 삽입) ✓
- 접근성(cursor/role/aria-label/tabindex) → Task 2 ✓
- 부작용(intro/chainpop 충돌 없음) → chainPulse 재사용으로 자동 충족, 별도 작업 불필요 ✓
- 범위 밖(롱프레스/locked 중 허용/v1) → 계획에 포함 안 함 ✓

**2. Placeholder scan:** "TBD"/"적절히"/"등" 모호 표현 없음. 모든 코드 단계에 실제 코드 포함. (Task 2 Step 2의 CSS는 한 줄 셀렉터 특성상 검색 위치를 지정 — 실제 추가 선언 `cursor:pointer;`는 명시됨.)

**3. Type consistency:** `attachListen(el, getText)` 시그니처가 정의(Task 1 Step 1)와 호출(Task 1 Step 2)에서 일치. `state.lastWord`/`state.currentSyllable`/`speak`/`chainPulse`/`$`는 기존 파일 심볼과 일치(소스 확인 완료).
