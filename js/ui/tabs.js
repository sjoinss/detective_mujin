// 탭. 방향키(←→), Home, End로 옮기고 옮기면 바로 열린다.
// tabs: [{ id, label, render: () => Node }]

import { el, nextId, fill, add } from './dom.js';

export function createTabs({ label, tabs, selected = tabs[0]?.id, onSelect }) {
  const base = nextId('tabs');
  const list = el('div', { class: 'tabs-list', role: 'tablist', 'aria-label': label });
  const panel = el('div', { class: 'tab-panel', role: 'tabpanel', tabindex: '0' });
  const buttons = tabs.map((tab) => el('button', {
    type: 'button',
    class: 'tab',
    role: 'tab',
    id: `${base}-${tab.id}`,
    'aria-controls': `${base}-panel`,
    dataset: { tab: tab.id },
  }, tab.label));
  panel.id = `${base}-panel`;
  add(list, ...buttons);

  function select(id, { focus = false } = {}) {
    const index = Math.max(0, tabs.findIndex((t) => t.id === id));
    buttons.forEach((b, i) => {
      const on = i === index;
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
    });
    panel.setAttribute('aria-labelledby', buttons[index].id);
    fill(panel, tabs[index].render());
    if (focus) buttons[index].focus();
    onSelect?.(tabs[index].id);
  }

  list.addEventListener('click', (event) => {
    const b = event.target.closest('[role="tab"]');
    if (b) select(b.dataset.tab);
  });
  list.addEventListener('keydown', (event) => {
    const current = buttons.findIndex((b) => b.getAttribute('aria-selected') === 'true');
    const moves = { ArrowRight: current + 1, ArrowLeft: current - 1, Home: 0, End: buttons.length - 1 };
    if (!(event.key in moves)) return;
    event.preventDefault();
    const next = (moves[event.key] + buttons.length) % buttons.length;
    select(tabs[next].id, { focus: true });
  });

  select(selected);
  return { node: el('div', { class: 'tabs' }, list, panel), select };
}
