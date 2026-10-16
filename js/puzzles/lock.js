// 번호 자물쇠. 숫자를 직접 적는다.

import { el, nextId } from '../ui/dom.js';

export function check(config, value) {
  return String(value ?? '').replace(/\D/g, '') === config.answer;
}

export const wrongText = '다이얼이 헛돈다. 걸리는 데가 없다.';
export const checkLabel = '돌려 본다';

export function render(config) {
  const id = nextId('dial');
  const input = el('input', {
    id,
    class: 'lock-input',
    type: 'text',
    inputmode: 'numeric',
    autocomplete: 'off',
    maxlength: String(config.digits),
    size: String(config.digits),
    pattern: `\\d{${config.digits}}`,
  });
  input.addEventListener('input', () => { input.value = input.value.replace(/\D/g, '').slice(0, config.digits); });
  return {
    node: el('div', { class: 'lock' }, el('label', { for: id }, `번호 ${config.digits}자리`), input),
    value: () => input.value,
  };
}
