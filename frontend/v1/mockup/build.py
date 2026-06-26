# -*- coding: utf-8 -*-
"""
끝말 잇기 V1 디자인 목업 빌더 (자기완결 HTML 생성)
- 같은 폴더의 assets.json(폰트·픽토그램 base64)을 읽어 mockup.html을 생성한다.
- v1: 보기 카드를 '탭'하면 카드가 큰 드롭존으로 날아가 채워지고, 미리 짜둔
  더미 시나리오의 다음 라운드로 진행한다. (드래그=v2, 엔진 연결=다음 단계)
- 생성된 mockup.html을 Artifact로 배포한다(HANDOFF.md 참고).
실행: python3 build.py
"""
import json, os, io, base64
from fontTools.ttLib import TTFont
from fontTools import subset
HERE = os.path.dirname(os.path.abspath(__file__))
d = json.load(open(os.path.join(HERE, "assets.json")))
A = d["assets"]
FONT_DIR = os.path.join(HERE, "..", "font")

# --- 더미 시나리오 (자동 큐레이션, 모든 단어 그림 보유 확인됨) ---------------
# 한 라운드 모양은 나중에 엔진 toView 출력과 정렬되도록 잡음:
#   now=방금 만든 말(직전 단어), tail=공유 글자(now의 끝/보기 첫 글자),
#   options=보기 3개, answer=체인을 잇는 정답.
SCENARIO = [
    {"now": "간호사", "tail": "사", "options": ["사과", "사탕", "사자"],     "answer": "사과"},
    {"now": "사과",   "tail": "과", "options": ["과자", "과일", "과학"],     "answer": "과자"},
    {"now": "과자",   "tail": "자", "options": ["자전거", "자동차", "자두"], "answer": "자전거"},
    {"now": "자전거", "tail": "거", "options": ["거북이", "거위", "거실"],   "answer": "거북이"},
    {"now": "거북이", "tail": "이", "options": ["이야기", "이불", "이마"],   "answer": "이야기"},
    {"now": "이야기", "tail": "기", "options": ["기차", "기저귀", "기린"],   "answer": "기차"},
]

# 시나리오에 쓰이는 모든 단어의 그림 data URI만 JS로 임베드
used = set()
for r in SCENARIO:
    used.add(r["now"])
    used.update(r["options"])
IMG = {w: A[w]["uri"] for w in used}

scenario_js = json.dumps(SCENARIO, ensure_ascii=False)
img_js = json.dumps(IMG, ensure_ascii=False)

