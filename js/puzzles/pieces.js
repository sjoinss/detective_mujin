// 조각 맞추기. 조각 하나를 고르고 다른 조각을 고르면 자리를 바꾼다. 드래그는 쓰지 않는다.

import { el, fill } from '../ui/dom.js';
import { announce } from '../ui/toast.js';

export function check(config, value) {
  return Array.isArray(value) && value.join() === config.answer.join();
}

// 처음 놓인 순서: 정답을 뒤집는다. 조각이 둘 이상이면 정답과 같을 수 없다.
export function initialOrder(config) {
  return [...config.answer].reverse();
}

export const wrongText = '말이 엉킨다. 이어지지 않는다.';
export const checkLabel = '이어서 튼다';

export function render(config) {
  const labels = new Map(config.pieces.map((p) => [p.id, p.label]));
  let order = initialOrder(config);
  let picked = null;
  const list = el('ol', { class: 'pieces', role: 'list' });

  function draw(focusIndex = null) {
    fill(list, ...order.map((id, i) => el('li', {},
      el('button', {
        type: 'button',
        class: 'piece',
        'aria-pressed': String(picked === i),
        onclick: () => pick(i),
      },
      el('span', { class: 'piece-pos' }, `${i + 1}째`),
      el('span', {}, labels.get(id))))));
    if (focusIndex !== null) list.querySelectorAll('button')[focusIndex]?.focus();
  }

  function pick(i) {
    if (picked === null) {
      picked = i;
      draw(i);
      return;
    }
    if (picked !== i) {
      [order[picked], order[i]] = [order[i], order[picked]];
      announce(`${picked + 1}째와 ${i + 1}째 토막을 바꿨다.`, { visible: false });
    }
    picked = null;
    draw(i);
  }

  draw();
  return {
    node: el('div', { class: 'pieces-wrap', role: 'group', 'aria-label': '테이프 토막. 하나를 고르고 바꿀 자리를 고른다.' }, list),
    value: () => [...order],
  };
}
