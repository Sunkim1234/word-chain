# 끝말잇기 프론트엔드 프로토타입 설계

- **날짜:** 2026-06-25
- **상태:** 승인됨 (구현 계획 작성 전)
- **목적:** 기존 `kkutu-engine.js` 게임 엔진에 연결되는 최소 플레이어블 HTML+CSS 프로토타입. 버리는 코드가 아니라 실제 프론트엔드로 키워갈 **첫 씨앗**.

## 배경

`backend/` 폴더에는 서버가 아니라 **순수 JS 게임 엔진 + 단어 데이터(JSON)** 가 있다.

- `backend/kkutu-engine.js` — 의존성 없는 게임 로직 엔진. 전역 `KkutuEngine` 노출.
- `backend/kids_nouns_safe_2plus.json` — 게임용 단어 풀 308개 (`words` 배열).

엔진은 매 차례 "끝까지 막히지 않는 정답"만 2~3개 제시하도록 보장한다(5000판 시뮬레이션 100% 완주 검증됨). 현재 이 엔진을 브라우저에서 눈으로 확인할 웹 페이지가 전혀 없다(HTML 파일 0개, `test-engine.js`는 Node 전용).

## 목표 / 비목표

### 1차 슬라이스 목표 (이번 범위)
- 엔진을 브라우저에 연결해 **한 판을 끝까지(기본 5턴) 플레이**할 수 있다.
- AI 시작어 표시 → 보기 카드 클릭 → AI 자동 응답 → 진행도/완주 표시.
- 실제 프론트로 키울 수 있도록 UI 레이어를 얇고 교체 가능하게 둔다.

### 비목표 (다음 단계로 미룸)
- 오답 보기 1개 추가 (1차에는 엔진 그대로 **전부 정답** 보기 사용)
- 10라운드 (1차에는 엔진 기본 `targetAnswers: 5`)
- TTS 읽어주기, 단어 그림/이미지, 체인 애니메이션, 사용 단어 정리 화면, 음성 인식

이 기능들은 구조상 나중에 `app.js` / `style.css`에 덧붙이면 되며, 엔진은 건드리지 않는다.

## 아키텍처 (B안: 3파일 분리)

```
word-chain/
├─ backend/                  ← 그대로 (수정 없음)
│   ├─ kkutu-engine.js
│   └─ kids_nouns_safe_2plus.json
└─ frontend/                 ← 신규 (기존 1byte 'frontend' 파일 제거 후 디렉토리로 생성)
    ├─ index.html            ← 구조 + 엔진/JSON 로드
    ├─ style.css             ← 최소 스타일
    └─ app.js                ← UI 레이어 (엔진 호출 + 렌더)
```

- 엔진은 `<script src="../backend/kkutu-engine.js"></script>`로 로드 → 전역 `window.KkutuEngine` 사용.
- 단어 데이터는 `app.js`에서 `fetch('../backend/kids_nouns_safe_2plus.json')`로 로드.
- 프레임워크/번들러 없음. 엔진의 무의존·순수 JS 철학 유지.

## 데이터 흐름 (단방향)

```
사용자 클릭 → app.js: engine.answer(word)
            → 엔진이 새 state 반환 (아이 선택 + AI 응답을 한 번에 처리)
            → render(state): state 하나로 화면 전체를 다시 그림
```

- **상태는 엔진이 단독 소유**한다. `app.js`는 별도 상태를 들지 않고 매번 `state`로 화면만 그린다 → 상태 불일치 버그 최소화.

## 컴포넌트: `app.js` (함수 4개)

| 함수 | 책임 |
|------|------|
| `init()` | JSON fetch → `new KkutuEngine(words, {targetAnswers:5})` → `engine.start()` → `render` |
| `render(state)` | `state` 하나로 화면 전체를 그림 (순수 렌더, 부수효과 최소) |
| `onCardClick(word)` | `engine.answer(word)` → `render` |
| `onRestart()` | `engine.start()` → `render` |

엔진 공개 API: `new KkutuEngine(words, opts)`, `engine.start(startWord?)`, `engine.answer(word)`, `engine.getState()`, `engine.safeStartWords`.

`state` 객체: `{ status, currentSyllable, options, childAnswers, targetAnswers, lastWord, history, usedCount, category }`.

## 화면 (1차 슬라이스)

- **상단:** 진행도 `childAnswers / targetAnswers` (예: `2 / 5`), 현재 음절 자막 — **"'소'로 시작하는 말은?"** (`currentSyllable` 기반).
- **가운데:** 방금 나온 단어(`lastWord`) 1개를 크게 표시.
- **하단:** 보기 카드 2~3개(`options`) — 클릭 가능, 전부 정답.
- **`status === 'won'`:** "성공! 🎉" + 다시하기 버튼.
- **`status === 'lost'`:** (방어용) 메시지 + 다시하기 버튼. 안전 시작어를 쓰면 도달하지 않도록 엔진이 보장하나, UI는 방어적으로 처리한다.

## 실행 방법

엔진이 `fetch()`로 JSON을 로드하므로 `file://` 더블클릭은 CORS로 막힌다. 로컬 서버로 실행한다.

```bash
cd word-chain
python3 -m http.server 8000
# 브라우저에서 http://localhost:8000/frontend/ 열기
```

## 에러 처리

- JSON fetch 실패 시: 화면에 "단어 데이터를 불러오지 못했습니다" 안내 (로컬 서버 미실행 시 흔한 케이스).
- `engine.answer()`에 보기에 없는 단어가 들어오면 엔진이 상태 변화 없이 현재 state를 반환하므로, UI는 카드 클릭으로만 호출한다.

## 테스트 / 검증

- 수동: 로컬 서버 띄우고 브라우저에서 카드를 눌러 5턴 완주(`won`) 확인. 여러 번 새로고침/다시하기로 다양한 판이 막히지 않는지 눈으로 확인.
- 엔진 자체 로직은 기존 `backend/test-engine.js`(Node, 5000판 시뮬레이션)로 이미 검증됨 — 이 프로토타입은 **연동/렌더** 검증에 집중.

## 향후 확장 경로 (참고)

1. 오답 보기 1개 추가 — `app.js`에서 `options`에 distractor 1개 섞기 (또는 엔진에 옵션 추가).
2. 10라운드 — `targetAnswers: 10`으로 변경 (단어 풀이 10턴 보장 가능한지 재검증 필요).
3. TTS / 단어 그림 / 체인 애니메이션 / 사용단어 정리 화면 — `app.js` + `style.css`에 점진 추가.
