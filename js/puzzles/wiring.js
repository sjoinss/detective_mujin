// 연결·회로 퍼즐. 드래그 대신 플러그마다 단자를 고른다(선택-선택).

import { el, nextId } from '../ui/dom.js';

// value: { plugId: jackId }
export function check(config, value) {
  return Object.entries(config.answer).every(([plug, jack]) => value?.[plug] === jack);
}

export const wrongText = '스위치를 올린다. 스피커에서 잡음만 끓는다.';
export const checkLabel = '전원을 올린다';

export function render(config) {
  const value = {};
  const rows = config.plugs.map((plug) => {
    const id = nextId('plug');
    const select = el('select', {
      id,
      class: 'wire-select',
      onchange: (event) => { value[plug.id] = event.target.value; },
    },
    el('option', { value: '' }, '빼 둔다'),
    ...config.jacks.map((jack) => el('option', { value: jack.id }, jack.label)));
    return el('div', { class: 'wire-row' },
      el('label', { for: id, class: 'wire-plug' }, plug.label),
      el('span', { class: 'wire-arrow', 'aria-hidden': 'true' }, '→'),
      select);
  });
  return {
    node: el('fieldset', { class: 'wire' }, el('legend', { class: 'visually-hidden' }, '케이블 연결'), ...rows),
    value: () => ({ ...value }),
  };
}
