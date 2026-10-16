// 결과: 짧은 결말 지문, 사건부에 끼운 메인 스토리 조각, 다음 사건.

import { el, lines, add } from '../ui/dom.js';
import { caseScreen, caseState, chapterLabel } from './common.js';

export function resultScreen(app) {
  return caseScreen(app, {
    title: '종결',
    chrome: 'none',
    render: ({ root, data, story }) => {
      const st = caseState(app);
      const heading = el('h1', { tabindex: '-1' }, chapterLabel(data));
      if (!st?.solved) {
        add(root, heading, el('p', {}, '아직 보고서가 통과하지 않았다.'),
          el('div', { class: 'actions' }, el('a', { href: '#/desk', class: 'btn btn--ghost' }, '현장으로')));
        return { focus: heading };
      }
      const fragIds = new Set((data.clues ?? []).map((c) => c.fragment).filter(Boolean));
      const fragments = (story.fragments ?? []).filter((f) => fragIds.has(f.id) && app.store.get().game.fragments.includes(f.id));

      add(root, el('article', { class: 'result' },
        el('p', { class: 'result-stamp' }, '종결'),
        heading,
        el('div', { class: 'log' }, ...lines(data.result?.text)),
        fragments.length ? el('section', { class: 'result-fragment sheet', 'aria-labelledby': 'fragment-title' },
          el('h2', { id: 'fragment-title' }, '사건부에 끼운 것'),
          el('ul', { role: 'list' }, ...fragments.map((f) => el('li', {}, f.name)))) : null,
        el('div', { class: 'actions' }, el('a', { href: '#/cases', class: 'btn btn--primary' }, '다음 사건'))));
      return { focus: heading };
    },
  });
}
