/* ============================================================
   끝말 기차 — Version 1  (UI 레이어)
   엔진(kkutu-engine.js)은 그대로 사용. 상태는 엔진이 단독 소유,
   app.js는 state -> 화면만 그린다.
   기능: 그림 카드(ARASAAC) · 터치=읽고+선택 · 자동 음성 프롬프트
        · 성공 보상(별/차임) · 완주 후 돌아보기.
   ============================================================ */
(function () {
  "use strict";

  var engine = null;
  var picMap = Object.create(null);   // 단어 -> ARASAAC 그림 id
  var prevCars = 0;                    // 직전 렌더의 칸 수(새 칸 애니메이션용)
  var turnSeq = 0;                     // 현재 차례 식별(중복 음성 방지)

  // ---- DOM 핸들 ----
  var $progress, $train, $prompt, $options, $result, $resultTrain;

  // ---------------------------------------------------------
  // 음성 (Web Speech API)
  // ---------------------------------------------------------
  var koVoice = null;
  function pickVoice() {
    if (!("speechSynthesis" in window)) return;
    var vs = window.speechSynthesis.getVoices();
    koVoice = vs.filter(function (v) { return /ko/i.test(v.lang); })[0] || null;
  }
  if ("speechSynthesis" in window) {
    pickVoice();
    window.speechSynthesis.onvoiceschanged = pickVoice;
  }
  function speak(text, opts) {
    if (!("speechSynthesis" in window) || !text) return;
    opts = opts || {};
    if (!opts.queue) window.speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(text);
    u.lang = "ko-KR";
    if (koVoice) u.voice = koVoice;
    u.rate = 0.92;       // 아이용으로 조금 천천히
    u.pitch = 1.05;
    window.speechSynthesis.speak(u);
  }

  // ---------------------------------------------------------
  // 보상 소리 (WebAudio, 외부 파일 없음) — 부드러운 두 음 차임
  // ---------------------------------------------------------
  var audioCtx = null;
  function chime() {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      var t0 = audioCtx.currentTime;
      [659.25, 880.0].forEach(function (freq, i) {   // E5, A5
        var o = audioCtx.createOscillator();
        var g = audioCtx.createGain();
        o.type = "sine"; o.frequency.value = freq;
        var start = t0 + i * 0.12;
        g.gain.setValueAtTime(0, start);
        g.gain.linearRampToValueAtTime(0.18, start + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, start + 0.45);
        o.connect(g); g.connect(audioCtx.destination);
        o.start(start); o.stop(start + 0.5);
      });
    } catch (e) { /* 오디오 미지원이면 조용히 무시 */ }
  }

  // ---------------------------------------------------------
  // 그림 카드 헬퍼
  // ---------------------------------------------------------
  function picSrc(word) {
    var id = picMap[word];
    return id != null ? "img/" + id + ".png" : "";
  }
  function makeImg(word, cls) {
    var img = document.createElement("img");
    img.className = cls;
    img.src = picSrc(word);
    img.alt = word;
    img.draggable = false;
    return img;
  }

  // ---------------------------------------------------------
  // 기차 렌더 (메인/돌아보기 공용)
  //   history: [{by, word}], opts.next: 다음 음절(placeholder 표시), opts.animateFrom
  // ---------------------------------------------------------
  function renderTrain(container, history, opts) {
    opts = opts || {};
    container.innerHTML = "";
    history.forEach(function (h, i) {
      if (i > 0) {
        // 연결고리 = 공유 글자(앞 단어 끝 = 이 단어 첫 글자)
        var couple = document.createElement("div");
        couple.className = "couple";
        couple.innerHTML = '<div class="couple__hook"></div>' +
          '<div class="couple__token">' + h.word[0] + "</div>";
        container.appendChild(couple);
      }
      var car = document.createElement("div");
      car.className = "car";
      if (opts.animateFrom != null && i >= opts.animateFrom) car.className += " car--new";
      car.innerHTML =
        '<div class="car__body">' +
          '<div class="car__word">' + h.word + "</div>" +
          '<div class="car__wheels"><span></span><span></span></div>' +
        "</div>";
      var body = car.querySelector(".car__body");
      body.insertBefore(makeImg(h.word, "car__pic"), body.firstChild);
      body.addEventListener("click", function () { speak(h.word); });
      container.appendChild(car);
    });

    if (opts.next) {
      var c2 = document.createElement("div");
      c2.className = "couple";
      c2.innerHTML = '<div class="couple__hook"></div>' +
        '<div class="couple__token">' + opts.next + "</div>";
      container.appendChild(c2);
      var ph = document.createElement("div");
      ph.className = "car is-next";
      ph.innerHTML = '<div class="car__body"><div class="car__q">?</div></div>';
      container.appendChild(ph);
    }
    // 항상 최신 칸이 보이도록 오른쪽 끝으로
    requestAnimationFrame(function () { container.scrollLeft = container.scrollWidth; });
  }

  // ---------------------------------------------------------
  // 진행 별
  // ---------------------------------------------------------
  function renderProgress(done, total, justOne) {
    $progress.innerHTML = "";
    for (var i = 0; i < total; i++) {
      var s = document.createElement("span");
      s.className = "star" + (i < done ? " is-on" : "");
      if (justOne && i === done - 1) s.className += " just-on";
      $progress.appendChild(s);
    }
    $progress.setAttribute("aria-label", "진행도 " + done + " / " + total);
  }

  // ---------------------------------------------------------
  // 프롬프트
  // ---------------------------------------------------------
  function promptText(syl) { return syl + "로 시작하는 말은?"; }
  function renderPrompt(syl) {
    $prompt.innerHTML = "‘<span class=\"syl\">" + syl + "</span>’ 로 시작하는 말은?";
  }

  // ---------------------------------------------------------
  // 메인 렌더
  // ---------------------------------------------------------
  function render(state, opts) {
    opts = opts || {};
    var cars = state.history.length;
    var animateFrom = opts.animate ? prevCars : null;

    if (state.status === "playing") {
      renderProgress(state.childAnswers, state.targetAnswers, opts.animate);
      renderTrain($train, state.history, { next: state.currentSyllable, animateFrom: animateFrom });
      renderPrompt(state.currentSyllable);
      renderOptions(state.options);
      $result.hidden = true;
    } else {
      // won (또는 방어적 lost) — 돌아보기 화면
      renderProgress(state.childAnswers, state.targetAnswers, opts.animate);
      renderTrain($train, state.history, { animateFrom: animateFrom });
      $options.innerHTML = "";
      showResult(state);
    }
    prevCars = cars;
  }

  function renderOptions(options) {
    $options.innerHTML = "";
    options.forEach(function (word) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "opt";
      btn.innerHTML = '<div class="opt__word">' + word + "</div>";
      btn.insertBefore(makeImg(word, "opt__pic"), btn.firstChild);
      btn.addEventListener("click", function () { onCardClick(word, btn); });
      $options.appendChild(btn);
    });
  }

  // ---------------------------------------------------------
  // 차례 음성 안내 (자동 읽어주기)
  // ---------------------------------------------------------
  function announceTurn(state, mySeq) {
    if (mySeq !== turnSeq) return;             // 이미 다음 차례로 넘어갔으면 취소
    if (state.status === "playing") speak(promptText(state.currentSyllable));
  }

  // ---------------------------------------------------------
  // 카드 터치 = 읽고 + 선택
  // ---------------------------------------------------------
  function onCardClick(word, btn) {
    if (!engine || engine.getState().status !== "playing") return;
    turnSeq++;
    speak(word);                 // 1) 고른 단어 읽어주기
    btn.classList.add("is-picked");
    chime();                     // 2) 보상 소리

    var state = engine.answer(word);   // 3) 엔진: 아이 + AI 한 수
    render(state, { animate: true });  // 4) 새 칸 등장 + 별 채움

    if (state.status === "playing") {
      var mySeq = turnSeq;
      window.setTimeout(function () { announceTurn(state, mySeq); }, 1100);
    } else {
      window.setTimeout(function () { speak("참 잘했어요! 기차가 완성됐어요."); }, 900);
    }
  }

  // ---------------------------------------------------------
  // 완주 후 돌아보기
  // ---------------------------------------------------------
  function showResult(state) {
    renderTrain($resultTrain, state.history, {});
    $result.hidden = false;
  }
  function replayAll(history) {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    history.forEach(function (h) { speak(h.word, { queue: true }); });
  }

  // ---------------------------------------------------------
  // 시작 / 초기화
  // ---------------------------------------------------------
  function startGame() {
    turnSeq++;
    prevCars = 0;
    var state = engine.start();
    render(state, { animate: false });
    var mySeq = turnSeq;
    window.setTimeout(function () { announceTurn(state, mySeq); }, 500);
  }

  async function init() {
    $progress = document.getElementById("progress");
    $train = document.getElementById("train");
    $prompt = document.getElementById("prompt");
    $options = document.getElementById("options");
    $result = document.getElementById("result");
    $resultTrain = document.getElementById("result-train");

    document.getElementById("replay").addEventListener("click", function () {
      var s = engine && engine.getState();
      if (s && s.status === "playing") speak(promptText(s.currentSyllable));
    });
    document.getElementById("result-replay").addEventListener("click", function () {
      var s = engine && engine.getState();
      if (s) replayAll(s.history);
    });
    document.getElementById("restart").addEventListener("click", startGame);

    try {
      var res = await fetch("words.json");
      if (!res.ok) throw new Error("HTTP " + res.status);
      var data = await res.json();
      data.words.forEach(function (w) { picMap[w.word] = w.pic; });
      engine = new KkutuEngine(data.words, { targetAnswers: 5 });
      startGame();
    } catch (e) {
      $prompt.textContent = "단어를 불러오지 못했어요. 로컬 서버(python3 -m http.server)로 열었는지 확인해 주세요.";
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
