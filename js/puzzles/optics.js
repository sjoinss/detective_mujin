// 광학. 거울마다 각도를 숫자로 적는다. 틀리면 빛이 어느 거울에서 새는지 글로 알려 준다.

import { el, nextId } from '../ui/dom.js';

// value: { mirrorId: number }
export function check(config, value) {
  return config.mirrors.every((m) => Number(value?.[m.id]) === config.answer[m.id]);
}

// 빛은 차례로 거울을 지난다. 처음 어긋난 거울에서 멈춘다.
export function wrongText(config, value) {
  const miss = config.mirrors.find((m) => Number(value?.[m.id]) !== config.answer[m.id]);
  return miss ? `빛이 ${miss.label}에서 엉뚱한 쪽으로 꺾여 벽에 번진다.` : '';
}
export const checkLabel = '램프를 켠다';

export function render(config) {
  const inputs = config.mirrors.map((m) => {
    const id = nextId('mirror');
    const input = el('input', {
      id,
      class: 'restore-input optics-input',
      type: 'number',
      inputmode: 'numeric',
      min: String(config.min),
      max: String(config.max),
      step: String(config.step),
      value: '0',
    });
    return { m, id, input };
  });
  return {
    node: el('fieldset', { class: 'wire' },
      el('legend', { class: 'visually-hidden' }, '거울 각도'),
      ...inputs.map(({ m, id, input }) => el('div', { class: 'wire-row' },
        el('label', { for: id, class: 'wire-plug' }, m.label),
        el('span', { class: 'wire-arrow', 'aria-hidden': 'true' }, '∠'),
        el('span', { class: 'optics-field' }, input, el('span', { 'aria-hidden': 'true' }, '도'))))),
    value: () => Object.fromEntries(inputs.map(({ m, input }) => [m.id, Number(input.value)])),
  };
}
