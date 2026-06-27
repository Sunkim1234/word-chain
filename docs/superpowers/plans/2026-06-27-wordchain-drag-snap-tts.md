# 끝말잇기 V1 — 드래그 스냅 + TTS 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 보기 카드를 빈 칸으로 직접 드래그해(살짝 걸치면 스냅) 정답을 내고, 탭/꾹누르기로 단어를 한국어 TTS로 듣게 한다.

**Architecture:** 모든 UI(CSS·JS·HTML)는 `frontend/v1/mockup/build.py`의 f-string 안에 있고, `python3 build.py`가 `mockup.html`을 생성한다. 기존 탭-자동이동(`onPick`)을 Pointer Events 기반 제스처 컨트롤러로 교체한다: 8px 넘게 움직이면 드래그(카드 사각형이 드롭존 사각형과 겹치면 armed, 손 떼면 확정), 그 미만이면 탭/롱프레스로 TTS. 엔진(`KkutuEngine`)·라운드 렌더링·진행 표시·종료 화면은 변경하지 않고 기존 `commit()`/`advance()` 흐름을 재사용한다.

**Tech Stack:** Python 3 + fontTools(빌드), 순수 HTML/CSS/JS(런타임), Pointer Events API, Web Speech API(`speechSynthesis`). 외부 런타임 라이브러리 없음.

## Global Constraints

- **모든 코드 수정은 `frontend/v1/mockup/build.py`에서** 한다. `mockup.html`은 산출물이므로 직접 편집 금지.
- build.py는 f-string이라 JS/CSS의 중괄호는 `{{` `}}`로 이스케이프해야 한다. (이미 그렇게 작성되어 있음 — 추가 코드도 동일 규칙.)
- 자동화 테스트 프레임워크 없음. 각 태스크 검증 = `python3 build.py` 성공 + 산출물 토큰 grep + 아티팩트 육안 확인.
- 새 색을 도입하지 않는다. 기존 팔레트만 사용: `--couple #EE9740`, `--couple-soft #FCE8D0`, `--success #54B98A`, `--card-edge #F1B53C`.
- `prefers-reduced-motion: reduce`에서 떠오름·기울기·바운스·파티클·맥동을 제거한다(직접 추종/즉시 스냅만 유지). 코드의 `reduceMotion` 상수로 분기.
- 보기 카드(`.opt`)에만 적용. 직전 단어 카드(`.now__card`)·말하기 버튼(`.opt--voice`)은 드래그/TTS 대상 아님(말하기 버튼은 기존대로 표시만).
- 엔진이 보기를 전부 정답으로 보장하므로 "틀린 카드" 분기는 만들지 않는다.
- 재빌드 후 작업 디렉터리는 `frontend/v1/mockup/`.

---

## Task 1: 드래그로 답하기 (+ 탭/롱프레스 → speak 스텁)

탭-자동이동을 제거하고 Pointer Events 드래그 컨트롤러로 교체한다. 카드를 끌어 드롭존에 살짝 걸친 채(armed) 손을 떼면 확정, 밖에서 떼면 원래 자리로 복귀. 탭/롱프레스는 `speak(word, card)`를 호출하되 이 태스크에서는 `speak`가 빈 스텁(다음 태스크에서 구현). 이 태스크 완료 시 목업은 드래그로 완전히 플레이 가능하다.

**Files:**
- Modify: `frontend/v1/mockup/build.py` (CSS 블록 ~152행 뒤, 키프레임 ~195행 뒤, JS 275행 / 293–307행)

**Interfaces:**
- Consumes: 기존 전역 `state`, `locked`, `IMG`, `reduceMotion`, `$()`, `commit(word)`.
- Produces (이후 태스크가 의존):
  - `attachCard(cardEl, word)` — 보기 카드에 제스처 핸들러를 붙임.
  - `armDrop(word)` / `disarmDrop()` — 드롭존 armed 진입/해제(고스트 미리보기 토글).
  - `isOverDrop(cardEl) → bool`, `rectsOverlap(a, b) → bool`.
  - `snapCommit(cardEl, word, curDx, curDy)`, `springBack(cardEl)`.
  - `speak(word, card)` — 이 태스크에선 빈 스텁. Task 2가 본문 구현.

- [ ] **Step 1: 드래그/armed/고스트 CSS 추가**

`build.py`에서 아래 줄(152행)

```python
  .drop--filled .opt__word {{ font-family:var(--display); font-size:4.7cqmin; }}
```

바로 뒤에 다음 블록을 삽입한다:

