# 끝말잇기 게임 로직 (유아·특수학교용)

유아 및 특수학교 아동을 위한 끝말잇기 웹의 **게임 로직 모듈**입니다.
재미·난이도보다 "오래, 막히지 않고 진행되는 것"을 목표로 설계했습니다.

## 특징

- 단어 재사용 없이 아이가 정해진 횟수(기본 5번)만큼 끝까지 답할 수 있도록 **보장**합니다.
- 매 차례 "끝까지 막히지 않는 정답"만 **2~3개** 제시합니다. (전부 정답, 아이는 아무거나 선택)
- 의존성 없는 순수 JavaScript. 브라우저(`<script>`)·Node 모두 동작.
- 단어 풀은 유아~초등 2학년 수준 명사로 구성, 막다른 단어/한 글자 단어 제거 완료.

## 파일 구성

| 파일 | 설명 |
|------|------|
| `kkutu-engine.js` | 게임 로직 엔진 (메인) |
| `kids_nouns_safe_2plus.json` | 게임용 단어 풀 308개 (2글자 이상, 막힘 없음) |
| `safe_start_words.json` | 5턴 보장되는 안전 시작 단어 52개 |
| `test-engine.js` | 엔진 자체 검증 스크립트 (Node) |
| `build_words.py` | 단어 데이터 생성·분석용 (Python, 준비 단계) |
| `kids_nouns.json` | 원본 단어 풀 734개 (참고용) |
| `kids_nouns_safe.json` | 막다른 단어만 제거한 풀 466개 (참고용) |

## 사용법 (브라우저)

```html
<script src="kkutu-engine.js"></script>
<script>
  fetch('kids_nouns_safe_2plus.json')
    .then(r => r.json())
    .then(data => {
      const engine = new KkutuEngine(data.words, { targetAnswers: 5 });
      let state = engine.start();   // AI가 안전 시작어로 시작
      // state.currentSyllable : 아이가 이 글자로 시작하는 단어를 골라야 함
      // state.options         : 보기 2~3개 (전부 정답)
      render(state);
    });

  function onCardClick(word) {
    const state = engine.answer(word);  // 아이 선택 → AI 자동 응답
    // state.status === 'won' 이면 목표 횟수 완주
    render(state);
  }
</script>
```

## 사용법 (Node)

```js
const KkutuEngine = require('./kkutu-engine.js');
const data = require('./kids_nouns_safe_2plus.json');
const engine = new KkutuEngine(data.words, { targetAnswers: 5 });
let state = engine.start();
state = engine.answer(state.options[0]);
```

## API

- `new KkutuEngine(words, { targetAnswers, maxOptions, minOptions, rng })`
- `engine.start(startWord?)` → state
- `engine.answer(word)` → state
- `engine.getState()` → `{ status, currentSyllable, options, childAnswers, targetAnswers, lastWord, history, usedCount }`
- `engine.safeStartWords` : 안전 시작 단어 배열

## 검증

```bash
node test-engine.js
```

5,000판 시뮬레이션 기준: 5턴 완주 **100%**, 도중 막힘 0, 단어 중복 0.
제시 보기 개수 분포는 2개 약 69% / 3개 약 31%.
