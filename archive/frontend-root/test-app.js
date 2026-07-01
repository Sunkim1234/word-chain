// toView 순수 함수 단위 테스트 (Node)
const assert = require('assert');
const { toView } = require('./app.js');

// 1) 플레이 중 상태
const playing = toView({
  status: 'playing',
  childAnswers: 1,
  targetAnswers: 5,
  currentSyllable: '소',
  lastWord: '염소',
  options: ['소금', '소나무'],
});
assert.strictEqual(playing.status, 'playing');
assert.strictEqual(playing.progress, '1 / 5');
assert.strictEqual(playing.prompt, "'소'(으)로 시작하는 말은?");
assert.strictEqual(playing.lastWord, '염소');
assert.deepStrictEqual(playing.options, ['소금', '소나무']);

// 2) options 원본을 복사하는지(외부 변형 방지)
const src = ['가지', '가방'];
const v = toView({ status: 'playing', childAnswers: 0, targetAnswers: 5, currentSyllable: '가', lastWord: '바다가', options: src });
v.options.push('침입');
assert.deepStrictEqual(src, ['가지', '가방']);

// 3) 완주(won) 상태
const won = toView({ status: 'won', childAnswers: 5, targetAnswers: 5, currentSyllable: '소', lastWord: '바나나', options: [] });
assert.strictEqual(won.status, 'won');
assert.deepStrictEqual(won.options, []);

// 4) currentSyllable 없을 때 prompt는 빈 문자열
const idle = toView({ status: 'idle', childAnswers: 0, targetAnswers: 5, currentSyllable: null, lastWord: null, options: [] });
assert.strictEqual(idle.prompt, '');
assert.strictEqual(idle.lastWord, null);

console.log('toView: all tests passed');