```python

  /* ── 드래그 상호작용 ───────────────────────────────────────────── */
  /* 드래그 중: 인라인 transform 으로 손가락을 즉각 추종(트랜지션 제거) */
  .opt.dragging {{ z-index:30; cursor:grabbing; transition:none;
    box-shadow:0 24px 44px rgba(56,68,79,.24); }}
  .opt.dimmed {{ opacity:.4; }}
  /* 빈 칸 밖에서 놓으면 원래 자리로 탄력 복귀 */
  .opt.springback {{ transition:transform .34s cubic-bezier(.34,1.32,.5,1); }}
  /* armed: 카드가 빈 칸에 걸친 상태 — 실선 + 글로우 + 맥동 */
  .drop.armed {{ border-style:solid;
    box-shadow:0 0 0 0.6cqmin var(--couple-soft), 0 0 4cqmin 0.6cqmin rgba(238,151,64,.55);
    animation:armedPulse 1s ease-in-out infinite; }}
  /* armed 고스트 미리보기(빈 칸 안 .opt 자식의 크기 정의) */
  .drop .opt__pic {{ width:16.5cqmin; height:16.5cqmin; object-fit:contain; }}
  .drop .opt__word {{ font-family:var(--display); font-size:4.7cqmin; }}
  .drop__ghost {{ opacity:.45; }}
```

- [ ] **Step 2: armedPulse 키프레임 추가**

`build.py`에서 아래 줄(195행)

```python
  @keyframes pop {{ 0%{{ transform:scale(.82); }} 60%{{ transform:scale(1.04); }} 100%{{ transform:scale(1); }} }}
```

바로 뒤에 다음을 삽입한다:

```python
  @keyframes armedPulse {{
    0%,100%{{ box-shadow:0 0 0 0.6cqmin var(--couple-soft), 0 0 4cqmin 0.6cqmin rgba(238,151,64,.45); }}
    50%{{ box-shadow:0 0 0 0.9cqmin var(--couple-soft), 0 0 6cqmin 1cqmin rgba(238,151,64,.75); }} }}
```

(`@media (prefers-reduced-motion:reduce) {{ *{{ animation:none!important; }} }}`이 이미 199행에 있어 armedPulse는 자동으로 꺼진다.)

- [ ] **Step 3: 카드 이벤트 바인딩을 attachCard로 교체**

`build.py` 275행

```python
      b.addEventListener('click', () => onPick(w, b));
```

를 다음으로 교체한다:

```python
      attachCard(b, w);
```

- [ ] **Step 4: onPick을 제스처 컨트롤러로 교체**

`build.py`의 `onPick` 함수 전체(293–307행)

```python
  function onPick(word, btn) {{
    if (locked || state.status !== 'playing') return;
    locked = true;
    if (reduceMotion) {{ commit(word); return; }}
    // 날아가는 연출은 곁다리 — 게임 진행은 transitionend가 아니라 보장된 타이머로 한다.
    const c = btn.getBoundingClientRect(), dr = $('drop').getBoundingClientRect();
    const dx = (dr.left + dr.width / 2) - (c.left + c.width / 2);
    const dy = (dr.top + dr.height / 2) - (c.top + c.height / 2);
    const scale = dr.width / c.width;
    btn.parentNode.querySelectorAll('.opt').forEach(o => {{ if (o !== btn) o.style.opacity = '0.35'; }});
    btn.style.zIndex = '30';
    btn.style.transition = 'transform .38s cubic-bezier(.34,1.15,.5,1)';
    requestAnimationFrame(() => {{ btn.style.transform = 'translate(' + dx + 'px,' + dy + 'px) scale(' + scale + ')'; }});
    setTimeout(() => commit(word), 400);
  }}
```

를 다음으로 교체한다:

