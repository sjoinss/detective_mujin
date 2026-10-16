// 분류·대조. 항목마다 갈래를 고른다. 표로 보여 주어 줄을 따라 읽을 수 있다.

import { el, nextId } from '../ui/dom.js';

// value: { itemId: categoryId }
export function check(config, value) {
  return Object.entries(config.answer).every(([item, cat]) => value?.[item] === cat);
}

export function wrongText(config) {
  return config.wrongText ?? '줄을 다시 맞춰 본다. 어디선가 어긋난다.';
}
export function checkLabel(config) {
  return config.checkLabel ?? '대조한다';
}

export function render(config) {
  const value = {};
  const captionId = nextId('sort');
  const rows = config.items.map((item) => {
    const selectId = nextId('sort-item');
    return el('tr', {},
      el('th', { scope: 'row' }, el('label', { for: selectId }, item.label)),
      el('td', {}, item.detail),
      el('td', {}, el('select', {
        id: selectId,
        class: 'wire-select',
        onchange: (event) => { value[item.id] = event.target.value; },
      },
      el('option', { value: '' }, '—'),
      ...config.categories.map((c) => el('option', { value: c.id }, c.label)))));
  });
  return {
    node: el('div', { class: 'sort-wrap' },
      el('table', { class: 'sort-table', 'aria-describedby': captionId },
        el('caption', { id: captionId }, config.caption ?? ''),
        el('thead', {}, el('tr', {},
          el('th', { scope: 'col' }, config.itemHeader ?? '항목'),
          el('th', { scope: 'col' }, config.detailHeader ?? '적힌 것'),
          el('th', { scope: 'col' }, config.categoryHeader ?? '갈래'))),
        el('tbody', {}, ...rows))),
    value: () => ({ ...value }),
  };
}
