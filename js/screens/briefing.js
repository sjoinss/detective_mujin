// 브리핑: 사건 개요, 괴담 소문, 피해자, 용의자. 다 읽고 "현장으로".

import { el, button, lines, add } from '../ui/dom.js';
import { newGame, openCase } from '../engine/game.js';
import { caseScreen, chapterLabel } from './common.js';

export function briefingScreen(app) {
  return caseScreen(app, {
    title: '브리핑',
    chrome: 'none',
    caseId: (params) => params[0],
    render: ({ root, data }) => {
      const b = data.briefing ?? {};
      const heading = el('h1', { id: 'brief-title', tabindex: '-1' }, chapterLabel(data));

      // 이미 진행 중인 사건이면 openCase가 있던 상태를 그대로 둔다
      function go() {
        const game = openCase(app.store.get().game ?? newGame(data.id), data);
        app.store.set({ game, hasSave: true, saveStatus: 'ok' });
        app.router.go('desk');
      }

      const started = !!app.store.get().game?.cases?.[data.id];
      add(root, el('article', { class: 'briefing sheet', 'aria-labelledby': 'brief-title' },
        heading,
        el('section', { 'aria-labelledby': 'brief-summary' },
          el('h2', { id: 'brief-summary' }, '개요'), ...lines(b.summary, 'brief-line')),
        b.rumor?.length ? el('section', { class: 'brief-rumor', 'aria-labelledby': 'brief-rumor' },
          el('h2', { id: 'brief-rumor' }, '도는 소문'), ...lines(b.rumor, 'brief-line')) : null,
        b.victim ? el('section', { 'aria-labelledby': 'brief-victim' },
          el('h2', { id: 'brief-victim' }, '피해자'),
          el('p', {}, `${b.victim.name} (${b.victim.age}) ${b.victim.role}`)) : null,
        data.suspects?.length && (data.kind ?? 'case') === 'case' ? el('section', { 'aria-labelledby': 'brief-suspects' },
          el('h2', { id: 'brief-suspects' }, '그 밤 근처에 있던 사람'),
          el('ul', { class: 'brief-people', role: 'list' }, ...data.suspects.map((s) =>
            el('li', {}, el('strong', {}, s.name), ` (${s.age}) ${s.role}`)))) : null),
      el('div', { class: 'actions brief-actions' },
        button({ label: started ? '현장으로 돌아가기' : '현장으로', variant: 'primary', onClick: go }),
        el('a', { href: '#/cases', class: 'btn btn--ghost' }, '사건부 철')));

      return { focus: heading };
    },
  });
}
