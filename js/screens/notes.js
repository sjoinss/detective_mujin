// 사건부 여백: 서진우 메모를 한 장씩 넘긴다. 퍼즐과 보고서가 함께 쓴다.

import { el, button, memo, fill } from '../ui/dom.js';
import { notePages, turnNote } from '../engine/hints.js';
import { foundClues } from '../engine/clues.js';
import { caseState, commitCase } from './common.js';

export function notesPanel(app, data, key, { headingId = 'notes-title' } = {}) {
  const box = el('div', { class: 'puzzle-notes' });

  function draw(focusLast = false) {
    const { shown, answer, more } = notePages(data, caseState(app), key);
    fill(box,
      el('h2', { id: headingId }, '사건부 여백'),
      shown.length ? shown.map((page) => memo(page)) : el('p', { class: 'sheet-meta' }, '여백에 서진우의 글씨가 비친다.'),
      answer ? memo(answer) : null,
      more ? button({
        label: '여백을 한 장 넘긴다',
        onClick: () => {
          commitCase(app, data, turnNote(data, caseState(app), key));
          draw(true);
        },
      }) : null);
    if (focusLast) {
      const pages = box.querySelectorAll('.memo');
      const last = pages[pages.length - 1];
      last?.setAttribute('tabindex', '-1');
      last?.focus();
    }
  }

  draw();
  return box;
}

// 펼쳐 둔 사건부: 지금까지 적은 단서 전부를 얻은 순서대로. 메모해 두지 않아도 여기서 다시 읽는다.
// 어느 단서가 이 퍼즐에 쓰이는지는 표시하지 않는다(그건 힌트다).
// 넓은 화면에서는 옆에 펼쳐 두고, 좁은 화면에서는 본문 아래 접어 둔다(눌러 펼친다). 내용은 같다.
export function clueReference(data, st) {
  const clues = foundClues(data, st);
  const wide = window.matchMedia('(min-width: 64em)').matches;
  return el('details', { class: 'puzzle-ref', open: wide },
    el('summary', {}, `펼쳐 둔 사건부 (${clues.length}줄)`),
    clues.length
      ? el('ul', { role: 'list' }, ...clues.map((c) => el('li', {}, el('strong', {}, c.name), el('p', {}, c.text))))
      : memo('아직 적을 것이 없다.'));
}
