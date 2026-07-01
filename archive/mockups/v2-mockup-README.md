# v2 mockup — 즉시 교체(jump-cut) 전환 버전

끝말잇기 디자인 목업의 **독립 버전**이다. v1의 하위/스냅샷이 아니라, v1과 **나란히 유지되는 별개 변종**이다.

- **v1 ↔ v2 차이 = 라운드 전환 방식뿐.** 나머지(드래그+스냅, TTS, 별 파티클, 정답 후 연결 낭독, 탭-투-리슨)는 공유.
  - **v1** (`frontend/v1/mockup/`): **2단계 컨베이어** 전환 — 정답 후 카드가 레인을 따라 슬라이드.
  - **v2** (여기): **즉시 교체(jump-cut)** 전환 — 정답 후 다음 라운드로 바로 갱신. 더 단순/차분.
- 두 버전 모두 **자체완결**(폰트·이미지·엔진 인라인)이라 `mockup.html`을 더블클릭하면 바로 돈다.

## 폴더 구성 (독립적으로 빌드 가능)

| 항목 | 내용 |
|---|---|
| `mockup.html` | 배포용 자기완결 목업(폰트·그림 base64 + 엔진 + 인터랙션 JS 내장, ~3.8MB). **직접 편집 금지** — 항상 `build.py`로 생성. **거대 파일이라 Read/cat 금지.** |
| `build.py` | `mockup.html`을 재생성. **디자인·인터랙션 수정은 전부 여기서.** f-string이라 JS 중괄호는 `{{ }}`. |
| `../words.json` | 단어 풀(258개). v2 폴더 자체 사본. |
| `../font/` | `Jua-Regular.ttf`, `GowunDodum-Regular.ttf`. 빌드 때 쓰는 글자만 서브셋해 woff2로 인라인. |
| `../img/` | 픽토그램 PNG. 단어별 `pic` id로 참조해 base64 인라인. |

> 엔진은 공용 `../../../backend/kkutu-engine.js`를 빌드 때 읽어 인라인한다(v1/v2 공통).

## 빌드 / 검증

```bash
cd frontend/v2/mockup
python3 build.py            # → mockup.html 재생성
```

- 빌드 의존성: `fonttools` + `brotli`(woff2 출력). 없으면 `pip install fonttools brotli`.
- 정적 검증: 2번째 `<script>`를 추출해 `node --check`로 JS 문법 확인(헤드리스 브라우저 없음).
- 동작·손맛 확인은 `mockup.html`을 **브라우저에서 직접** 연다.

## 인터랙션 (v1과 공유 + v2 고유)

- 보기 카드: 드래그 → ?칸에 겹치면 armed(글로우+별), 손 떼면 스냅 확정. 누르면 단어 TTS(ko-KR).
- 컴퓨터 차례: 메인카드 팝+단어 읽고 → 프롬프트 읽기. 정답 후 "직전단어 → 연결글자 → 내답" 순 낭독+팝.
- **탭-투-리슨:** 상단 제시 단어 카드(`.now__card`)·연결고리칸(`#linkTok`)을 누르면 각각 현재 단어/글자를 TTS 재생(내 차례에만, `chainPulse` 펄스 피드백). 설계: `docs/superpowers/specs/2026-06-29-tap-to-listen-prompt-and-link-design.md`.