# --- 폰트 서브셋: 화면에 실제로 쓰는 글자만 TTF에서 잘라 woff2로 인라인 ---------
# (서브셋을 미리 구워두면 단어가 바뀔 때 글자가 빠져 시스템 폰트로 폴백된다.
#  build 때마다 현재 텍스트 기준으로 다시 만들어 누락을 원천 차단한다.)
UI_TEXT = (
    "끝말 잇기 로 시작하는 말은? 다시 듣기 말하기 다 이었어요! 진행 "
    "태블릿 비율 미리보기 그림 "
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    " .,!?:'\"()/+-·ÁÉÍÓÚÑáéíóúñ"  # 크레딧(스페인어 이름)·라틴 보조
)
chars = set(UI_TEXT)
for r in SCENARIO:
    chars.update(r["now"]); chars.update(r["answer"])
    for o in r["options"]:
        chars.update(o)

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
    --card-edge:#DAD3C8; --card-edge-strong:#C2B6A6; --voice:#5BA7C4; --voice-soft:#E7F2F7;
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
  .brand {{ font-family:var(--display); font-size:3.2cqmin; justify-self:start; }}
  .progress {{ justify-self:center; display:flex; align-items:center; gap:1.6cqmin; }}
  .step {{ display:inline-block; transition:background .3s ease, width .3s ease, height .3s ease; }}
  .step.done {{ width:2cqmin; height:2cqmin; border-radius:50%; background:var(--success); }}
  .step.cur {{ width:2.6cqmin; height:2.6cqmin; border-radius:50%; background:#fff; border:0.6cqmin solid var(--couple); }}
  .step.todo {{ width:3.4cqmin; height:0.7cqmin; border-radius:1cqmin; background:var(--line-strong); }}
  .replay {{ justify-self:end; width:7cqmin; height:7cqmin; border-radius:50%; background:var(--surface);
    border:0.4cqmin solid var(--line-strong); box-shadow:0 4px 10px rgba(56,68,79,.10); cursor:pointer;
    font-size:3.4cqmin; display:flex; align-items:center; justify-content:center; }}

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
  .link__tok {{ min-width:4.8cqmin; height:4.8cqmin; padding:0 0.8cqmin; border-radius:50%;
    background:var(--couple-soft); border:0.45cqmin solid var(--couple); color:var(--couple);
    font-family:var(--display); font-size:2.9cqmin; display:flex; align-items:center; justify-content:center; }}

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

  .prompt {{ margin:0; text-align:center; font-family:var(--display); font-size:4.8cqmin; }}
  .prompt .syl {{ color:var(--couple); }}

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
        <div class="brand">끝말 잇기</div>
        <div class="progress" id="progress" role="img" aria-label="진행 0 / {len(SCENARIO)}"></div>
        <button class="replay" type="button" aria-label="다시 듣기"><span aria-hidden="true">🔊</span></button>
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
        <p class="prompt" id="prompt"></p>
      </section>
      <section class="options" id="options" aria-label="고를 수 있는 단어"></section>
    </div>
  </div>
  <div class="credit">그림: ARASAAC · CC BY-NC-SA · Sergio Palao / Gobierno de Aragón</div>
</div>
<script>
  const IMG = {img_js};
  const SCENARIO = {scenario_js};
  const TOTAL = SCENARIO.length;
  const reduceMotion = matchMedia('(prefers-reduced-motion:reduce)').matches;
  let idx = 0, locked = false;
  const $ = id => document.getElementById(id);

  function renderProgress(cur) {{
    const p = $('progress'); p.innerHTML = '';
    for (let k = 0; k < TOTAL; k++) {{
      const s = document.createElement('span');
      s.className = 'step ' + (k < cur ? 'done' : (k === cur ? 'cur' : 'todo'));
      p.appendChild(s);
    }}
    p.setAttribute('aria-label', '진행 ' + cur + ' / ' + TOTAL);
  }}

  function renderRound(i) {{
    const r = SCENARIO[i];
    const head = r.now.slice(0, -1), tail = r.now.slice(-1);
    $('nowPic').src = IMG[r.now]; $('nowPic').alt = r.now;
    $('nowWord').innerHTML = head + '<span class="syl">' + tail + '</span>';
    $('linkTok').textContent = r.tail;
    $('prompt').innerHTML = "'<span class=\\"syl\\">" + r.tail + "</span>' 로 시작하는 말은?";

    const drop = $('drop');
    drop.className = 'drop'; drop.innerHTML = '<span class="drop__q">?</span>';

    const opts = $('options'); opts.innerHTML = '';
    r.options.forEach(w => {{
      const b = document.createElement('button');
      b.className = 'opt'; b.type = 'button';
      b.innerHTML = '<img class="opt__pic" src="' + IMG[w] + '" alt="' + w + '"><span class="opt__word">' + w + '</span>';
      b.addEventListener('click', () => onPick(w, b));
      opts.appendChild(b);
    }});
    const v = document.createElement('button');
    v.className = 'opt opt--voice'; v.type = 'button';
    v.setAttribute('aria-label', '말하기 (준비 중)');
    v.innerHTML = '<span class="opt__mic" aria-hidden="true">🎤</span><span class="opt__word">말하기</span>';
    opts.appendChild(v);   // v1: 표시만, 동작 없음(no-op)

    renderProgress(i);
  }}

  function fillDrop(word) {{
    const drop = $('drop');
    drop.className = 'drop drop--filled';
    drop.innerHTML = '<img class="opt__pic" src="' + IMG[word] + '" alt="' + word + '"><span class="opt__word">' + word + '</span>';
  }}

  function onPick(word, btn) {{
    if (locked) return; locked = true;
    if (reduceMotion) {{ fillDrop(word); setTimeout(advance, 450); return; }}
    const c = btn.getBoundingClientRect(), dr = $('drop').getBoundingClientRect();
    const dx = (dr.left + dr.width / 2) - (c.left + c.width / 2);
    const dy = (dr.top + dr.height / 2) - (c.top + c.height / 2);
    const scale = dr.width / c.width;
    btn.parentNode.querySelectorAll('.opt').forEach(o => {{ if (o !== btn) o.style.opacity = '0.35'; }});
    btn.style.zIndex = '30';
    btn.style.transition = 'transform .38s cubic-bezier(.34,1.15,.5,1)';
    requestAnimationFrame(() => {{ btn.style.transform = 'translate(' + dx + 'px,' + dy + 'px) scale(' + scale + ')'; }});
    btn.addEventListener('transitionend', () => {{ fillDrop(word); setTimeout(advance, 480); }}, {{ once: true }});
  }}

  function advance() {{
    idx++;
    if (idx >= TOTAL) {{ finish(); return; }}
    renderRound(idx);
    locked = false;
  }}

  function finish() {{
    renderProgress(TOTAL);
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

  renderRound(0);
</script>'''

out = os.path.join(HERE, "mockup.html")
open(out, "w").write(html)
print("wrote", out, len(html), "bytes |", len(SCENARIO), "rounds |", len(IMG), "images inlined")
