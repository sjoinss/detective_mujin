// 퍼즐 패널: 물건 / 사건부 여백(서진우 메모) / 사건부에서 찾아보기.
// 조작 안내 문구는 두지 않는다. 현장의 단서가 방법을 알려 준다.

import { el, button, lines, fill, add } from '../ui/dom.js';
import { PUZZLES, wrongTextOf, checkLabelOf } from '../puzzles/index.js';
import { findPuzzle, findObject, puzzleOpen, solvePuzzle, foundClues } from '../engine/clues.js';
import { caseScreen, caseState, commitCase } from './common.js';
import { notesPanel, clueReference } from './notes.js';

export function puzzleScreen(app) {
  return caseScreen(app, {
    title: '퍼즐',
    render: ({ root, params, data }) => {
      const puzzle = findPuzzle(data, params[0]);
      const kind = PUZZLES[puzzle?.type];
      const st = caseState(app);
      const heading = el('h1', { tabindex: '-1' }, puzzle?.title ?? '닫힌 물건');
      const back = el('a', { href: '#/desk', class: 'btn btn--ghost' }, '현장으로');

      // 이미 풀었거나 아직 손댈 수 없는 퍼즐
      if (!puzzle || !kind || !puzzleOpen(data, st, puzzle.id)) {
        const done = puzzle && st.have.includes(puzzle.id);
        add(root, heading,
          el('div', { class: 'log' }, ...lines(done ? puzzle.solvedText : ['아직 손댈 수 없다.'])),
          el('div', { class: 'actions' }, back));
        return { focus: heading };
      }

      const opener = (data.scenes ?? []).flatMap((s) => s.objects ?? []).find((o) => o.puzzle === puzzle.id);
      // 가진 단서를 알아야 하는 유형(타임라인 재구성)을 위해 함께 넘긴다
      const ctx = { have: new Set(st.have), clues: foundClues(data, st) };
      const view = kind.render(puzzle.config, ctx);
      const feedback = el('div', { class: 'puzzle-feedback', 'aria-live': 'polite' });
      const notes = notesPanel(app, data, puzzle.id);
      const area = el('section', { class: 'puzzle-area', 'aria-labelledby': 'puzzle-title' });
      heading.id = 'puzzle-title';

      function solve() {
        if (!kind.check(puzzle.config, view.value(), ctx)) {
          fill(feedback, el('p', { class: 'puzzle-wrong' }, wrongTextOf(kind, puzzle.config, view.value(), ctx)));
          return;
        }
        const { state, gained } = solvePuzzle(data, caseState(app), puzzle.id);
        commitCase(app, data, state, gained, { speak: false });
        const done = el('div', { class: 'log-entry', tabindex: '-1' },
          ...lines(puzzle.solvedText),
          ...gained.map((id) => el('p', { class: 'log-note' },
            el('span', { class: 'log-note-tag' }, '사건부에 적는다'),
            data.clues.find((c) => c.id === id).name)));
        fill(area, heading, done,
          el('div', { class: 'actions' }, el('a', { href: '#/desk', class: 'btn btn--primary' }, '현장으로')));
        notes.closest('aside').hidden = true;
        done.focus();
      }

      add(area,
        heading,
        el('div', { class: 'log' }, ...lines(findObject(data, opener?.id)?.obj.text)),
        view.node,
        feedback,
        el('div', { class: 'actions' }, button({ label: checkLabelOf(kind, puzzle.config), variant: 'primary', onClick: solve }), back));

      add(root, el('div', { class: 'puzzle' },
        area,
        el('aside', { class: 'puzzle-side sheet', 'aria-labelledby': 'notes-title' }, notes, clueReference(data, st))));
      return { focus: heading };
    },
  });
}
