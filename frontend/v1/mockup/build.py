# -*- coding: utf-8 -*-
"""
끝말 잇기 V1 디자인 목업 빌더 (자기완결 HTML 생성)
- 실제 엔진(backend/kkutu-engine.js) + 단어(words.json) + 그림(img/*.png)을 빌드 때
  읽어 단일 mockup.html에 인라인한다. 더미 SCENARIO 없이 진짜 게임 로직으로 돈다.
- "참조 인라인": 엔진 소스·단어·그림을 이 파일 본문에 붙여넣지 않고 빌드 때 읽어 박는다.
  → build.py 본문은 작게 유지된다.
- 생성된 mockup.html을 Artifact로 배포한다(HANDOFF.md 참고).
실행: python3 build.py
"""
import json, os, io, base64
from fontTools.ttLib import TTFont
from fontTools import subset

HERE = os.path.dirname(os.path.abspath(__file__))
FONT_DIR    = os.path.join(HERE, "..", "font")
IMG_DIR     = os.path.join(HERE, "..", "img")
WORDS_PATH  = os.path.join(HERE, "..", "words.json")
ENGINE_PATH = os.path.join(HERE, "..", "..", "..", "backend", "kkutu-engine.js")

TARGET = 5   # 아이가 답해야 하는 횟수(엔진 targetAnswers)

# --- 단어 + 그림 인라인 -------------------------------------------------------
# words.json: [{word, pic}, ...]. 엔진엔 단어 문자열만, 그림은 word->dataURI 맵.
words_data = json.load(open(WORDS_PATH, encoding="utf-8"))["words"]
WORD_LIST = [w["word"] for w in words_data]

IMG = {}
for w in words_data:
    p = os.path.join(IMG_DIR, str(w["pic"]) + ".png")
    with open(p, "rb") as f:
        IMG[w["word"]] = "data:image/png;base64," + base64.b64encode(f.read()).decode()

# --- 엔진 소스 인라인 (f-string 밖에서 치환 — JS 브레이스 충돌 회피) ----------
engine_src = open(ENGINE_PATH, encoding="utf-8").read()

words_js = json.dumps(WORD_LIST, ensure_ascii=False)
img_js   = json.dumps(IMG, ensure_ascii=False)

# --- 폰트 서브셋: 화면에 나올 수 있는 모든 글자(전체 단어 + UI)만 woff2로 인라인 ---
UI_TEXT = (
    "끝말 잇기 로 시작하는 말은? 다시 듣기 말하기 다 이었어요! 진행 "
    "태블릿 비율 미리보기 그림 뒤로 가기 준비 중 "
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    " .,!?:'\"()/+-·ÁÉÍÓÚÑáéíóúñ"  # 크레딧(스페인어 이름)·라틴 보조
)
chars = set(UI_TEXT)
for w in WORD_LIST:
    chars.update(w)

def subset_woff2(ttf_path, text):
    font = TTFont(ttf_path)
    opts = subset.Options()
    opts.flavor = "woff2"
    opts.desubroutinize = True
    ss = subset.Subsetter(options=opts)
    ss.populate(text=text)
    ss.subset(font)
    font.flavor = "woff2"  # API에선 opts.flavor가 적용 안 돼 직접 세팅(안 하면 TTF로 저장됨)
    buf = io.BytesIO(); font.save(buf)
    return "data:font/woff2;base64," + base64.b64encode(buf.getvalue()).decode()

text = "".join(sorted(chars))
F = {
    "Jua":   subset_woff2(os.path.join(FONT_DIR, "Jua-Regular.ttf"), text),
    "Gowun": subset_woff2(os.path.join(FONT_DIR, "GowunDodum-Regular.ttf"), text),
}

