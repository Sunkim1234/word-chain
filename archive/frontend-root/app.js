/**
 * 끝말잇기 UI 레이어.
 * UMD: 브라우저에서는 전역 App, Node(테스트)에서는 module.exports.
 * 순수 함수 toView(state)만 우선 구현. DOM 렌더는 Task 2에서 추가.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.App = factory();
})(typeof self !== 'undefined' ? self : this, function () {

  /** 엔진 state -> 화면 렌더용 view 객체 (순수 함수, 부수효과 없음) */
  function toView(state) {
    return {
      status: state.status,
      progress: state.childAnswers + ' / ' + state.targetAnswers,
      prompt: state.currentSyllable
        ? "'" + state.currentSyllable + "'(으)로 시작하는 말은?"
        : '',
      lastWord: state.lastWord != null ? state.lastWord : null,
      options: state.options ? state.options.slice() : [],
    };
  }

  // --- 브라우저 DOM 레이어 -------------------------------------------------
  if (typeof document !== 'undefined') {
    let engine = null;

    async function init() {
      const promptEl = document.getElementById('prompt');
      try {
        const res = await fetch('../backend/kids_nouns_safe_2plus.json');
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        engine = new KkutuEngine(data.words, { targetAnswers: 5 });
        render(engine.start());
      } catch (e) {
        promptEl.textContent = '단어 데이터를 불러오지 못했습니다. 로컬 서버(python3 -m http.server)로 실행했는지 확인하세요.';
      }
    }

    function render(state) {
      const v = toView(state);
      document.getElementById('progress').textContent = v.progress;
      document.getElementById('last-word').textContent = v.lastWord || '';
      const promptEl = document.getElementById('prompt');
      const optionsEl = document.getElementById('options');
      const resultEl = document.getElementById('result');

      if (v.status === 'playing') {
        promptEl.textContent = v.prompt;
        resultEl.hidden = true;
        optionsEl.hidden = false;
        optionsEl.innerHTML = '';
        for (const word of v.options) {
          const btn = document.createElement('button');
          btn.className = 'card';
          btn.textContent = word;
          btn.addEventListener('click', function () { onCardClick(word); });
          optionsEl.appendChild(btn);
        }
      } else {
        optionsEl.hidden = true;
        optionsEl.innerHTML = '';
        resultEl.hidden = false;
        promptEl.textContent = v.status === 'won' ? '성공! 🎉' : '아쉽지만 끝났어요';
        document.getElementById('result-msg').textContent =
          v.status === 'won' ? '끝까지 잘 이었어요!' : '';
      }
    }

    function onCardClick(word) {
      render(engine.answer(word));
    }

    document.addEventListener('DOMContentLoaded', function () {
      document.getElementById('restart').addEventListener('click', function () {
        if (engine) render(engine.start());
      });
      init();
    });
  }

  return { toView };
});
