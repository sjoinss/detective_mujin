// 사건 선택: 책상 위 파일철. 장마다 표지 한 장.

import { el, linkButton, fill, add } from '../ui/dom.js';
import { chapterStatus } from '../engine/game.js';
import { loadError } from './common.js';

const STATE_TEXT = {
  missing: '아직 도착하지 않은 사건부',
  locked: '앞 사건부가 아직 덮이지 않았다.',
  open: '',
  active: '펼쳐 둔 사건부',
  solved: '종결',
};

export function casesScreen(app) {
  return ({ root }) => {
    const heading = el('h1', { tabindex: '-1' }, '사건부 철');
    add(root, heading, el('p', { class: 'loading' }, '철을 넘기는 중'));

    app.loadStory().then((story) => {
      const status = chapterStatus(story, app.store.get().game);
      // 주 CTA: 진행 중인 장, 없으면 처음 열린 장
      const primary = story.chapters.find((c) => status[c.id] === 'active')
        ?? story.chapters.find((c) => status[c.id] === 'open');

      const items = story.chapters.map((ch, i) => {
        const s = status[ch.id];
        const number = ch.id === 'prologue' ? '프롤로그' : ch.id === 'final' ? '최종장' : `사건 ${i}`;
        const href = s === 'active' ? '#/desk' : `#/briefing/${ch.id}`;
        const reasonId = `folder-${ch.id}-state`;
        return el('li', { class: 'folder', dataset: { state: s } },
          el('div', { class: 'folder-tab' }, number),
          el('div', { class: 'folder-body' },
            el('h2', { class: 'folder-title' }, ch.title),
            // 종결은 도장이 보여 주므로 글은 스크린리더에만
            STATE_TEXT[s] ? el('p', { class: s === 'solved' ? 'visually-hidden' : 'folder-state', id: reasonId }, STATE_TEXT[s]) : null,
            ['open', 'active', 'solved'].includes(s)
              ? linkButton({
                label: s === 'active' ? '이어서 펼치기' : s === 'solved' ? '다시 읽기' : '펼치기',
                href,
                variant: ch === primary ? 'primary' : '',
              })
              : null),
          s === 'solved' ? el('p', { class: 'folder-stamp', 'aria-hidden': 'true' }, '종결') : null);
      });

      fill(root, heading, el('ol', { class: 'folders', role: 'list' }, ...items),
        el('p', {}, linkButton({ label: '타이틀로', href: '#/title', variant: 'ghost' })));
    }).catch((error) => fill(root, heading, loadError(app, error)));

    return { focus: heading, title: '사건부 철', chrome: 'none' };
  };
}