html = f'''<style>
  @font-face {{ font-family:"Jua"; src:url("{F['Jua']}") format("woff2"); font-display:swap; }}
  @font-face {{ font-family:"Gowun"; src:url("{F['Gowun']}") format("woff2"); font-display:swap; }}
  :root {{
    --bg-top:#E8F1F8; --bg-bot:#FBF6EE; --surface:#FFFFFF;
    --ink:#38444F; --ink-soft:#94A3B1; --line:#E4ECF3; --line-strong:#D2DDE7;
    --couple:#EE9740; --couple-soft:#FCE8D0; --success:#54B98A; --success-soft:#E3F3EB;
    --card-edge:#F1B53C; --card-edge-strong:#E0A22B; --voice:#5BA7C4; --voice-soft:#E7F2F7;
    --display:"Jua","Apple SD Gothic Neo",sans-serif; --ui:"Gowun","Apple SD Gothic Neo",sans-serif;
  }}
  *{{ box-sizing:border-box; }}
  .page {{ display:flex; flex-direction:column; align-items:center; gap:10px; padding:18px 12px 24px;
    font-family:var(--ui); color:var(--ink); }}
  .controls {{ display:flex; gap:8px; align-items:center; flex-wrap:wrap; justify-content:center; }}
  .controls span {{ font-size:13px; color:#7c8a99; }}
  .controls button {{ font:inherit; font-size:13px; cursor:pointer; border:1px solid #cdd9e4; background:#fff;
    border-radius:8px; padding:6px 12px; color:#33414f; }}
  .controls button.active {{ background:#38444F; color:#fff; border-color:#38444F; }}

  .device {{ container-type:size; width:min(100%,1180px); aspect-ratio:4/3;
    border-radius:22px; overflow:hidden; box-shadow:0 22px 50px rgba(56,68,79,.22);
    border:10px solid #2b333c; background:#000; }}
  .device.r1610 {{ aspect-ratio:16/10; }}
  .device.r169 {{ aspect-ratio:16/9; }}
  .wrap {{ width:100%; height:100%; overflow:hidden;
    background:linear-gradient(168deg,var(--bg-top),var(--bg-bot));
    padding:3.4cqh 4cqw 2cqh; display:flex; flex-direction:column; gap:2.2cqh; }}

  .topbar {{ display:grid; grid-template-columns:1fr auto 1fr; align-items:center; }}
  /* 박스 없는 화살표 자체가 버튼(레퍼런스 형태). 색은 목업 톤(ink) + 가벼운 드롭섀도 */
  .back {{ justify-self:start; background:none; border:0; padding:0; cursor:pointer; line-height:0;
    display:flex; align-items:center; justify-content:center; transition:transform .12s ease; }}
  .back:hover {{ transform:translateX(-2px); }}
  .back:active {{ transform:scale(.9); }}
  .back:focus-visible {{ outline:0.6cqmin solid var(--couple); outline-offset:0.6cqmin; border-radius:2cqmin; }}
  .back svg {{ width:9.6cqmin; height:9.6cqmin; filter:drop-shadow(0 0.4cqmin 0.5cqmin rgba(56,68,79,.18)); }}
  .progress {{ justify-self:center; display:flex; align-items:center; gap:1.6cqmin; }}
  .step {{ display:inline-block; transition:background .3s ease, width .3s ease, height .3s ease; }}
  .step.done {{ width:2cqmin; height:2cqmin; border-radius:50%; background:var(--success); }}
  .step.cur {{ width:2.6cqmin; height:2.6cqmin; border-radius:50%; background:#fff; border:0.6cqmin solid var(--couple); }}
  .step.todo {{ width:3.4cqmin; height:0.7cqmin; border-radius:1cqmin; background:var(--line-strong); }}
  /* 안내 박스: [스피커] + 문구를 한 덩어리로(레퍼런스 배치). 스타일은 목업 언어(흰 알약·쿨그레이 테두리·부드러운 그림자) */
  .prompt {{ display:inline-flex; align-items:center; gap:2cqmin;
    background:var(--surface); border:0.5cqmin solid var(--line-strong); border-radius:99cqmin;
    padding:1.4cqmin 3.4cqmin 1.4cqmin 1.6cqmin; box-shadow:0 8px 18px rgba(56,68,79,.10); }}
  .prompt__speaker {{ flex:none; width:7cqmin; height:7cqmin; border-radius:50%; background:var(--voice);
    border:0; padding:0; cursor:pointer; display:flex; align-items:center; justify-content:center;
    box-shadow:0 0.5cqmin 1.2cqmin rgba(91,167,196,.32);
    transition:transform .12s ease, box-shadow .12s ease; }}
  .prompt__speaker:hover {{ transform:translateY(-2px); box-shadow:0 1cqmin 2cqmin rgba(91,167,196,.40); }}
  .prompt__speaker:active {{ transform:scale(.92); box-shadow:0 0.4cqmin 0.9cqmin rgba(91,167,196,.34); }}
  .prompt__speaker:focus-visible {{ outline:0.6cqmin solid var(--voice); outline-offset:0.4cqmin; }}
  .prompt__speaker svg {{ width:3.8cqmin; height:3.8cqmin; }}
  .prompt__text {{ margin:0; font-family:var(--display); font-size:4.8cqmin; color:var(--ink); }}
  .prompt__text .syl {{ color:var(--couple); }}

  .stage {{ flex:1; min-height:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2cqh; }}
  .now {{ display:flex; align-items:center; justify-content:center; gap:0; }}
  /* 보기 카드(.opt)와 같은 치수 — 이전 단어/드롭존/보기를 한 종류의 "단어 카드"로 통일 */
  .now__card {{ background:var(--surface); border:0.5cqmin solid var(--line-strong); border-radius:3.8cqmin;
    padding:2.6cqmin 2cqmin 2.2cqmin; width:22cqw; display:flex; flex-direction:column;
    align-items:center; justify-content:center; gap:1.2cqmin; box-shadow:0 8px 18px rgba(56,68,79,.08); }}
  .now__pic {{ width:16.5cqmin; height:16.5cqmin; object-fit:contain; }}
  .now__word {{ font-family:var(--display); font-size:4.7cqmin; color:var(--ink); }}
  .now__word .syl {{ color:var(--couple); }}
  .link {{ display:flex; align-items:center; }}
  .link__bar {{ width:2.8cqmin; height:0.6cqmin; background:var(--couple); }}
  .link__tok {{ min-width:7.2cqmin; height:7.2cqmin; padding:0 1.2cqmin; border-radius:50%;
    background:var(--couple-soft); border:0.65cqmin solid var(--couple); color:var(--couple);
    font-family:var(--display); font-size:4.35cqmin; display:flex; align-items:center; justify-content:center; }}

  /* 큰 드롭존: 보기 카드와 같은 크기로 키워 카드가 1:1로 안착 */
  .drop {{ width:22cqw; min-height:30cqmin; border:0.8cqmin dashed var(--couple);
    background:var(--couple-soft); border-radius:3.8cqmin;
    display:flex; flex-direction:column; align-items:center; justify-content:center; gap:1.2cqmin;
    padding:2.6cqmin 2cqmin 2.2cqmin; }}
  .drop .drop__q {{ font-family:var(--display); font-size:11cqmin; color:var(--couple);
    animation:breathe 2.2s ease-in-out infinite; }}
  .drop--filled {{ border-style:solid; border-color:var(--success); background:var(--surface);
    box-shadow:0 10px 22px rgba(84,185,138,.18); animation:pop .32s ease; }}
  .drop--filled .opt__pic {{ width:16.5cqmin; height:16.5cqmin; object-fit:contain; }}
  .drop--filled .opt__word {{ font-family:var(--display); font-size:4.7cqmin; }}

  .options {{ display:flex; align-items:stretch; justify-content:center; gap:2.4cqw; flex-wrap:nowrap; margin-top:1.2cqh; }}
  .opt {{ font-family:var(--display); background:var(--surface); border:0.8cqmin solid var(--card-edge);
    border-radius:3.8cqmin; box-shadow:0 10px 22px rgba(56,68,79,.10); padding:2.6cqmin 2cqmin 2.2cqmin; width:22cqw;
    display:flex; flex-direction:column; align-items:center; justify-content:center; gap:1.2cqmin; cursor:pointer;
    transition:transform .1s ease, box-shadow .1s ease, border-color .1s ease, opacity .2s ease; }}
  .opt:hover {{ transform:translateY(-4px); box-shadow:0 18px 32px rgba(56,68,79,.16); border-color:var(--card-edge-strong); }}
  .opt:active {{ transform:translateY(0) scale(.97); box-shadow:0 6px 14px rgba(56,68,79,.14); border-color:var(--card-edge-strong); }}
  .opt:focus-visible {{ outline:0.6cqmin solid var(--couple); outline-offset:0.4cqmin; }}
  .opt__pic {{ width:16.5cqmin; height:16.5cqmin; object-fit:contain; }}
  .opt__word {{ font-size:4.7cqmin; }}
  .opt--voice {{ width:12.5cqw; background:var(--voice-soft); border-color:var(--voice); }}
  .opt--voice:hover {{ border-color:var(--voice); }}
  .opt--voice .opt__mic {{ width:9cqmin; height:9cqmin; display:flex; align-items:center; justify-content:center; font-size:8.5cqmin; }}
  .opt--voice .opt__word {{ color:var(--voice); }}

  .done {{ display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2.2cqh;
    animation:pop .4s ease; }}
  .done__mark {{ font-size:16cqmin; }}
  .done__msg {{ margin:0; font-family:var(--display); font-size:6.2cqmin; color:var(--success); }}

  .credit {{ text-align:center; font-size:12px; color:#9aa7b4; }}
  @keyframes breathe {{ 0%,100%{{ transform:scale(1); }} 50%{{ transform:scale(1.05); }} }}
  @keyframes pop {{ 0%{{ transform:scale(.82); }} 60%{{ transform:scale(1.04); }} 100%{{ transform:scale(1); }} }}
  @media (prefers-reduced-motion:reduce) {{ *{{ animation:none!important; }} }}
</style>

<div class="page">
  <div class="controls">
    <span>태블릿 비율 미리보기:</span>
    <button data-r="">4:3 (iPad)</button>
    <button data-r="r1610" class="active">16:10 · Tab A11+</button>
    <button data-r="r169">16:9</button>
  </div>
  <div class="device r1610" id="device">
    <div class="wrap">
      <header class="topbar">
        <button class="back" type="button" aria-label="뒤로 가기"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M6.5 16L16 7V13H25V19H16V25Z" fill="#38444F" stroke="#38444F" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/></svg></button>
        <div class="progress" id="progress" role="img" aria-label="진행 0 / {TARGET}"></div>
      </header>
      <section class="stage" id="stage" aria-label="지금 차례">
        <div class="now">
          <div class="now__card">
            <img class="now__pic" id="nowPic" alt="">
            <div class="now__word" id="nowWord"></div>
          </div>
          <div class="link"><span class="link__bar"></span><span class="link__tok" id="linkTok"></span><span class="link__bar"></span></div>
          <div class="drop" id="drop"><span class="drop__q">?</span></div>
        </div>
        <div class="prompt" id="prompt">
          <button class="prompt__speaker" type="button" aria-label="다시 듣기"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 9.2H6.6L11.5 5V19L6.6 14.8H3Z" fill="#fff"/><path d="M15 8.6a4.6 4.6 0 0 1 0 6.8" stroke="#fff" stroke-width="1.9" stroke-linecap="round"/><path d="M17.7 6a8.2 8.2 0 0 1 0 12" stroke="#fff" stroke-width="1.9" stroke-linecap="round"/></svg></button>
          <p class="prompt__text" id="promptText"></p>
        </div>
      </section>
      <section class="options" id="options" aria-label="고를 수 있는 단어"></section>
    </div>
  </div>
  <div class="credit">그림: ARASAAC · CC BY-NC-SA · Sergio Palao / Gobierno de Aragón</div>
</div>
<script>%%ENGINE%%</script>
<script>
  const WORDS = {words_js};
  const IMG = {img_js};
  const TARGET = {TARGET};
  const reduceMotion = matchMedia('(prefers-reduced-motion:reduce)').matches;

  // 매 판 다른 게임(실제 플레이). 같은 판 반복이 필요하면 rng:시드함수 를 넘기면 됨.
  const engine = new KkutuEngine(WORDS, {{ targetAnswers: TARGET }});
  let state = engine.start();
  let locked = false;
  const $ = id => document.getElementById(id);

  function renderProgress() {{
    const p = $('progress'); p.innerHTML = '';
    const cur = state.childAnswers;
    for (let k = 0; k < TARGET; k++) {{
      const s = document.createElement('span');
      s.className = 'step ' + (k < cur ? 'done' : (k === cur ? 'cur' : 'todo'));
      p.appendChild(s);
    }}
    p.setAttribute('aria-label', '진행 ' + cur + ' / ' + TARGET);
  }}

  // now = state.lastWord(응답 대상 = 직전 AI 단어). 끝글자 = state.currentSyllable(공유 글자)
  function renderRound() {{
    const now = state.lastWord;
    const syl = state.currentSyllable;
    $('nowPic').src = IMG[now] || ''; $('nowPic').alt = now;
    $('nowWord').innerHTML = now.slice(0, -1) + '<span class="syl">' + now.slice(-1) + '</span>';
    $('linkTok').textContent = syl;
    $('promptText').innerHTML = "'<span class=\\"syl\\">" + syl + "</span>' 로 시작하는 말은?";

    const drop = $('drop');
    drop.className = 'drop'; drop.innerHTML = '<span class="drop__q">?</span>';

    const opts = $('options'); opts.innerHTML = '';
    state.options.forEach(w => {{          // 엔진 보장: 2~3개(전부 정답)
      const b = document.createElement('button');
      b.className = 'opt'; b.type = 'button';
      b.innerHTML = '<img class="opt__pic" src="' + (IMG[w] || '') + '" alt="' + w + '"><span class="opt__word">' + w + '</span>';
      b.addEventListener('click', () => onPick(w, b));
      opts.appendChild(b);
    }});
    const v = document.createElement('button');
    v.className = 'opt opt--voice'; v.type = 'button';
    v.setAttribute('aria-label', '말하기 (준비 중)');
    v.innerHTML = '<span class="opt__mic" aria-hidden="true">🎤</span><span class="opt__word">말하기</span>';
    opts.appendChild(v);   // 표시만(no-op)

    renderProgress();
  }}

  function fillDrop(word) {{
    const drop = $('drop');
    drop.className = 'drop drop--filled';
    drop.innerHTML = '<img class="opt__pic" src="' + (IMG[word] || '') + '" alt="' + word + '"><span class="opt__word">' + word + '</span>';
  }}

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

  // 아이 한 수 + (안 끝났으면) AI 한 수를 엔진이 처리 → 480ms 후 다음 라운드
  function commit(word) {{
    fillDrop(word);
    state = engine.answer(word);
    setTimeout(advance, 480);
  }}

  function advance() {{
    if (state.status !== 'playing') {{ finish(); return; }}
    renderRound();          // now가 새 AI 단어로 갱신(모델 A)
    locked = false;
  }}

  function finish() {{
    renderProgress();
    $('options').innerHTML = '';
    $('stage').innerHTML =
      '<div class="done"><div class="done__mark" aria-hidden="true">🎉</div>' +
      '<p class="done__msg">다 이었어요!</p></div>';
  }}

  // 비율 토글
  const dev = $('device');
  document.querySelectorAll('.controls button').forEach(b => b.addEventListener('click', () => {{
    document.querySelectorAll('.controls button').forEach(x => x.classList.remove('active'));
    b.classList.add('active'); dev.className = 'device' + (b.dataset.r ? ' ' + b.dataset.r : '');
  }}));

  renderRound();
</script>'''

html = html.replace("%%ENGINE%%", engine_src)

out = os.path.join(HERE, "mockup.html")
open(out, "w").write(html)
print("wrote", out, len(html), "bytes |",
      "pool", len(WORD_LIST), "words |", len(IMG), "images |", "target", TARGET)
