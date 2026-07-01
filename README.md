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
