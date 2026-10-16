// 라디오 묶음. 고르면 바로 onChange.

import { el, nextId } from './dom.js';

export function radioGroup({ name, legend, help, options, value, onChange }) {
  const helpId = help ? nextId('help') : null;
  return el('fieldset', { class: 'field', 'aria-describedby': helpId },
    el('legend', {}, legend),
    help ? el('p', { class: 'field-help', id: helpId }, help) : null,
    el('div', { class: 'options' },
      ...options.map(([v, label]) => el('label', { class: 'option' },
        el('input', {
          type: 'radio',
          name,
          value: v,
          checked: v === value,
          onchange: (event) => { if (event.target.checked) onChange(v); },
        }),
        label))));
}