```python
  // ── 입력: 드래그=답하기, 탭/롱프레스=듣기 ───────────────────────────
  const DRAG_THRESH = 8;   // px. 이만큼 움직이면 드래그로 간주

  function rectsOverlap(a, b) {{
    return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  }}
  function isOverDrop(card) {{
    return rectsOverlap(card.getBoundingClientRect(), $('drop').getBoundingClientRect());
  }}
  function armDrop(word) {{
    const drop = $('drop');
    if (drop.classList.contains('armed')) return;
    drop.classList.add('armed');
    drop.innerHTML = '<img class="opt__pic drop__ghost" src="' + (IMG[word] || '') + '" alt="">' +
                     '<span class="opt__word drop__ghost">' + word + '</span>';
  }}
  function disarmDrop() {{
    const drop = $('drop');
    if (!drop.classList.contains('armed')) return;
    drop.classList.remove('armed');
    drop.innerHTML = '<span class="drop__q">?</span>';
  }}

  function attachCard(card, word) {{
    let pid = null, sx = 0, sy = 0, dx = 0, dy = 0, dragging = false, spoke = false, lpTimer = null;

    card.addEventListener('pointerdown', e => {{
      if (locked || state.status !== 'playing') return;
      pid = e.pointerId; sx = e.clientX; sy = e.clientY; dx = dy = 0;
      dragging = false; spoke = false;
      card.setPointerCapture(pid);
      lpTimer = setTimeout(() => {{ if (!dragging) {{ speak(word, card); spoke = true; }} }}, 400);
    }});

    card.addEventListener('pointermove', e => {{
      if (pid === null) return;
      dx = e.clientX - sx; dy = e.clientY - sy;
      if (!dragging && Math.hypot(dx, dy) > DRAG_THRESH) {{
        dragging = true; clearTimeout(lpTimer);
        card.classList.add('dragging');
        card.parentNode.querySelectorAll('.opt').forEach(o => {{ if (o !== card) o.classList.add('dimmed'); }});
      }}
      if (dragging) {{
        card.style.transform = reduceMotion
          ? 'translate(' + dx + 'px,' + dy + 'px)'
          : 'translate(' + dx + 'px,' + dy + 'px) scale(1.05) rotate(-2deg)';
        if (isOverDrop(card)) armDrop(word); else disarmDrop();
      }}
    }});

    card.addEventListener('pointerup', e => {{
      if (pid === null) return;
      clearTimeout(lpTimer);
      const id = pid; pid = null;
      try {{ card.releasePointerCapture(id); }} catch (_) {{}}
      if (!dragging) {{ if (!spoke) speak(word, card); return; }}   // 탭 = 듣기
      card.classList.remove('dragging');
      disarmDrop();
      if (isOverDrop(card)) snapCommit(card, word, dx, dy);
      else springBack(card);
    }});

    card.addEventListener('pointercancel', () => {{
      if (pid === null) return;
      clearTimeout(lpTimer); pid = null;
      if (dragging) {{ card.classList.remove('dragging'); disarmDrop(); springBack(card); }}
    }});
  }}

  function springBack(card) {{
    card.parentNode.querySelectorAll('.opt.dimmed').forEach(o => o.classList.remove('dimmed'));
    if (reduceMotion) {{ card.style.transform = ''; return; }}
    card.classList.add('springback');
    card.style.transform = '';
    card.addEventListener('transitionend', function h() {{
      card.classList.remove('springback'); card.style.transition = '';
      card.removeEventListener('transitionend', h);
    }});
  }}

  // armed 상태에서 손 뗌 → 카드가 빈 칸 중앙으로 정렬되며 확정
  function snapCommit(card, word, curDx, curDy) {{
    locked = true;
    if (reduceMotion) {{ card.style.visibility = 'hidden'; commit(word); return; }}
    const dr = $('drop').getBoundingClientRect();
    const c = card.getBoundingClientRect();
    const newDx = curDx + (dr.left + dr.width / 2) - (c.left + c.width / 2);
    const newDy = curDy + (dr.top + dr.height / 2) - (c.top + c.height / 2);
    const scale = dr.width / card.offsetWidth;
    card.style.transition = 'transform .26s cubic-bezier(.34,1.2,.5,1)';
    requestAnimationFrame(() => {{
      card.style.transform = 'translate(' + newDx + 'px,' + newDy + 'px) scale(' + scale + ')';
    }});
    setTimeout(() => {{ card.style.visibility = 'hidden'; commit(word); }}, 270);
  }}

  // TTS — Task 2에서 본문 구현. 지금은 자리만(탭/롱프레스가 호출).
  function speak(word, card) {{}}
```

- [ ] **Step 5: 재빌드**

```bash
cd frontend/v1/mockup && python3 build.py
```

Expected: `wrote .../mockup.html <N> bytes | pool <N> words | <N> images | target 5` 가 출력되고 에러 없음.

- [ ] **Step 6: 산출물에 새 코드가 들어갔는지 확인**

```bash
cd frontend/v1/mockup && grep -c "attachCard\|snapCommit\|armDrop" mockup.html && ! grep -q "function onPick" mockup.html && echo "OK: onPick 제거됨"
```

