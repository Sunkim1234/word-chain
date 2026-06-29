# 레포 구조 정리 & 모듈화 설계

**작성일:** 2026-06-29
**최종 갱신:** 2026-06-29 (main의 새 엔진·단어 데이터 반영)
**목적:** 인턴십 코드 리뷰를 위한 레포 정리. 동료(개발자 + 디자이너)가 clone해서 코드를 열어볼 것을 전제로, "바이브 코딩으로 생성한 단일 거대 파일"을 표준적이고 읽기 좋은 구조로 재편한다.

---

## 1. 프로젝트 의도

유아·특수학교 아동을 위한 **끝말잇기 웹 게임** 프로토타입.

- **`backend/`는 서버가 아니다.** package.json·서버 코드 없음. 실제 정체는 의존성 없는 **순수 JS 게임 엔진 라이브러리 + 단어 데이터 + 테스트** (`kkutu-engine.js`, 브라우저·Node 양쪽 동작). → "backend/frontend" 명칭을 버리고 **"재사용 가능한 게임 로직 모듈 + 그걸 쓰는 웹 클라이언트"**로 재정의.
- 현재 `frontend/`는 세 겹: 루트 정식앱 / `v1` / `v2`. **`v2`가 유일한 정식 앱**, 나머지는 아카이브.

## 1.5 ⚠️ 전제 변경 — 새 엔진·게임 모델 채택 (2026-06-29)

main에서 엔진과 단어 데이터가 **대규모로 재설계**되어, 이 브랜치에 통째로 가져왔다 (커밋 `a8bea6a`, `node backend/test-engine.js` 5000판 검증 통과). 이 설계의 전제가 아래처럼 바뀐다:

| | 옛 (이 설계 초안의 전제) | 새 (현재 채택) |
|---|---|---|
| 엔진 API | `new KkutuEngine(WORD_LIST, {targetAnswers:5})` | `new KkutuEngine({ start, middle, end })` |
| 게임 모델 | "5번 답하기" 단일 답 라운드 | **"4단어 체인(1→2→3→4) + AI↔아이 역할 교대"** |
| 단어 데이터 | 평면 단어 풀 | 역할별 JSON: `끝말잇기_1_시작단어`(41) / `_2_중간단어`(529) / `_3_끝단어`(186), 풍부한 메타(`word, category, start, end, length, cont, reach, tier`) |

→ **6모듈 골격은 그대로 유효**하다(모델과 무관한 구조). 바뀌는 것은 모듈의 *내용*이다.

## 2. 핵심 결정

| 결정 | 내용 |
|---|---|
| **빌드 폐기** | `mockup.html`은 `build.py`가 폰트·이미지·엔진·CSS·JS를 base64/인라인해 만든 산출물. 자체완결의 유일한 목적은 "서버 없이 더블클릭/Artifact". **팀이 로컬 서버로 보므로 그 전제가 사라짐.** → `build.py`·`mockup.html`·base64 인라인·f-string·폰트 런타임 서브셋 **전부 삭제.** |
| **정적 파일 + localhost** | 평범한 정적 파일을 `python3 -m http.server`(레포 루트)로 띄워 `localhost:8000`에서 봄. ES 모듈 로딩. |
| **Artifact 제외** | Artifact는 개발/수정 루프에서 완전히 뺀다. 소스 파일이 진실의 원천이고, 동작 확인은 localhost 스크린샷으로 한다. |
| **flat 구조** | monorepo/packages 워크스페이스는 과잉. 단일 정적 웹앱으로 flat하게 둔다. |
| **엔진 = src의 한 모듈** | `src/engine.js`. 새 역할기반 엔진을 그대로 옮긴다. |
| **새 게임 모델 채택** | 4단어 체인 + 역할 교대. v2 프론트엔드는 이 모델에 맞춰 game/ui를 새로 작성. |

## 3. 목표 레포 구조

