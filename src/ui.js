// src/ui.js
const $ = id => document.getElementById(id);

export function makeUI({ imgSrc, attachOption }) {
  // 그림 폴백: 매핑 있으면 <img>, 없으면 텍스트만
  const pic = (word, cls) => {
    const src = imgSrc(word);
    return src ? '<img class="' + cls + '" draggable="false" src="' + src + '" alt="' + word + '">' : '';
  };

  // 진행: 전체 8칸(2라운드×4) 중 history.length 만큼 done
  function renderProgress(state) {
    const total = state.totalRounds * state.roundLength;   // 8
    const done = state.history.length;
    const p = $('progress'); p.innerHTML = '';
    for (let k = 0; k < total; k++) {
      const s = document.createElement('span');
      s.className = 'step ' + (k < done ? 'done' : (k === done ? 'cur' : 'todo'));
      p.appendChild(s);
    }
    p.setAttribute('aria-label', '진행 ' + done + ' / ' + total);
  }

  function renderRound(state, onSpeakRound) {
    const now = state.lastWord;
    const syl = state.currentSyllable;
    $('nowPic').src = imgSrc(now) || ''; $('nowPic').alt = now || '';
    $('nowPic').style.display = imgSrc(now) ? '' : 'none';
    $('nowWord').innerHTML = now ? now.slice(0, -1) + '<span class="syl">' + now.slice(-1) + '</span>' : '';
    $('linkTok').textContent = syl || '';
    $('promptText').innerHTML = "'<span class=\"syl\">" + (syl || '') + "</span>' 로 시작하는 말은?";

    const drop = $('drop');
    drop.className = 'drop'; drop.innerHTML = '<span class="drop__q">?</span>';

    const opts = $('options'); opts.innerHTML = '';
    state.options.forEach(w => {
      const b = document.createElement('button');
      b.className = 'opt'; b.type = 'button';
      b.innerHTML = pic(w, 'opt__pic') + '<span class="opt__word">' + w + '</span>';
      attachOption(b, w);          // game이 주입한 drag 부착기
      opts.appendChild(b);
    });
    const v = document.createElement('button');
    v.className = 'opt opt--voice'; v.type = 'button';
    v.setAttribute('aria-label', '말하기 (준비 중)');
    v.innerHTML = '<span class="opt__mic" aria-hidden="true">🎤</span><span class="opt__word">말하기</span>';
    opts.appendChild(v);

    renderProgress(state);
    const nowCard = document.querySelector('.now__card');
    nowCard.classList.remove('intro'); void nowCard.offsetWidth; nowCard.classList.add('intro');
    onSpeakRound(now, $('promptText').textContent);
  }

  function fillDrop(word) {
    const drop = $('drop');
    drop.className = 'drop drop--filled';
    drop.innerHTML = pic(word, 'opt__pic') + '<span class="opt__word">' + word + '</span>';
  }

  function showFinish(onRestart) {
    const wrap = document.querySelector('.wrap');
    if (wrap.querySelector('.finish')) return;
    const o = document.createElement('div');
    o.className = 'finish';
    o.innerHTML =
      '<h2 class="finish__title">다 이었어요!</h2>' +
      '<button class="finish__btn" type="button" aria-label="다음">' +
      '<svg class="finish__check" viewBox="0 0 32 32" aria-hidden="true">' +
      '<path d="M6 16.5L13 23.5L26 8.5" fill="none" stroke="#fff" stroke-width="5.2" stroke-linecap="round" stroke-linejoin="round"/>' +
      '</svg></button>';
    wrap.appendChild(o);
    o.querySelector('.finish__btn').addEventListener('click', onRestart);
  }
  function clearFinish() { document.querySelectorAll('.finish').forEach(n => n.remove()); }

  return { renderRound, renderProgress, fillDrop, showFinish, clearFinish };
}
