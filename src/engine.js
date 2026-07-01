/**
 * 유아·특수학교용 끝말잇기 엔진 (4단어 × 2라운드, AI/아이 교대)
 * ============================================================================
 * 구조
 *   - 한 라운드 = 4단어 체인 (1→2→3→4, 각 단어는 앞 단어의 끝 음절로 시작).
 *   - 총 2라운드, 두 라운드는 서로 독립(4번은 막다른 단어여도 됨, 다음 라운드는 새 1번으로 리셋).
 *   - 단어 재사용 없음(두 라운드 통틀어 전역 중복 금지).
 *
 * 턴 규칙 (핵심)
 *   - "AI가 둘 때만" 다음 사람의 보기가 항상 optionsCount(기본 3)개가 되도록,
 *     그리고 라운드 끝까지 막히지 않도록 미리 계산해서 둔다.
 *   - "아이가 둘 때는" 다음 보기 개수를 신경 쓰지 않는다(아이 다음은 항상 AI 차례이고,
 *     AI는 보기가 1개만 있어도 자기가 알아서 안전하게 두기 때문).
 *
 *   라운드 1: AI=(1,3),  아이=(2,4)   → AI가 먼저 시작
 *   라운드 2: 아이=(1,3), AI=(2,4)    → 아이가 먼저 시작 (역할 교대)
 *
 * 자리별 단어 풀
 *   - 1번: 시작단어 ∪ 중간단어
 *   - 2,3번: 중간단어
 *   - 4번: 끝단어 (보기 3개가 안 나오면 중간단어로 보충, 표시는 끝단어 우선)
 *
 * 사용 예 (브라우저)
 *   const [s, m, e] = await Promise.all([
 *     fetch('data/start-words.json').then(r => r.json()),
 *     fetch('data/middle-words.json').then(r => r.json()),
 *     fetch('data/end-words.json').then(r => r.json()),
 *   ]);
 *   const engine = new KkutuEngine({ start: s.words, middle: m.words, end: e.words });
 *   let state = engine.start();           // state.options = 보기 (전부 정답)
 *   state = engine.answer(chosenWord);    // 아이가 보기 중 하나 선택
 *   // state.status === 'won' 이면 2라운드까지 모두 성공
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.KkutuEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {

  function shuffle(arr, rnd) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // 라운드별 자리 담당자. 'ai' = 엔진이 자동, 'child' = 아이가 보기에서 선택.
  const ROLES = {
    1: { 1: 'ai',    2: 'child', 3: 'ai',    4: 'child' },
    2: { 1: 'child', 2: 'ai',    3: 'child', 4: 'ai' },
  };
  const TOTAL_ROUNDS = 2;
  const ROUND_LEN = 4;

  class KkutuEngine {
    /**
     * @param {Object} pools  { start:[...], middle:[...], end:[...] }
     *        각 원소는 문자열이거나 {word, category, ...} 객체.
     * @param {Object} [opts]
     * @param {number}   [opts.optionsCount=3] 아이 차례에 보여줄 보기 수(보장값)
     * @param {function} [opts.rng=Math.random] 난수 함수(시드 주입 가능)
     */
    constructor(pools, opts = {}) {
      this.optionsCount = opts.optionsCount || 3;
      this.rng = opts.rng || Math.random;

      const norm = (list) => (list || []).map((w) => {
        if (typeof w === 'string') return { word: w };
        return w;
      });
      const startW = norm(pools.start);
      const midW = norm(pools.middle);
      const endW = norm(pools.end);

      // 카테고리 메타
      this.meta = {};
      this.endChar = Object.create(null);  // 단어 -> 끝 음절
      const register = (objs) => {
        for (const o of objs) {
          if (o.category) this.meta[o.word] = o.category;
          this.endChar[o.word] = o.word[o.word.length - 1];
        }
      };
      register(startW); register(midW); register(endW);

      // 풀 분류 집합 (표시 우선순위 판단용)
      this.startSet = new Set(startW.map((o) => o.word));
      this.middleSet = new Set(midW.map((o) => o.word));
      this.endSet = new Set(endW.map((o) => o.word));

      // 자리별 후보 단어 목록
      const words = (objs) => objs.map((o) => o.word);
      this.posWords = {
        1: words(startW).concat(words(midW)),  // 시작 ∪ 중간
        2: words(midW),
        3: words(midW),
        4: words(endW).concat(words(midW)),    // 끝 (+중간 보충)
      };

      // 자리별 시작음절 인덱스: pos -> { 음절 -> [단어...] }
      this.posStartIndex = {};
      for (let p = 1; p <= ROUND_LEN; p++) {
        const idx = Object.create(null);
        for (const w of this.posWords[p]) {
          const c = w[0];
          (idx[c] || (idx[c] = [])).push(w);
        }
        this.posStartIndex[p] = idx;
      }

      this._resetState();
    }

    // --- 내부: 후보 추출 -------------------------------------------------

    /** position p, 시작음절 cur(또는 null=아무거나)로 시작하는 미사용 단어들 */
    _unusedAt(p, cur, used) {
      let list;
      if (p === 1 && cur == null) list = this.posWords[1];
      else list = this.posStartIndex[p][cur] || [];
      const out = [];
      for (const w of list) if (!used.has(w)) out.push(w);
      return out;
    }

    /**
     * canFill(round, p, cur, used):
     *   round의 자리 p(시작음절 cur)부터 라운드 끝(4번)까지 채울 수 있는가?
     *   - 자리 담당이 'child'면, 안전한 후보가 optionsCount개 이상 있어야 한다(아이는 아무거나 고름).
     *   - 자리 담당이 'ai'면, 안전한 후보가 1개 이상 있으면 된다(AI가 좋은 걸 고름).
     *   '안전한 후보' = 그 단어를 둔 뒤 다음 자리도 위 규칙대로 끝까지 갈 수 있는 단어.
     */
    _canFill(round, p, cur, used) {
      if (p > ROUND_LEN) return true;
      const need = ROLES[round][p] === 'child' ? this.optionsCount : 1;
      let good = 0;
      for (const w of this._unusedAt(p, cur, used)) {
        used.add(w);
        const ok = this._canFill(round, p + 1, this.endChar[w], used);
        used.delete(w);
        if (ok && ++good >= need) return true;
      }
      return good >= need;
    }

    /** 끝단어 우선 정렬(4번 자리에서 막다른 단어를 먼저 보여주기 위함) */
    _prefer(list, p) {
      if (p !== ROUND_LEN) {
        // 1번은 시작단어 우선, 그 외는 그대로
        if (p === 1) {
          const a = list.filter((w) => this.startSet.has(w));
          const b = list.filter((w) => !this.startSet.has(w));
          return shuffle(a, this.rng).concat(shuffle(b, this.rng));
        }
        return shuffle(list, this.rng);
      }
      const ends = list.filter((w) => this.endSet.has(w));
      const mids = list.filter((w) => !this.endSet.has(w));
      return shuffle(ends, this.rng).concat(shuffle(mids, this.rng));
    }

    /** 아이 차례에 보여줄 안전한 보기 (optionsCount개) */
    _childOptions(round, p, cur) {
      const good = [];
      for (const w of this._unusedAt(p, cur, this.used)) {
        this.used.add(w);
        const ok = this._canFill(round, p + 1, this.endChar[w], this.used);
        this.used.delete(w);
        if (ok) good.push(w);
      }
      return this._prefer(good, p).slice(0, this.optionsCount);
    }

    /** AI가 둘 안전한 단어 한 개 (없으면 null) */
    _aiPick(round, p, cur) {
      const good = [];
      for (const w of this._unusedAt(p, cur, this.used)) {
        this.used.add(w);
        const ok = this._canFill(round, p + 1, this.endChar[w], this.used);
        this.used.delete(w);
        if (ok) good.push(w);
      }
      if (good.length === 0) return null;
      return this._prefer(good, p)[0];
    }

    // --- 상태 / 진행 -----------------------------------------------------

    _resetState() {
      this.used = new Set();
      this.round = 1;
      this.pos = 1;
      this.currentSyllable = null;
      this.history = [];
      this.options = [];
      this.status = 'idle'; // idle | playing | won | lost
      this.lastWord = null;
    }

    _place(word, by) {
      this.used.add(word);
      this.lastWord = word;
      this.currentSyllable = this.endChar[word];
      this.history.push({ round: this.round, pos: this.pos, by, word });
    }

    _advancePos() {
      this.pos += 1;
      if (this.pos > ROUND_LEN) {
        this.round += 1;
        this.pos = 1;
        this.currentSyllable = null; // 새 라운드는 아무 음절로나 시작
      }
    }

    /** AI 차례를 자동으로 처리하고, 아이 차례가 되면 보기를 준비하고 멈춘다. */
    _drive() {
      while (true) {
        if (this.round > TOTAL_ROUNDS) {
          this.status = 'won';
          this.options = [];
          this.currentSyllable = null;
          return;
        }
        const who = ROLES[this.round][this.pos];
        const cur = this.pos === 1 ? null : this.currentSyllable;

        if (who === 'ai') {
          const w = this._aiPick(this.round, this.pos, cur);
          if (w == null) { // 보장상 도달하지 않음(방어)
            this.status = 'lost';
            this.options = [];
            return;
          }
          this._place(w, 'ai');
          this._advancePos();
          continue;
        }

        // 아이 차례
        this.options = this._childOptions(this.round, this.pos, cur);
        this.status = 'playing';
        return;
      }
    }

    // --- 공개 API --------------------------------------------------------

    /** 새 게임 시작. 라운드1은 AI가 1번을 깔고 아이의 2번 보기를 준비한다. */
    start() {
      this._resetState();
      this._drive();
      return this.getState();
    }

    /** 아이가 보기 중 하나(word)를 고른다. */
    answer(word) {
      if (this.status !== 'playing') return this.getState();
      if (!this.options.includes(word)) return this.getState(); // 보기에 없으면 무시
      this._place(word, 'child');
      this._advancePos();
      this._drive();
      return this.getState();
    }

    getState() {
      return {
        status: this.status,
        round: this.round <= TOTAL_ROUNDS ? this.round : TOTAL_ROUNDS,
        position: this.pos,
        totalRounds: TOTAL_ROUNDS,
        roundLength: ROUND_LEN,
        turn: this.status === 'playing' ? 'child' : null,
        currentSyllable: this.currentSyllable, // 아이가 이 음절로 시작하는 단어를 골라야 함(null=아무거나)
        options: this.options.slice(),         // 아이 보기 (전부 정답)
        lastWord: this.lastWord,               // 방금 놓인 단어(AI 또는 아이)
        history: this.history.slice(),         // [{round,pos,by,word}]
        usedCount: this.used.size,
        category: (w) => this.meta[w],
      };
    }
  }

  return KkutuEngine;
});