Expected: 숫자(≥3) 출력 후 `OK: onPick 제거됨`. (onPick이 남아 있으면 `&&` 실패.)

- [ ] **Step 7: 육안 확인(아티팩트 또는 브라우저)**

`mockup.html`을 Artifact로 재배포(또는 브라우저로 열기)하고 확인:
- 보기 카드를 끌면 카드가 떠오르며(살짝 확대+기울기) 손가락을 따라온다.
- 카드를 빈 칸에 **살짝만 걸쳐도** 빈 칸 테두리가 실선+글로우로 바뀌고 들어갈 카드의 고스트가 보인다.
- 그 상태에서 손을 떼면 카드가 칸 중앙으로 정렬되며 확정되고 다음 라운드로 넘어간다.
- 칸에 안 걸친 채 손을 떼면 원래 자리로 튕겨 돌아온다.
- 브라우저 콘솔에 에러가 없다.

- [ ] **Step 8: 커밋**

```bash
cd /Users/yunki/Claude/Projects/word-chain
git add frontend/v1/mockup/build.py frontend/v1/mockup/mockup.html
git commit -m "feat(mockup): replace tap-to-fly with drag + area-overlap snap

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: 한국어 TTS (탭 / 롱프레스로 단어 듣기)

Task 1의 `speak(word, card)` 스텁 본문을 Web Speech로 구현하고, 읽는 동안 카드에 절제된 시각 신호를 준다. 컨트롤러는 이미 `speak`를 호출하므로 이 태스크는 함수 본문 + 보조 코드 + CSS만 추가한다.

**Files:**
- Modify: `frontend/v1/mockup/build.py` (CSS 키프레임 영역, JS `speak` 스텁 및 그 앞)

**Interfaces:**
- Consumes: `reduceMotion`, 그리고 Task 1이 만든 `speak(word, card)` 호출 지점.
- Produces: 동작하는 `speak(word, card)` — 한국어 음성 우선, 진행 중 음성은 끊고, `card`가 있으면 `.speaking` 펄스.

- [ ] **Step 1: speaking 펄스 CSS + 키프레임 추가**

`build.py`에서 Task 1이 추가한 `@keyframes armedPulse {{ ... }}` 블록 바로 뒤에 다음을 삽입한다:

```python
  .opt.speaking {{ animation:speakPulse .42s ease; }}
  @keyframes speakPulse {{ 0%{{ transform:scale(1); }} 45%{{ transform:scale(1.06); }} 100%{{ transform:scale(1); }} }}
```

- [ ] **Step 2: speak 스텁을 실제 구현으로 교체**

`build.py`의 스텁

```python
  // TTS — Task 2에서 본문 구현. 지금은 자리만(탭/롱프레스가 호출).
  function speak(word, card) {{}}
```

를 다음으로 교체한다:

```python
  // ── TTS: 한국어 음성으로 단어 읽기 ─────────────────────────────────
  let _voiceKo = null;
  function _pickVoice() {{
    if (!('speechSynthesis' in window)) return;
    const vs = speechSynthesis.getVoices();
    _voiceKo = vs.find(v => (v.lang || '').toLowerCase().startsWith('ko')) || null;
  }}
  if ('speechSynthesis' in window) {{
    _pickVoice();
    speechSynthesis.addEventListener('voiceschanged', _pickVoice);
  }}
  function speak(word, card) {{
    if (card && !reduceMotion) {{
      card.classList.add('speaking');
      setTimeout(() => card.classList.remove('speaking'), 420);
    }}
    if (!('speechSynthesis' in window)) return;
    speechSynthesis.cancel();            // 진행 중 음성 끊어 겹침 방지
    const u = new SpeechSynthesisUtterance(word);
    u.lang = 'ko-KR'; u.rate = 0.95;
    if (_voiceKo) u.voice = _voiceKo;
    speechSynthesis.speak(u);
  }}
