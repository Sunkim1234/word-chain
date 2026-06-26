# 끝말 잇기 V1 — 목업에 엔진 인라인 연결 설계

작성일: 2026-06-26

## 목적

현재 디자인 목업(`frontend/v1/mockup/`)은 하드코딩된 더미 `SCENARIO` 6라운드로 돈다.
이를 실제 엔진(`backend/kkutu-engine.js`) 구동으로 교체해, **진짜 게임 로직(절대 안
막히는 끝말잇기)** 위에서 동작하게 한다. 단일 자기완결 `mockup.html`(Artifact 배포용)
형태와 `build.py` 빌드 워크플로우는 그대로 유지한다.

## 확정된 결정 (브레인스토밍 합의)

1. **게임 모델 A (AI 턴 보임)** — 엔진을 그대로 사용. 엔진은 아이 한 수마다 AI 한 수를
   끼워 넣으므로, "방금 만든 말(now)" 카드는 엔진의 `lastWord`(직전 AI 단어)가 된다.
   아이가 답하면 → 엔진이 AI 수를 두고 → 다음 `now`는 그 새 AI 단어로 **교체**된다.
   - 실제 체인 예: `여우(AI) → 우체국(아이) → 국수(AI) → 수영(아이) → 영화(AI) → ...`
   - v1은 "단순 교체"로 처리(아이 카드가 드롭존에 안착 → 짧은 텀 후 now가 AI 단어로 갱신).
     "컴퓨터 차례" 연출은 후속 다듬기 항목.
2. **단어 풀: 전체 258개**(`frontend/v1/words.json`). 안전 시작 단어 9개로 한 판(5턴)
   완주 검증됨. 그림은 258개 전부 인라인(~3.6MB 산출물).
3. **보기 개수: 2~3개 유동**. 엔진 보장은 최소 2개(실측 대부분 2개). 디자인이 2/3개를
   모두 자연스럽게 받는다 + 마이크 카드 유지. "항상 3개 강제"는 비범위(엔진 개조 필요).
4. **결정성**: 엔진에 시드 고정 RNG를 주입 → 새로고침해도 같은 판 재생(애니메이션 튜닝용).
5. **인라인 방식 = "참조 인라인"**: 엔진 소스·단어·그림을 build.py 본문에 **붙여넣지 않고**,
   빌드 때 `open().read()`/base64 인코딩으로 읽어 산출물에 박는다. build.py 본문은 작게 유지.

## 비범위 (명시)

- 드래그앤드롭(v2) · 마이크 음성입력 동작 · 엔진 "항상 3개" 개조
- 전체 체인 회고(완주) 화면 — 기존 "다 이었어요! 🎉" 단순 상태 유지
- 진짜 프론트(`frontend/v1/index.html`+`app.js`)와의 통합/수렴
- 큐레이션 단어 풀(연결성 맞춘 부분집합) — 나중에 선택적으로

## 아키텍처 / 구현 방식

`build.py` 한 파일만 수정한다. CSS·HTML 구조(상단바·히어로·드롭존·안내 박스·보기행)는
현재 그대로 유지하고, **데이터 준비부와 클라이언트 JS만 교체**한다.

### build.py 데이터 준비부 (교체)

| 기존 | 변경 |
|---|---|
| `assets.json`에서 더미 19개 그림 읽음 | `words.json`(258단어) + `img/<pic>.png` 258개를 base64 인코딩 |
| `SCENARIO` 하드코딩 배열 | 제거 — 엔진이 런타임에 라운드 생성 |
| 폰트 서브셋 = SCENARIO 글자 | 폰트 서브셋 = **전체 258단어 글자 + UI 텍스트** |
| (없음) | `backend/kkutu-engine.js` 소스를 읽어 산출물에 `<script>`로 인라인 |

- 엔진엔 단어 **문자열 배열**만 전달(`[{word,pic}]`의 `word`만). 그림은 별도 `word→dataURI` 맵.
- 엔진 소스는 브레이스 충돌을 피하려 f-string 밖에서 플레이스홀더 치환으로 주입한다
  (`html.replace("%%ENGINE%%", engine_src)`).

### 클라이언트 JS (교체)

```text
KkutuEngine 인라인 → new KkutuEngine(WORD_LIST, { targetAnswers: 5, rng: seededRng })
state = engine.start()

renderRound(state):
  now  = state.lastWord            // 응답 대상(직전 AI 단어) = "방금 만든 말" 카드
  syl  = state.currentSyllable     // 공유 글자(링크 토큰 + 프롬프트)
  보기 = state.options             // 2~3개 + 마이크 카드
  진행도 = state.childAnswers / targetAnswers

onPick(word):                      // 보기 탭
  애니메이션: 카드가 드롭존으로 날아가 안착(아이 단어)  // reduced-motion이면 즉시
  state = engine.answer(word)      // 아이 한 수 + (안 끝났으면) AI 한 수
  480ms 후 advance()

advance():
  state.status === 'won' 이면 finish()   // "다 이었어요!"
  아니면 renderRound() (now가 새 AI 단어로 갱신)
```

- 시드 RNG: 정수 LCG(`Math.imul`)로 `[0,1)` 반환, 엔진 `opts.rng`로 주입.
- 보기 개수가 2개면 카드 2개 + 마이크 카드(총 3칸), 3개면 3개 + 마이크(4칸) — 기존 flex 레이아웃이 수용.

### 파일별 변경

| 파일 | 변경 |
|---|---|
| `frontend/v1/mockup/build.py` | 데이터 준비부·JS 교체(위). CSS/HTML 구조는 유지. |
| `frontend/v1/mockup/mockup.html` | 산출물(자기완결). 직접 편집 금지 — 항상 build.py로 생성. |
| `frontend/v1/mockup/assets.json` | **더 이상 사용 안 함**(그림을 img/에서 직접 인코딩). 파일은 남겨두되 미참조. |

## 검증 방법

- 빌드: `python3 frontend/v1/mockup/build.py` → 산출물 생성 확인(바이트 수·인라인 그림 수 출력).
- 정적 검증(거대 산출물을 통째로 읽지 않음):
  - f-string 누수 `{{`/`}}` 0건.
  - `new KkutuEngine` / `function renderRound` / `WORDS` 존재, `SCENARIO` 0건.
- 엔진 로직: Node로 풀 로드 후 한 판 시뮬레이션이 `won`으로 끝나는지(이미 1차 확인).
- 실제 동작·손맛·비주얼: **아티팩트를 브라우저에서** 확인(헤드리스 없음). 기존 URL에 `url`로 덮어쓰기.

## 토큰/작업 규율

- 생성된 `mockup.html`(~3.6MB)이나 base64 덩어리를 `cat`/`grep -o`/Read 하지 않는다.
  편집은 오직 `build.py`. 검증은 카운트성 grep(`-c`)·바이트 수만.

## 미해결 / 다음 단계

- 모델 A "컴퓨터 차례" 연출(AI 단어 등장 애니메이션) — 특교 아이 혼란 완화용.
- "항상 보기 3개" 필요 시 엔진 v1 변형(현재 대부분 2개).
- 큐레이션 풀로 산출물 슬림화(연결성 맞춘 부분집합 + 그 그림만 인라인).
- 완주(전체 체인 회고) 화면.
- v2: 드래그앤드롭 입력.
