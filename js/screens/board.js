// 대조표: 서류 두 장을 나란히 놓고 한 줄씩 짚은 뒤 "연결하기".
// 맞으면 두 줄의 관계 문장이 완성되어 아래에 남는다. 틀려도 잃는 것은 없다.
// 드래그 없이 줄 선택만으로 동작한다.

import { el, button, memo, fill, add } from '../ui/dom.js';
import { boardSheets, connect, linkedLines, statementById } from '../engine/board.js';
import { findClue } from '../engine/clues.js';
import { caseScreen, caseState, commitCase } from './common.js';

export function boardScreen(app) {
  return caseScreen(app, {
    title: '대조표',
    render: ({ root, data }) => {
      const heading = el('h1', { tabindex: '-1' }, '대조표');
      const left = el('section', { class: 'sheet board-sheet', 'aria-labelledby': 'board-left' });
      const right = el('section', { class: 'sheet board-sheet', 'aria-labelledby': 'board-right' });
      const result = el('div', { class: 'board-result', tabindex: '-1', 'aria-live': 'polite' });
      const linked = el('section', { class: 'board-linked', 'aria-labelledby': 'board-linked-title' });
      const actions = el('div', { class: 'board-tray', role: 'group', 'aria-label': '짚은 두 줄' });
      let pick = { left: null, right: null };

      const label = (id) => findClue(data, id)?.name ?? (() => {
        const hit = statementById(data, id);
        return hit ? `${hit.suspect.name}: “${hit.statement.text}”` : id;
      })();

      // 한 줄. 고른 줄은 형광펜, 이미 짚은 관계에 쓰인 줄은 표시를 단다.
      function line(side, id, text, used) {
        return el('li', {}, el('button', {
          type: 'button',
          class: 'board-line',
          'aria-pressed': String(pick[side] === id),
          dataset: { used: String(used) },
          onclick: () => {
            pick = { ...pick, [side]: pick[side] === id ? null : id };
            draw();
            (side === 'left' ? left : right).querySelector(`[data-line="${CSS.escape(id)}"]`)?.focus();
          },
          'data-line': id,
        }, el('span', {}, text), used ? el('span', { class: 'board-used' }, '✓ 짚음') : null));
      }

      function draw() {
        const st = caseState(app);
        const { clues, statements } = boardSheets(data, st);
        const usedIds = new Set(linkedLines(data, st).flatMap((l) => [l.left, l.right]));

        fill(left,
          el('h2', { id: 'board-left' }, '단서'),
          clues.length
            ? el('ol', { class: 'board-lines', role: 'list' }, ...clues.map((c) => line('left', c.id, c.name, usedIds.has(c.id))))
            : memo('대조할 서류가 아직 없다.'));

        fill(right,
          el('h2', { id: 'board-right' }, '진술과 기록'),
          statements.length ? [
            el('h3', { class: 'board-sub', id: 'board-statements' }, '들은 말'),
            el('ol', { class: 'board-lines', role: 'list', 'aria-labelledby': 'board-statements' },
              ...statements.map(({ suspect, statement }) => line('right', statement.id,
                `${suspect.name}: “${statement.text}”`, usedIds.has(statement.id)))),
          ] : memo('들은 말이 아직 없다. 없다.'),
          clues.length ? [
            el('h3', { class: 'board-sub', id: 'board-records' }, '다른 기록'),
            el('ol', { class: 'board-lines', role: 'list', 'aria-labelledby': 'board-records' },
              ...clues.map((c) => line('right', c.id, c.name, usedIds.has(c.id)))),
          ] : null);

        // 아래 받침: 짚은 두 줄과 연결하기. 긴 서류를 오르내리지 않게 화면 아래에 붙어 있다.
        const ready = pick.left && pick.right;
        fill(actions,
          el('p', { class: 'board-picks' },
            el('span', {}, pick.left ? label(pick.left) : '단서 —'),
            el('span', { 'aria-hidden': 'true' }, ' ↔ '),
            el('span', {}, pick.right ? label(pick.right) : '진술·기록 —')),
          button({
            label: '연결하기',
            variant: 'primary',
            disabledReason: ready ? '' : '아직 두 줄을 짚지 않았다.',
            onClick: link,
          }),
          result);

        const done = linkedLines(data, st);
        fill(linked,
          el('h2', { id: 'board-linked-title' }, '맞물린 줄'),
          done.length
            ? el('ol', { class: 'board-pairs', role: 'list' }, ...done.map((l) => el('li', {},
              el('p', { class: 'board-sentence' }, el('mark', { class: 'marker' }, l.sentence)),
              el('p', { class: 'sheet-meta' }, `${label(l.left)} ↔ ${label(l.right)}`))))
            : memo('맞물린 줄이 아직 없다.'));
      }

      function link() {
        const before = caseState(app);
        const outcome = connect(data, before, pick.left, pick.right);
        if (outcome.result === 'linked') {
          commitCase(app, data, outcome.state, outcome.gained);
          fill(result, el('p', { class: 'board-sentence' }, el('mark', { class: 'marker' }, outcome.link.sentence)));
        } else if (outcome.result === 'already') {
          fill(result, el('p', {}, '이미 맞물린 두 줄이다.'));
        } else {
          fill(result, el('p', {}, '두 줄은 서로 걸리는 데가 없다.'));
        }
        pick = { left: null, right: null };
        draw();
        result.focus();
      }

      draw();
      add(root, el('div', { class: 'board' },
        el('div', { class: 'board-head' }, heading),
        left,
        right,
        actions,
        linked));
      return { focus: heading };
    },
  });
}
