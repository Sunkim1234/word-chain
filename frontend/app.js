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

  return { toView };
});