```
word-chain/
├── README.md                  # 프로젝트 소개 + 실행법 (현재 25바이트 → 채움)
├── index.html                 # 앱 진입점
├── src/
│   ├── engine.js              # 순수 게임 규칙 (KkutuEngine, DOM 無) — 새 역할기반 엔진
│   ├── game.js                # 흐름 컨트롤러: 4단어 체인·역할 교대 진행, state
│   ├── ui.js                  # DOM 렌더: 라운드/진행/드롭 표시
│   ├── drag.js                # 드래그·스냅·탭듣기 (모델 무관, 거의 그대로)
│   ├── tts.js                 # 음성: speak/speakRound/_utter (모델 무관)
│   ├── effect.js              # 효과: spawnSparks/clearSparks/chainPulse (모델 무관)
│   └── styles.css
├── data/
│   ├── start-words.json       # 시작 단어 41개 (옛 끝말잇기_1_시작단어.json)
│   ├── middle-words.json      # 중간 단어 529개 (옛 끝말잇기_2_중간단어.json)
│   └── end-words.json         # 끝 단어 186개 (옛 끝말잇기_3_끝단어.json)
├── assets/
│   ├── fonts/                 # Jua-Regular.woff2, GowunDodum-Regular.woff2 (ttf→woff2 1회 변환)
│   └── img/                   # 픽토그램 png
├── tools/
│   └── build_words.py         # 단어 데이터 생성 스크립트 (옛 backend/)
├── test/
│   └── engine.test.js         # 엔진 테스트 (옛 backend/test-engine.js)
├── docs/                      # 기존 docs + 엔진 API 문서
└── archive/                   # 손대지 않고 보관
    ├── frontend-root/         # 옛 frontend/ 루트 앱 (index/app/style/test-app)
    ├── v1/                    # 옛 frontend/v1 전체
    └── mockups/               # 옛 build.py + mockup.html (v1·v2 자기완결 버전)
```

**실행:** 레포 루트에서 `python3 -m http.server` → 브라우저로 `localhost:8000`. `index.html`이 `src/`·`data/`·`assets/`를 평범하게 참조. 한글 파일명은 git/경로에서 번거로우니 `data/`로 옮기며 영문으로 정규화한다.

## 4. src 모듈 분해 + 새 모델에서의 운명

큰 덩어리 6개. 폴더 없이 flat. **모델이 바뀌어도 이 경계는 유효**하나, 모듈마다 추출 방식이 다르다.

| 파일 | 새 모델에서 | 처리 방식 | 핵심 함수 |
|---|---|---|---|
| `engine.js` | **이미 교체됨** | 새 역할기반 엔진을 `src/`로 이동, `export` 추가 | `KkutuEngine({start,middle,end})` |
| `tts.js` | **그대로 생존** (게임 무관) | 블롭에서 충실히 추출 | `speak/speakRound/_utter/_pickVoice/bindSpeaking` |
| `effect.js` | **그대로 생존** | 충실히 추출 (대상 요소를 인자로) | `spawnSparks/clearSparks/chainPulse` |
| `drag.js` | **거의 생존** (보기 카드 드래그→드롭 동일) | 충실히 추출, `onCommit` 콜백화 | `attachCard/snapCommit/springBack/armDrop/disarmDrop/isOverDrop/attachListen` |
| `ui.js` | **부분 재작성** (진행 표시 등 모델 의존) | 새 모델 기준 작성 | 렌더 함수들 |
| `game.js` | **재작성** (4단어 체인+역할 교대) | 새 엔진에 맞춰 새로 작성, drag/tts/effect 주입 | 라운드 라이프사이클, state |

### 경계 처리 (명시)

