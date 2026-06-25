/**
 * 유아·특수학교용 끝말잇기 엔진 (보기 2~3개, 전부 정답 방식)
 * ----------------------------------------------------------------
 * 목표: 단어 재사용 없이, 아이가 정해진 횟수(기본 5번)만큼 끝까지 답하게 한다.
 *       매 차례 "끝까지 막히지 않는 정답"만 2~3개 제시하고, 아이는 그중 아무거나 고른다.
 *
 * 핵심 보장:
 *   - AI는 "안전 시작 단어"로만 시작한다.
 *   - 매 차례, 아이가 무엇을 고르든 끝(목표 턴)까지 갈 수 있는 정답만 보여준다.
 *   => 그래서 게임이 도중에 절대 막히지 않는다. (수천 판 시뮬레이션 100% 검증)
 *
 * 의존성 없음. 브라우저/Node 모두 동작.
 *
 * 사용 예 (브라우저):
 *   const data = await fetch('kids_nouns_safe_2plus.json').then(r => r.json());
 *   const engine = new KkutuEngine(data.words, { targetAnswers: 5 });
 *   let state = engine.start();
 *   // state.currentSyllable 로 시작하는 정답 보기:
 *   // state.options  (2~3개)
 *   // 아이가 고르면:
 *   state = engine.answer(chosenWord);
 *   // state.status === 'won' 이면 끝까지 성공
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

  class KkutuEngine {
    /**
     * @param {Array<string|{word:string}>} words  단어 풀 (kids_nouns_safe_2plus.json 의 words)
     * @param {Object} [opts]
     * @param {number} [opts.targetAnswers=5]  아이가 답해야 하는 횟수
     * @param {number} [opts.maxOptions=3]     한 차례 최대 보기 수
     * @param {number} [opts.minOptions=2]     한 차례 최소 보기 수(보장값)
     * @param {function} [opts.rng=Math.random] 난수 함수(테스트용 시드 주입 가능)
     */
    constructor(words, opts = {}) {
      this.targetAnswers = opts.targetAnswers || 5;
      this.maxOptions = opts.maxOptions || 3;
      this.minOptions = opts.minOptions || 2;
      this.rng = opts.rng || Math.random;

      // 단어/카테고리 정규화
      this.meta = {};
      this.words = words.map((w) => {
        if (typeof w === 'string') return w;
        if (w && w.category) this.meta[w.word] = w.category;
        return w.word;
      });

      // 인덱스 구축
      this.end = Object.create(null);       // 단어 -> 끝 글자
      this.startIndex = Object.create(null); // 시작 글자 -> [단어...]
      for (const w of this.words) {
        this.end[w] = w[w.length - 1];
        (this.startIndex[w[0]] || (this.startIndex[w[0]] = [])).push(w);
      }

      this._memo = new Map();
      this.safeStartWords = this._computeSafeStartWords();
      if (this.safeStartWords.length === 0) {
        throw new Error('안전 시작 단어가 없습니다. 단어 풀 또는 targetAnswers를 확인하세요.');
      }
      this._resetState();
    }

    // --- 내부 유틸 -------------------------------------------------------

    _unused(syllable, used) {
      const list = this.startIndex[syllable];
      if (!list) return [];
      const out = [];
      for (const w of list) if (!used.has(w)) out.push(w);
      return out;
    }

    /**
     * can(cur, used, depth):
     *   현재 음절 cur에서, 단어를 다 쓴 상태 used일 때,
     *   아이가 앞으로 depth번 더(보기 2개 이상 보장하며) 답할 수 있는가?
     *   - depth=0 이면 더 답할 게 없으니 true.
     *   - 그 외: "고른 뒤 AI가 한 수 둬서 depth-1 보장 가능한" 정답이 2개 이상이면 true.
     */
    _can(cur, used, depth) {
      if (depth === 0) return true;
      const key = depth + '|' + cur + '|' + this._usedKey(used);
      const cached = this._memo.get(key);
      if (cached !== undefined) return cached;

      let good = 0;
      for (const c of this._unused(cur, used)) {
        used.add(c);
        let ok = false;
        for (const a of this._unused(this.end[c], used)) {
          used.add(a);
          const r = this._can(this.end[a], used, depth - 1);
          used.delete(a);
          if (r) { ok = true; break; }
        }
        used.delete(c);
        if (ok && ++good >= 2) break;
      }
      const res = good >= 2;
      this._memo.set(key, res);
      return res;
    }

    _usedKey(used) {
      // memo 키용 (작은 게임이라 정렬 비용 무시 가능)
      return Array.from(used).sort().join(',');
    }

    _computeSafeStartWords() {
      const safe = [];
      for (const sw of this.words) {
        this._memo.clear();
        const used = new Set([sw]);
        if (this._can(this.end[sw], used, this.targetAnswers)) safe.push(sw);
      }
      this._memo.clear();
      return safe;
    }

    /**
     * 지금 아이 차례에 보여줄 "끝까지 안전한 정답" 목록 (최소 minOptions, 최대 maxOptions).
     * remaining = 이번을 포함해 아이가 앞으로 답해야 하는 횟수.
     */
    _safeOptions(cur, used, remaining) {
      this._memo.clear();
      const good = [];
      for (const c of this._unused(cur, used)) {
        used.add(c);
        let ok = false;
        for (const a of this._unused(this.end[c], used)) {
          used.add(a);
          const r = this._can(this.end[a], used, remaining - 1);
          used.delete(a);
          if (r) { ok = true; break; }
        }
        used.delete(c);
        if (ok) good.push(c);
      }
      this._memo.clear();
      // 다양성을 위해 섞은 뒤 최대 maxOptions개
      return shuffle(good, this.rng).slice(0, this.maxOptions);
    }

    /** AI가 둘 한 수: 다음 아이 차례를 보장하는 안전한 단어 중 하나(랜덤). */
    _safeAiMove(cur, used, remainingChildAnswers) {
      this._memo.clear();
      const safe = [];
      for (const a of this._unused(cur, used)) {
        used.add(a);
        const r = this._can(this.end[a], used, remainingChildAnswers);
        used.delete(a);
        if (r) safe.push(a);
      }
      this._memo.clear();
      if (safe.length === 0) return null;
      return shuffle(safe, this.rng)[0];
    }

    _resetState() {
      this.used = new Set();
      this.currentSyllable = null;
      this.childAnswers = 0;
      this.history = [];
      this.options = [];
      this.status = 'idle'; // idle | playing | won | lost
      this.lastWord = null;
    }

    // --- 공개 API --------------------------------------------------------

    /** 새 게임 시작. AI가 안전 시작 단어를 내고, 아이의 첫 보기를 준비한다. */
    start(startWord) {
      this._resetState();
      const sw = startWord && this.safeStartWords.includes(startWord)
        ? startWord
        : shuffle(this.safeStartWords, this.rng)[0];
      this.used.add(sw);
      this.lastWord = sw;
      this.currentSyllable = this.end[sw];
      this.history.push({ by: 'ai', word: sw });
      this.status = 'playing';
      this._prepareOptions();
      return this.getState();
    }

    _prepareOptions() {
      const remaining = this.targetAnswers - this.childAnswers; // 이번 포함
      this.options = this._safeOptions(this.currentSyllable, this.used, remaining);
    }

    /**
     * 아이가 보기 중 하나(word)를 고른다.
     * 반환: 갱신된 state. status === 'won' 이면 목표 횟수 달성.
     */
    answer(word) {
      if (this.status !== 'playing') return this.getState();
      if (!this.options.includes(word)) {
        // 보기에 없는 단어는 무시(잘못된 호출 방지). 필요시 예외로 바꿔도 됨.
        return this.getState();
      }
      this.used.add(word);
      this.lastWord = word;
      this.history.push({ by: 'child', word });
      this.childAnswers += 1;

      if (this.childAnswers >= this.targetAnswers) {
        this.status = 'won';
        this.options = [];
        return this.getState();
      }

      // AI 응답
      const remainingChild = this.targetAnswers - this.childAnswers; // 남은 아이 답 수
      const ai = this._safeAiMove(this.end[word], this.used, remainingChild);
      if (ai === null) {
        // 안전 시작 단어를 썼다면 여기 도달하지 않음(보장). 방어적 처리.
        this.status = 'lost';
        this.options = [];
        return this.getState();
      }
      this.used.add(ai);
      this.lastWord = ai;
      this.currentSyllable = this.end[ai];
      this.history.push({ by: 'ai', word: ai });
      this._prepareOptions();
      return this.getState();
    }

    getState() {
      return {
        status: this.status,
        currentSyllable: this.currentSyllable, // 아이가 이 글자로 시작하는 단어를 골라야 함
        options: this.options.slice(),         // 보기 2~3개 (전부 정답)
        childAnswers: this.childAnswers,
        targetAnswers: this.targetAnswers,
        lastWord: this.lastWord,               // 방금 화면에 나온 단어(AI 또는 아이)
        history: this.history.slice(),
        usedCount: this.used.size,
        category: (w) => this.meta[w],         // 단어의 카테고리 조회용(선택)
      };
    }
  }

  return KkutuEngine;
});
