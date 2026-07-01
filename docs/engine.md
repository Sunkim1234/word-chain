# 끝말잇기 엔진 API (`src/engine.js`)

유아·특수학교 아동을 위한 끝말잇기 웹의 **게임 로직 모듈**입니다.
재미·난이도보다 "오래, 막히지 않고 진행되는 것"을 목표로 설계했습니다.

## 게임 모델

- 총 **2라운드 × 4단어** 체인. 각 단어는 앞 단어의 끝 음절로 시작.
- 단어 재사용 없음(두 라운드 통틀어 전역 중복 금지).
- **역할 교대:** 라운드 1은 AI가 홀수(1, 3번) 자리를 두고 아이가 짝수(2, 4번)를 고른다.
  라운드 2는 반대(아이 1, 3번 / AI 2, 4번).
- AI 차례: 라운드 끝까지 막히지 않는 단어를 자동 선택.
- 아이 차례: 안전한 보기(기본 3개)를 제시, 아이가 하나 선택.

## 단어 풀 구조

| 자리 | 후보 풀 |
|------|---------|
| 1번  | start ∪ middle (시작단어 우선 표시) |
| 2, 3번 | middle |
| 4번  | end ∪ middle (끝단어 우선, 부족하면 middle로 보충) |

## 생성자

```js
new KkutuEngine(pools, opts)
```

| 매개변수 | 타입 | 설명 |
|---------|------|------|
| `pools.start` | `string[] \| {word, category, ...}[]` | 시작 단어 풀 |
| `pools.middle` | `string[] \| {word, category, ...}[]` | 중간 단어 풀 |
| `pools.end` | `string[] \| {word, category, ...}[]` | 끝 단어 풀 |
| `opts.optionsCount` | `number` (기본 3) | 아이 차례에 보여줄 보기 수 |
| `opts.rng` | `function` (기본 `Math.random`) | 난수 함수 (시드 주입 가능) |

## 공개 메서드

### `engine.start()` → state

새 게임을 시작한다. 라운드 1에서 AI가 1번 자리를 두고 아이의 2번 보기를 준비한 뒤 state를 반환한다.

### `engine.answer(word)` → state

아이가 보기(`state.options`) 중 하나를 선택한다. `options`에 없는 단어는 무시된다.
AI 차례가 연속될 경우 자동으로 처리하고 다음 아이 차례(또는 게임 종료) 상태를 반환한다.

## state 필드

`start()` / `answer()` 반환값:

| 필드 | 타입 | 설명 |
|------|------|------|
| `status` | `'idle' \| 'playing' \| 'won' \| 'lost'` | 게임 상태 |
| `round` | `number` | 현재 라운드 (1 또는 2) |
| `position` | `number` | 현재 자리 (1–4) |
| `totalRounds` | `number` | 총 라운드 수 (2) |
| `roundLength` | `number` | 라운드당 단어 수 (4) |
| `turn` | `'child' \| null` | 현재 차례 (`'playing'` 일 때만 `'child'`) |
| `currentSyllable` | `string \| null` | 아이가 이 음절로 시작하는 단어를 골라야 함 (1번 자리는 `null` = 아무거나) |
| `options` | `string[]` | 아이 보기 (전부 정답, `optionsCount`개) |
| `lastWord` | `string \| null` | 방금 놓인 단어 (AI 또는 아이) |
| `history` | `{round, pos, by, word}[]` | 전체 플레이 기록 |
| `usedCount` | `number` | 지금까지 사용된 단어 수 |
| `category` | `function(word) → string \| undefined` | 단어의 카테고리 반환 함수 |

## 사용 예 (브라우저)

```js
const [s, m, e] = await Promise.all([
  fetch('data/start-words.json').then(r => r.json()),
  fetch('data/middle-words.json').then(r => r.json()),
  fetch('data/end-words.json').then(r => r.json()),
]);
const engine = new KkutuEngine(
  { start: s.words, middle: m.words, end: e.words },
  { optionsCount: 3 }
);

let state = engine.start();
// state.options = 보기 3개 (전부 정답)
// state.currentSyllable = 아이가 골라야 할 시작 음절

state = engine.answer(state.options[0]); // 아이가 보기 중 하나 선택
// state.status === 'won' 이면 2라운드 완주
```

## 사용 예 (Node — 테스트)

```js
const KkutuEngine = require('./src/engine.js');
// node test/engine.test.js 로 실행
```

## 검증

```bash
node test/engine.test.js
```
