# 제시 단어 카드 · 연결고리칸 탭-투-리슨(TTS) 설계

- 날짜: 2026-06-29
- 대상 파일: `frontend/v2/mockup/mockup.html`
- 작성: 브레인스토밍 합의 기반

## 배경

현재 v2 목업의 TTS 동작:

- **정답 후보 카드(`.opt`)** — `attachCard()`에서 `pointerdown` 즉시 `speak(word)` 호출. 누르면 듣기, 드래그하면 답하기.
- **상단 제시 단어 카드(`.now__card` / `#nowWord`)** — 클릭 핸들러 없음. 라운드 시작 시 `speakRound()`로 자동 낭독만 됨.
- **연결고리칸(`#linkTok`)** — 클릭 핸들러 없음. 정답 후 `playChainThenAdvance()` 체인 낭독 중 펄스+낭독만 됨.

두 요소 모두 `chainPulse(el)` 펄스 애니메이션이 이미 적용되는 요소다.

## 목표

상단 제시 단어 카드와 연결고리칸 글자도 누르면 각각 현재 단어/글자를 TTS로 재생한다.

- `.now__card` 탭 → `speak(state.lastWord)`
- `#linkTok` 탭 → `speak(state.currentSyllable)`

## 결정사항 (브레인스토밍 합의)

1. **트리거:** 정답 카드와 동일하게 `pointerdown` 즉시 재생.
2. **재생 가능 시점:** **내 차례에만**. `locked` 이거나 `state.status !== 'playing'` 이면 무시(자동 낭독·AI 차례 중엔 동작 안 함).
3. **탭 피드백:** 기존 `chainPulse(el)` 펄스 재사용(추가 CSS 없음).

## 설계

### 1. 공통 헬퍼 `attachListen(el, getText)`

정답 카드(`attachCard`)와 달리 드래그가 없으므로 "탭=듣기"만 처리하는 가벼운 헬퍼를 둔다.

```js
function attachListen(el, getText) {
  el.addEventListener('pointerdown', () => {
    if (locked || state.status !== 'playing') return;  // 내 차례에만
    speak(getText());                                   // 누르는 즉시 재생
    chainPulse(el);                                     // 펄스 피드백
  });
}
```

- `getText`를 콜백으로 두는 이유: 두 요소의 내용은 라운드마다 바뀌므로 항상 최신 `state` 값을 읽어야 한다.
- `speak()`는 내부에서 `_speakSeq++` 및 `speechSynthesis.cancel()` 하므로 진행 중 음성과 겹치지 않는다.

### 2. 바인딩 위치

- `.now__card`, `#nowWord`, `#linkTok` 노드는 라운드마다 재생성되지 않고 `textContent`/속성/`innerHTML` 내용만 갱신된다. 따라서 **초기화 시 한 번만** 바인딩한다(`renderRound` 안에서 매번 붙이지 않음).
- 배치 위치: 파일 하단 `prompt__speaker` 클릭 핸들러(약 779줄) 옆.

```js
attachListen(document.querySelector('.now__card'), () => state.lastWord);
attachListen($('linkTok'), () => state.currentSyllable);
```

### 3. 접근성 / 어포던스

- 두 요소에 다음 추가:
  - `cursor: pointer`
  - `role="button"`
  - `aria-label` — `.now__card`: "단어 다시 듣기", `#linkTok`: "글자 듣기"
  - `tabindex="0"`(일관성 위해 권장)

## 부작용 검토

- `now__card`에는 이미 `intro` / `chainpop` 애니메이션이 걸린다. `chainPulse`는 `intro`/`chainpop` 제거 후 `chainpop` 재적용하므로 탭 펄스와 충돌 없음.
- `pointerdown` 핸들러는 기존 드래그(정답 카드)와 별개 요소에 붙으므로 드래그 로직과 간섭 없음.

## 범위 밖 (YAGNI)

- 롱프레스/반복 재생 등 추가 제스처 없음.
- locked 중 재생 허용은 명시적으로 제외(내 차례에만).
- v1 목업·다른 화면은 변경하지 않음.
