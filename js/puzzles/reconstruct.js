// 타임라인 재구성(최종장). 시각마다 앞선 사건에서 가져온 조각을 놓는다.
// 가져오지 못한 조각의 칸은 "빈칸"으로 남고, 비워 둔 채로도 넘어갈 수 있다(엔딩이 달라진다).
// 이 유형은 지금 가진 단서(ctx.have)를 알아야 판정할 수 있다.

import { el, nextId } from '../ui/dom.js';

// 칸에 놓을 수 있는가: 그 칸이 받는 조각 가운데 하나라도 가졌다
export function fillable(row, have) {
  return row.accept.some((id) => have.has(id));
}

// value: { rowId: clueId | '' }
export function check(config, value, ctx = { have: new Set() }) {
  return config.rows.every((row) => {
    const placed = value?.[row.id] ?? '';
    return fillable(row, ctx.have) ? row.accept.includes(placed) : placed === '';
  });
}

export function wrongText(config, value, ctx = { have: new Set() }) {
  const miss = config.rows.find((row) => fillable(row, ctx.have) && !row.accept.includes(value?.[row.id] ?? ''));
  return miss ? `${miss.time} 칸의 조각이 앞뒤와 이어지지 않는다.` : '';
}
export const checkLabel = '이 순서로 그 밤을 다시 적는다';

export function render(config, ctx = { have: new Set(), clues: [] }) {
  const value = {};
  const options = (ctx.clues ?? []).filter((c) => config.rows.some((r) => r.accept.includes(c.id)));
  const rows = config.rows.map((row) => {
    const id = nextId('slot');
    const can = fillable(row, ctx.have);
    value[row.id] = '';
    return el('tr', { dataset: { blank: String(!can) } },
      el('th', { scope: 'row' }, row.time),
      el('td', {}, row.event),
      el('td', {}, can
        ? [el('label', { for: id, class: 'visually-hidden' }, `${row.time} 근거`),
          el('select', {
            id,
            class: 'wire-select',
            onchange: (event) => { value[row.id] = event.target.value; },
          },
          el('option', { value: '' }, '—'),
          ...options.map((c) => el('option', { value: c.id }, c.name)))]
        : el('span', { class: 'slot-blank' }, '빈칸. 이 밤을 증명할 조각이 없다.')));
  });
  return {
    node: el('div', { class: 'sort-wrap' },
      el('table', { class: 'sort-table' },
        el('caption', {}, config.caption ?? '06-117 그 밤'),
        el('thead', {}, el('tr', {},
          el('th', { scope: 'col' }, '시각'),
          el('th', { scope: 'col' }, '일'),
          el('th', { scope: 'col' }, '근거'))),
        el('tbody', {}, ...rows))),
    value: () => ({ ...value }),
  };
}
