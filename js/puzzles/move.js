// 구조 발견. 무엇을 옮길지 고른 뒤 민다. 엉뚱한 것을 밀면 그 뒤에 있던 것이 글로 나온다.

import { el, fill } from '../ui/dom.js';

export function check(config, value) {
  return value === config.answer;
}

export function wrongText(config, value) {
  return config.items.find((i) => i.id === value)?.text ?? '무엇을 옮길지 먼저 정한다.';
}
export const checkLabel = '힘껏 민다';

export function render(config) {
  let picked = null;
  const list = el('ul', { class: 'pieces', role: 'list' });

  function draw(focusId) {
    fill(list, ...config.items.map((item) => el('li', {}, el('button', {
      type: 'button',
      class: 'piece',
      'aria-pressed': String(picked === item.id),
      'data-item': item.id,
      onclick: () => { picked = picked === item.id ? null : item.id; draw(item.id); },
    }, item.label))));
    if (focusId) list.querySelector(`[data-item="${focusId}"]`)?.focus();
  }

  draw();
  return {
    node: el('div', { role: 'group', 'aria-label': '옮길 것' }, list),
    value: () => picked,
  };
}
