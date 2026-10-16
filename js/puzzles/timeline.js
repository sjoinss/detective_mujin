// 시간표 복원. 목록에서 줄마다 "위로/아래로"를 눌러 순서를 잡는다. 드래그는 쓰지 않는다.

import { el, fill } from '../ui/dom.js';
import { announce } from '../ui/toast.js';

export function check(config, value) {
  return Array.isArray(value) && value.join() === config.answer.join();
}

export function initialOrder(config) {
  return [...config.answer].reverse();
}

export function wrongText(config) {
  return config.wrongText ?? '순서를 따라 읽어 본다. 어딘가 앞뒤가 맞지 않는다.';
}
export function checkLabel(config) {
  return config.checkLabel ?? '이 순서로 맞춰 본다';
}

export function render(config) {
  const labels = new Map(config.items.map((i) => [i.id, i.label]));
  const order = initialOrder(config);
  const list = el('ol', { class: 'timeline', role: 'list' });

  function shift(index, by, focusSide) {
    const to = index + by;
    if (to < 0 || to >= order.length) return;
    [order[index], order[to]] = [order[to], order[index]];
    announce(`${labels.get(order[to])}, ${to + 1}째로.`, { visible: false });
    draw(to, focusSide);
  }

  function draw(focusIndex = null, focusSide = 'up') {
    fill(list, ...order.map((id, i) => el('li', { class: 'timeline-row' },
      el('span', { class: 'piece-pos' }, `${i + 1}째`),
      el('span', { class: 'timeline-label' }, labels.get(id)),
      el('span', { class: 'timeline-moves' },
        el('button', {
          type: 'button',
          class: 'btn timeline-btn',
          'data-move': `up-${i}`,
          'aria-label': `${labels.get(id)} 위로`,
          disabled: i === 0,
          onclick: () => shift(i, -1, 'up'),
        }, '↑'),
        el('button', {
          type: 'button',
          class: 'btn timeline-btn',
          'data-move': `down-${i}`,
          'aria-label': `${labels.get(id)} 아래로`,
          disabled: i === order.length - 1,
          onclick: () => shift(i, 1, 'down'),
        }, '↓')))));
    if (focusIndex !== null) {
      // 끝에 닿아 그 버튼이 꺼졌으면 반대쪽 버튼으로
      const target = list.querySelector(`[data-move="${focusSide}-${focusIndex}"]:not(:disabled)`)
        ?? list.querySelector(`[data-move="${focusSide === 'up' ? 'down' : 'up'}-${focusIndex}"]`);
      target?.focus();
    }
  }

  draw();
  return {
    node: el('div', { role: 'group', 'aria-label': config.groupLabel ?? '순서' }, list),
    value: () => [...order],
  };
}
