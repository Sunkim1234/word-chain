# 레포 구조 정리 & 모듈화 설계

**작성일:** 2026-06-29
**목적:** 인턴십 코드 리뷰를 위한 레포 정리. 동료(개발자 + 디자이너)가 clone해서 코드를 열어볼 것을 전제로, "바이브 코딩으로 생성한 단일 거대 파일"을 표준적이고 읽기 좋은 구조로 재편한다.

---

## 1. 프로젝트 의도

유아·특수학교 아동을 위한 **끝말잇기 웹 게임** 프로토타입.

- **`backend/`는 서버가 아니다.** package.json·서버 코드 없음. 실제 정체는 의존성 없는 **순수 JS 게임 엔진 라이브러리 + 단어 데이터 + 테스트** (`kkutu-engine.js`, 브라우저·Node 양쪽 동작). → "backend/frontend" 명칭을 버리고 **"재사용 가능한 게임 로직 모듈 + 그걸 쓰는 웹 클라이언트"**로 재정의.
- 현재 `frontend/`는 세 겹: 루트 정식앱 / `v1` / `v2`. **`v2`가 유일한 정식 앱**, 나머지는 아카이브.

## 2. 핵심 결정

| 결정 | 내용 |
|---|---|
| **빌드 폐기** | `mockup.html`은 `build.py`가 폰트·이미지·엔진·CSS·JS를 base64/인라인해 만든 산출물. 자체완결의 유일한 목적은 "서버 없이 더블클릭/Artifact". **팀이 로컬 서버로 보므로 그 전제가 사라짐.** → `build.py`·`mockup.html`·base64 인라인·f-string·폰트 런타임 서브셋 **전부 삭제.** |
| **정적 파일 + localhost** | 평범한 정적 파일을 `python3 -m http.server`(레포 루트)로 띄워 `localhost:8000`에서 봄. ES 모듈 로딩. |
| **Artifact 제외** | Artifact는 개발/수정 루프에서 완전히 뺀다. 소스 파일이 진실의 원천이고, 클로드는 Artifact가 아니라 소스를 직접 읽고 고치며, 동작 확인은 localhost 스크린샷으로 한다. (비개발자 링크 공유 수요가 생기면 그때 일방향 publish 스크립트를 따로 고려) |
| **flat 구조** | monorepo/packages 워크스페이스는 과잉. 단일 정적 웹앱으로 flat하게 둔다. |
| **엔진 = src의 한 모듈** | 엔진도 이름만 엔진. `src/engine.js`로 둔다. |

## 3. 목표 레포 구조

```
word-chain/
├── README.md                  # 프로젝트 소개 + 실행법 (현재 25바이트 → 채움)
├── index.html                 # 앱 진입점
├── src/
│   ├── engine.js              # 순수 게임 규칙 (KkutuEngine, DOM 無)
│   ├── game.js                # 흐름 컨트롤러: state·locked, commit/advance/finish/restart
│   ├── ui.js                  # DOM 렌더: renderRound/renderProgress/fillDrop
│   ├── drag.js                # 드래그·스냅·탭듣기: attachCard/snapCommit/armDrop/attachListen
│   ├── tts.js                 # 음성: speak/speakRound/_utter/_pickVoice
│   ├── effect.js              # 효과: spawnSparks/clearSparks/chainPulse
│   └── styles.css
├── data/
│   ├── words.json             # 앱 단어+그림 풀 258개 (옛 frontend/v2/words.json)
│   ├── word-pool.json         # 엔진 안전 풀 308개 (옛 kids_nouns_safe_2plus.json)
│   └── start-words.json       # 안전 시작어 52개 (옛 safe_start_words.json)
├── assets/
│   ├── fonts/                 # Jua-Regular.woff2, GowunDodum-Regular.woff2 (ttf→woff2 1회 변환)
│   └── img/                   # 픽토그램 png (실제 쓰는 것만)
├── tools/
│   └── build_words.py         # 단어 데이터 생성 스크립트 (옛 backend/)
├── test/
│   └── engine.test.js         # 엔진 테스트 (옛 backend/test-engine.js)
├── docs/                      # 기존 docs + 엔진 API 문서(옛 backend/README 내용)
└── archive/                   # 손대지 않고 보관
    ├── frontend-root/         # 옛 frontend/ 루트 앱 (index/app/style/test-app)
    ├── v1/                    # 옛 frontend/v1 전체
    └── mockups/               # 옛 build.py + mockup.html (v1·v2 자기완결 버전)
```

**실행:** 레포 루트에서 `python3 -m http.server` → 브라우저로 `localhost:8000`. `index.html`이 `src/`·`data/`·`assets/`를 평범하게 참조.

## 4. src 모듈 분해 (코드 매핑)