```

- [ ] **Step 3: 재빌드**

```bash
cd frontend/v1/mockup && python3 build.py
```

Expected: `wrote ...` 출력, 에러 없음.

- [ ] **Step 4: 산출물 확인**

```bash
cd frontend/v1/mockup && grep -c "SpeechSynthesisUtterance\|speakPulse" mockup.html
```

Expected: 숫자(≥2) 출력.

- [ ] **Step 5: 육안/청취 확인**

아티팩트 재배포 후 (한국어 음성이 있는 환경에서):
- 보기 카드를 **톡 탭**하면 해당 단어가 한국어로 읽히고 카드가 한 번 살짝 커졌다 돌아온다.
- 카드를 **가만히 꾹**(약 0.4초) 눌러도 읽힌다.
- 카드를 **끌면**(드래그) 읽히지 않고 Task 1의 답하기 동작만 일어난다.
- 빠르게 연속 탭해도 음성이 겹치지 않고 새 단어로 바뀐다.
- (한국어 음성이 없는 브라우저면 무음일 수 있음 — best-effort. 콘솔 에러는 없어야 함.)

- [ ] **Step 6: 커밋**

```bash
cd /Users/yunki/Claude/Projects/word-chain
git add frontend/v1/mockup/build.py frontend/v1/mockup/mockup.html
git commit -m "feat(mockup): speak word via Web Speech on tap/long-press

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: armed 별 파티클 + 글로우 마무리

armed 진입 순간 빈 칸 둘레로 별(✦)이 터지고 머무는 동안 은은히 반짝이게 하며, 확정 순간 더 큰 별 버스트로 자축한다. 기존 골드/오렌지 팔레트만 사용하고 `reduceMotion`에서는 전부 생략한다.

**Files:**
- Modify: `frontend/v1/mockup/build.py` (`.drop` 규칙, 키프레임 영역, `armDrop`/`disarmDrop`/`commit`)

**Interfaces:**
- Consumes: `reduceMotion`, Task 1의 `armDrop`/`disarmDrop`, 기존 `commit(word)`/`fillDrop(word)`.
- Produces: `spawnSparks(n, opts)`, `clearSparks()` — 빈 칸 안에 별 파티클 생성/제거.

- [ ] **Step 1: .drop을 position:relative로 (별의 기준 컨테이너)**

`build.py` 143행

```python
  .drop {{ width:22cqw; min-height:30cqmin; border:0.8cqmin dashed var(--couple);
```

를 다음으로 교체한다(맨 앞에 `position:relative;`만 추가):

```python
  .drop {{ position:relative; width:22cqw; min-height:30cqmin; border:0.8cqmin dashed var(--couple);
```

- [ ] **Step 2: 별 파티클 CSS + 키프레임 추가**

`build.py`에서 Task 2가 추가한 `@keyframes speakPulse {{ ... }}` 블록 바로 뒤에 다음을 삽입한다:

```python
  .spark {{ position:absolute; pointer-events:none; line-height:1; font-size:5cqmin;
    color:var(--card-edge); transform:translate(-50%,-50%) scale(0); will-change:transform,opacity;
    animation:sparkPop .6s ease-out forwards; }}
  .spark.orange {{ color:var(--couple); }}
  .spark.loop {{ animation:sparkTwinkle 1.4s ease-in-out infinite; }}
  @keyframes sparkPop {{
    0%{{ transform:translate(-50%,-50%) scale(0) rotate(0deg); opacity:0; }}
    40%{{ opacity:1; }}
    60%{{ transform:translate(-50%,-50%) scale(1.15) rotate(25deg); opacity:1; }}
    100%{{ transform:translate(-50%,-50%) scale(.9) rotate(40deg); opacity:0; }} }}
  @keyframes sparkTwinkle {{
    0%,100%{{ transform:translate(-50%,-50%) scale(.5); opacity:.25; }}
    50%{{ transform:translate(-50%,-50%) scale(1); opacity:.9; }} }}
```

- [ ] **Step 3: 별 생성/제거 헬퍼 추가**

`build.py`에서 Task 1이 추가한 `disarmDrop` 함수

```python
  function disarmDrop() {{
    const drop = $('drop');
    if (!drop.classList.contains('armed')) return;
    drop.classList.remove('armed');
    drop.innerHTML = '<span class="drop__q">?</span>';
  }}
```

바로 뒤에 다음을 삽입한다:

```python

  function clearSparks() {{ $('drop').querySelectorAll('.spark').forEach(s => s.remove()); }}
  function spawnSparks(n, opts) {{
    if (reduceMotion) return;
    opts = opts || {{}};
    const drop = $('drop');
    for (let i = 0; i < n; i++) {{
      const s = document.createElement('span');
      s.className = 'spark' + (i % 2 ? ' orange' : '') + (opts.loop ? ' loop' : '');
      s.textContent = '✦';
      s.style.left = (8 + Math.random() * 84) + '%';
      s.style.top = (8 + Math.random() * 84) + '%';
      s.style.animationDelay = (Math.random() * (opts.loop ? 1.2 : 0.25)).toFixed(2) + 's';
      if (opts.big) s.style.fontSize = '7.5cqmin';
      drop.appendChild(s);
      if (!opts.loop) setTimeout(() => s.remove(), 900);
    }}
  }}
```