1. **`drag.js`는 game·tts·effect를 직접 import하지 않는다.** game이 콜백으로 주입: `attachDrag(card, { onCommit, speak, spark })`. drag가 독립적으로 읽히도록.
2. **정답 후 낭독+진행**(옛 `playChainThenAdvance`)은 `game.js`에 두고 `tts.speak`를 호출한다 (진행 제어가 본질).
3. 로딩은 ES 모듈. `index.html`은 진입 모듈 하나(`<script type="module">`)로 시작, 각 모듈은 `import`/`export`.

## 5. 로드맵 (Phase)

### Phase 1 — 지금 (모듈화 + 새 모델 적용)
체크포인트마다 localhost로 검증 가능하게 순서를 잡는다.

1. **레포 재배치**: `backend/` → `src/engine.js` + `data/`(영문 정규화) + `tools/` + `test/`. 루트앱·`v1` → `archive/`. 루트 위생(`backend.txt` 삭제, 빈 `README.md` 채움, `wordchain_v1.md`→`docs/`, `.gitignore`에 `.DS_Store`). v2 에셋(font/img) 커밋.
2. **생존 모듈 추출**: 현 v2 블롭(옛 build.py 인라인 JS/CSS)에서 `tts.js`/`effect.js`/`drag.js`/`styles.css`를 깨끗이 떼냄. base64 제거, 폰트 woff2 1회 변환.
3. **game/ui 새로 작성**: 새 엔진(`{start,middle,end}`, 4단어 체인)에 맞춰 `game.js`·`ui.js` 작성. 2번에서 떼낸 drag/tts/effect를 가져다 씀.
4. **검증**: localhost에서 4단어 체인·역할 교대·드래그·TTS·파티클·낭독·탭듣기·진행·종료 동작 확인.

> 옛 game/ui를 충실히 추출했다가 곧바로 재작성하는 낭비를 피한다 — 살아남을 것(drag/tts/effect)만 추출하고, 모델 의존부(game/ui)는 새 엔진 기준으로 새로 쓴다.

### Phase 2 — 나중 (풀 리팩토링, 앱이 커지면)
화면이 여러 개로 늘면 `scenes/`, 재사용 조각이 많아지면 `components/`로 세분화. 지금은 YAGNI.

## 6. 열린 항목 (구현 전 결정/확인)

1. **🔴 그림(pic) 매핑 공백** — 새 역할기반 단어 데이터엔 `pic`/이미지 id가 없다. 그런데 v2 UI는 단어별 픽토그램을 보여준다(보기 카드·제시 카드). **새 단어들이 어떻게 그림과 연결되는가**를 정해야 한다 (단어→이미지 매핑 테이블 신설? 그림 없이? `assets/img/`의 어떤 파일과?). UI 작성 전 필수 결정.
2. **목업 전용 껍데기** — 비율 토글(4:3/16:10/16:9)·크레딧 줄은 데모 장치. 리뷰 데모로 **남길지** / 실앱 깔끔함으로 **뺄지**.
3. **`frontend/한승_AI와끝말잇기_프로토타입.html`** (281KB 독립 프로토타입) — 정체/소유 확인 후 `archive/` 또는 삭제. (참고: main에는 이 파일이 레포 루트에 따로 존재)
4. **참고용 `kids_nouns.json`(734)** 및 `safe_start_words.json`(52) — 새 모델에서 미사용. → `archive/` 또는 `tools/` 정리.
5. **미사용 이미지** — img 473장 중 일부만 사용. 추리기는 선택(나중에 해도 됨).
6. **README.md(backend) 갱신** — 현재 옛 엔진 API를 설명. 새 엔진 기준으로 갱신 필요 (docs로 이동 시 함께).

## 7. 검증 요건

- **엔진 회귀**: `node test/engine.test.js` (현재 5000판 통과 상태 유지).
- **앱 동작**(localhost): 4단어 체인 진행, AI↔아이 역할 교대, 보기 카드 드래그+스냅, 음성(TTS), 별 파티클, 정답 후 연결 낭독, 탭-투-리슨, 라운드 종료·재시작.
