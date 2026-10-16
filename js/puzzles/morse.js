// 신호 해독. 점멸 기록을 소리·빛 없이 문자 기호(· —)로 보여 주고, 읽은 글자를 적는다.
// 스크린리더에는 기호 대신 "짧/길"로 읽히는 줄을 따로 둔다.

import { el, nextId } from '../ui/dom.js';

const normalize = (s) => String(s ?? '').toUpperCase().replace(/[\s/·.,-]+/g, '');

export function check(config, value) {
  return normalize(value) === normalize(config.answer);
}

export function spoken(signal) {
  return signal.map((g) => (g === '/' ? '쉼' : [...g].map((c) => (c === '·' ? '짧' : '길')).join(' '))).join(', ');
}

export const wrongText = '적은 글자를 기록과 맞춰 본다. 어느 묶음이 어긋난다.';
export const checkLabel = '읽은 대로 적는다';

export function render(config) {
  const inputId = nextId('morse');
  const input = el('input', {
    id: inputId,
    class: 'restore-input',
    type: 'text',
    autocomplete: 'off',
    spellcheck: 'false',
    autocapitalize: 'characters',
  });
  return {
    node: el('div', { class: 'morse' },
      el('div', { class: 'restore-page' },
        el('p', { class: 'morse-signal', 'aria-hidden': 'true' }, config.signal.join('  ')),
        el('p', { class: 'visually-hidden' }, `점멸 기록: ${spoken(config.signal)}`)),
      el('label', { for: inputId }, config.answerLabel),
      input),
    value: () => input.value,
  };
}
