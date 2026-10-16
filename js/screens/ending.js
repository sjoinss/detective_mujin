// 엔딩. 결과는 수치 없이 글로만 돌려준다.

import { el, lines, add } from '../ui/dom.js';
import { caseScreen } from './common.js';

export function endingScreen(app) {
  return caseScreen(app, {
    title: '그 뒤',
    chrome: 'none',
    caseId: () => 'final',
    render: ({ root, data }) => {
      const { game } = app.store.get();
      const end = data.endings?.[game?.ending];
      const heading = el('h1', { tabindex: '-1' }, end ? end.title : '아직 끝나지 않았다');
      if (!end) {
        add(root, el('article', { class: 'result' }, heading,
          el('div', { class: 'actions' }, el('a', { href: '#/desk', class: 'btn btn--ghost' }, '현장으로'))));
        return { focus: heading };
      }
      add(root, el('article', { class: 'result ending', dataset: { ending: game.ending } },
        el('p', { class: 'ending-mark' }, '06-117'),
        heading,
        el('div', { class: 'log' }, ...lines(end.text)),
        el('div', { class: 'actions' },
          el('a', { href: '#/title', class: 'btn btn--primary' }, '사건부를 덮는다'),
          el('a', { href: '#/cases', class: 'btn btn--ghost' }, '사건부 철'))));
      return { focus: heading };
    },
  });
}