큰 덩어리 6개. 폴더 없이 flat. 모든 함수는 현재 단일 파일(옛 `frontend/v2/mockup/build.py`의 인라인 JS)에 실재하는 코드이며 빈 껍데기가 아니다.

| 파일 | 들어가는 함수 | 역할 |
|---|---|---|
| `engine.js` | `KkutuEngine` | 규칙. `export` 추가 |
| `game.js` | `commit`, `advance`, `finish`, `restart`, `playChainThenAdvance`, 라운드 라이프사이클, `state`/`locked` | 글루. engine·ui·tts·drag·effect를 엮음 |
| `ui.js` | `renderRound`, `renderProgress`, `fillDrop` | state를 받아 화면만 그림 |
| `drag.js` | `attachCard`, `snapCommit`, `springBack`, `armDrop`, `disarmDrop`, `isOverDrop`, `attachListen` | 입력. `onCommit` 콜백으로 game에 알림 |
| `tts.js` | `speak`, `speakRound`, `_utter`, `_pickVoice`, `bindSpeaking` | 음성 래퍼 |
| `effect.js` | `spawnSparks`, `clearSparks`, `chainPulse` | 시각 효과 |

### 경계 처리 (명시)

1. **`playChainThenAdvance`** (정답 후 "단어→글자→답" 낭독+진행)는 tts와 흐름에 양다리를 걸친다. → **`game.js`에 두고 `tts.speak`를 호출**한다 (진행 제어가 본질).
2. **`drag.js`는 `game.commit`·`tts.speak`·`effect.spawnSparks`를 호출**한다. → 직접 import 대신 **game이 콜백으로 주입**한다: `attachDrag(card, { onCommit, speak, spark })`. drag가 독립적으로 읽히도록.
3. 로딩은 ES 모듈. `index.html`은 `<script type="module" src="src/game.js">` (또는 `main`) 하나로 진입, 각 모듈은 `import`/`export`. `engine.js`는 `export class KkutuEngine` 한 줄만 추가.

## 5. 로드맵 (Phase)

목표 구조는 north star. 지금 전부 하지 않는다.

### Phase 1 — 지금 (리뷰용 최소)
- `frontend/v2`를 모듈 정적 파일로 변환 (build.py f-string에서 CSS/JS 꺼내기, base64 제거, 폰트 woff2 1회 변환).
- src를 **위 6개 파일**로 분해.
- `backend/` → `src/engine.js` + `data/` + `tools/` + `test/`로 재배치.
- 루트앱·`v1` → `archive/`.
- 루트 위생: `backend.txt` 삭제, 빈 `README.md` 채움, `wordchain_v1.md` → `docs/`, `.gitignore`에 `.DS_Store` 보강.
- v2 에셋(font/img/words.json) **반드시 커밋** (현재 untracked라 clone하면 안 보임).

### Phase 2 — 나중 (풀 리팩토링, 앱이 커지면)
- 화면이 여러 개로 늘면 `scenes/`(GameScene/ResultScene), 재사용 조각이 많아지면 `components/`(PromptCard/OptionCard/DropSlot/…)로 더 세분화.
- 지금은 YAGNI. Phase 1의 6파일이 자연히 이 방향으로 쪼개질 수 있게만 둔다.

## 6. 열린 항목 (구현 전 결정/확인)

1. **단어 데이터 이중성** — 앱은 `words.json`(258, 그림 포함), 엔진 README는 `word-pool.json`(308)을 씀. 앱이 어느 것을 진실로 쓸지 정리 필요. 일단 둘 다 `data/`에 두고 추후 결정.
2. **참고용 원본 JSON** (`kids_nouns.json` 734, `kids_nouns_safe.json` 466) — 중간 산출물. → `archive/` 권장.
3. **미사용 이미지** — img 473장 중 ~258장만 사용. 추리기는 선택(나중에 해도 됨).
4. **목업 전용 껍데기** — 비율 토글(4:3/16:10/16:9)·크레딧 줄은 태블릿 미리보기용 데모 장치. 리뷰 데모 편의로 **남길지** / 실앱 깔끔함으로 **뺄지** 결정.
5. **`frontend/한승_AI와끝말잇기_프로토타입.html`** (281KB 독립 프로토타입) — 정체/소유 확인 후 `archive/` 또는 삭제.

## 7. 검증 요건

build.py를 폐기하고 모듈로 재편한 뒤, localhost에서 **동작이 기존과 동일한지** 반드시 확인한다:
드래그+스냅 / 음성(TTS) / 별 파티클 / 정답 후 "단어→글자→답" 연결 낭독 / 탭-투-리슨 / 라운드 진행 / 종료·재시작. 엔진은 `node test/engine.test.js`로 회귀 확인.
