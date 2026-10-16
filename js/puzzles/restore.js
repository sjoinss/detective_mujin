// 복원. 지워진 연필 자국을 비스듬한 빛으로 비춘다(대비 조절 슬라이더).
// 빛이 맞지 않으면 글자가 군데군데 가려진다. 가려진 정도는 글자 자체로 드러나므로
// 화면을 보지 않아도(스크린리더로도) 같은 정보를 얻는다. 다 읽히면 적힌 값을 옮겨 적는다.

import { el, nextId } from '../ui/dom.js';

const MASK = '░';

// 0~1: 0이면 다 읽히고 1이면 다 가려진다
export function blur(config, angle) {
  const off = Math.abs(angle - config.target);
  if (off <= config.tolerance) return 0;
  return Math.min(1, (off - config.tolerance) / 40);
}

// 글자마다 고정된 순서로 가려진다. 같은 각도면 늘 같은 모양.
export function maskText(text, amount) {
  if (amount <= 0) return text;
  return [...text].map((ch, i) => {
    if (ch === ' ') return ch;
    const rank = ((i * 37 + 11) % 97) / 97;
    return rank < amount ? MASK : ch;
  }).join('');
}

export function check(config, value) {
  return String(value ?? '').replace(/\s+/g, '') === config.answer.replace(/\s+/g, '');
}

export const wrongText = '옮겨 적은 글자가 장부의 자국과 맞지 않는다.';
export const checkLabel = '옮겨 적는다';

export function render(config) {
  const sliderId = nextId('light');
  const inputId = nextId('copy');
  const start = config.target > 50 ? 5 : 95;
  // 줄 자체는 조용히 바뀌고, 다 읽히는 순간에만 한 번 읽어 준다(슬라이더 한 칸마다 읽지 않게)
  const line = el('p', { class: 'restore-line' });
  const live = el('p', { class: 'visually-hidden', 'aria-live': 'polite' });
  let wasClear = false;
  const slider = el('input', {
    id: sliderId,
    class: 'restore-slider',
    type: 'range',
    min: '0',
    max: '100',
    step: '1',
    value: String(start),
  });
  const input = el('input', { id: inputId, class: 'restore-input', type: 'text', autocomplete: 'off', spellcheck: 'false' });

  function draw() {
    const amount = blur(config, Number(slider.value));
    line.textContent = `${config.label}: ${maskText(config.text, amount)}`;
    line.style.setProperty('--restore-clarity', String(1 - amount));
    const clear = amount === 0;
    if (clear && !wasClear) live.textContent = `자국이 다 읽힌다. ${line.textContent}`;
    wasClear = clear;
  }
  slider.addEventListener('input', draw);
  draw();

  return {
    node: el('div', { class: 'restore' },
      el('div', { class: 'restore-page' }, line),
      live,
      el('label', { for: sliderId }, '빛의 각도'),
      slider,
      el('label', { for: inputId }, config.answerLabel),
      input),
    value: () => input.value,
  };
}