- [ ] **Step 4: armDrop에서 별 버스트 + 트윙클 생성**

Task 1의 `armDrop` 함수를

```python
  function armDrop(word) {{
    const drop = $('drop');
    if (drop.classList.contains('armed')) return;
    drop.classList.add('armed');
    drop.innerHTML = '<img class="opt__pic drop__ghost" src="' + (IMG[word] || '') + '" alt="">' +
                     '<span class="opt__word drop__ghost">' + word + '</span>';
  }}
```

다음으로 교체한다(innerHTML 설정 뒤 별 생성 추가 — innerHTML이 이전 별을 지우므로 그 다음에 생성):

```python
  function armDrop(word) {{
    const drop = $('drop');
    if (drop.classList.contains('armed')) return;
    drop.classList.add('armed');
    drop.innerHTML = '<img class="opt__pic drop__ghost" src="' + (IMG[word] || '') + '" alt="">' +
                     '<span class="opt__word drop__ghost">' + word + '</span>';
    spawnSparks(6);              // 진입 버스트
    spawnSparks(3, {{ loop: true }});  // 머무는 동안 트윙클
  }}
```

- [ ] **Step 5: 확정 순간 자축 버스트**

기존 `commit` 함수(`fillDrop` 호출이 있는 함수)를

```python
  function commit(word) {{
    fillDrop(word);
    state = engine.answer(word);
    setTimeout(advance, 480);
  }}
```

다음으로 교체한다:

```python
  function commit(word) {{
    fillDrop(word);              // 빈 칸 innerHTML 교체(이전 별 자동 제거)
    spawnSparks(10, {{ big: true }});  // 자축 버스트
    state = engine.answer(word);
    setTimeout(advance, 480);
  }}
```

- [ ] **Step 6: 재빌드**

```bash
cd frontend/v1/mockup && python3 build.py
```

Expected: `wrote ...` 출력, 에러 없음.

- [ ] **Step 7: 산출물 확인**

```bash
cd frontend/v1/mockup && grep -c "spawnSparks\|sparkPop\|sparkTwinkle" mockup.html
```

Expected: 숫자(≥3) 출력.

- [ ] **Step 8: 육안 확인**

아티팩트 재배포 후:
- 카드를 끌어 빈 칸에 걸치는 순간 칸 둘레로 별이 톡 터지고, 걸친 채 머무는 동안 은은히 반짝인다.
- 손을 떼 확정되는 순간 더 큰 별이 한 번 튄다.
- 칸에서 벗어나면 별이 사라진다(반짝임 중단).
- 별 색은 골드/오렌지뿐(새 색 없음). 콘솔 에러 없음.

- [ ] **Step 9: 커밋**

```bash
cd /Users/yunki/Claude/Projects/word-chain
git add frontend/v1/mockup/build.py frontend/v1/mockup/mockup.html
git commit -m "feat(mockup): star particles + glow on armed drop zone

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## 자체 점검 (작성자 확인 완료)

- **스펙 커버리지:** 드래그 입력/Pointer Events(T1) · 면적-교차 판정 1px(T1 `rectsOverlap`/`isOverDrop`) · 손 떼야 확정(T1 pointerup) · armed 글로우+테두리(T1) · 고스트 미리보기(T1 `armDrop`) · springback(T1) · 탭/롱프레스 TTS ko-KR + cancel 겹침방지(T2) · 별 파티클 진입/트윙클/확정(T3) · reduced-motion 분기(전 태스크) · 키보드 대안 → 아래 주석 참고.
- **키보드 Enter 대안:** 스펙의 "포커스 후 Enter 확정"은 드래그-only 목업에서 우선순위가 낮고, 현재 보기는 전부 정답이라 Enter=현재 포커스 카드 commit으로 구현 가능하나 별도 후속으로 둔다(이 계획 범위에서 제외, 실행 시 필요하면 T1에 1스텝 추가). ← 실행자 판단 지점.
- **타입/이름 일관성:** `attachCard`·`armDrop`·`disarmDrop`·`isOverDrop`·`rectsOverlap`·`snapCommit`·`springBack`·`speak(word, card)`·`spawnSparks`·`clearSparks` 명칭이 태스크 간 일치. `commit`/`fillDrop`/`advance`는 기존 명칭 그대로 사용.
- **플레이스홀더:** 없음(모든 코드 스텝에 완전한 코드 수록).
