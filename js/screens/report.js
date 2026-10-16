// 수사 보고서: 범인 / 수법 / 동기, 칸마다 근거 단서 1~2개.
// 어긋나면 어느 칸인지만 알려 준다.

import { el, button, nextId, notice, fill, add } from '../ui/dom.js';
import { foundClues } from '../engine/clues.js';
import { canReport, grade, closeCase, QUESTIONS, MAX_EVIDENCE } from '../engine/accusation.js';
import { linkedLines } from '../engine/board.js';
import { REPORT_NOTES } from '../engine/hints.js';
import { caseScreen, caseState, commitCase } from './common.js';
import { notesPanel, clueReference } from './notes.js';

const LABEL = { culprit: '범인', method: '수법', motive: '동기' };

export function reportScreen(app) {
  return caseScreen(app, {
    title: '수사 보고서',
    render: ({ root, data }) => {
      const heading = el('h1', { tabindex: '-1' }, '수사 보고서');
      const st = caseState(app);

      if (!canReport(data, st)) {
        add(root, heading, el('p', {}, '아직 서류가 덜 모였다.'),
          el('div', { class: 'actions' }, el('a', { href: '#/desk', class: 'btn btn--ghost' }, '현장으로')));
        return { focus: heading };
      }

      const options = {
        culprit: (data.suspects ?? []).map((s) => [s.id, `${s.name}, ${s.role}`]),
        method: (data.accusation?.method ?? []).map((o) => [o.id, o.text]),
        motive: (data.accusation?.motive ?? []).map((o) => [o.id, o.text]),
      };
      const clues = foundClues(data, st);
      const result = el('div', { class: 'report-result', tabindex: '-1' });

      function questionBlock(q) {
        const legendId = nextId('q');
        const evidenceId = nextId('ev');
        const answerRow = el('div', { class: 'options' }, ...options[q].map(([value, text]) =>
          el('label', { class: 'option' }, el('input', { type: 'radio', name: `report-${q}`, value }), text)));
        // 근거 칸 두 개(두 번째는 비워도 된다). 고르면 적어 둔 내용이 아래에 보인다.
        // 단서를 줄줄이 체크하는 목록 대신 칸으로 둬서 보고서가 끝없이 길어지지 않게 한다.
        const slots = Array.from({ length: MAX_EVIDENCE }, (_, i) => {
          const id = nextId('ev-slot');
          const preview = el('p', { class: 'evidence-preview', id: `${id}-text` });
          const select = el('select', {
            id,
            class: 'wire-select evidence-select',
            name: `evidence-${q}`,
            'aria-describedby': `${id}-text`,
            onchange: () => { preview.textContent = clues.find((c) => c.id === select.value)?.text ?? ''; },
          },
          el('option', { value: '' }, '—'),
          ...clues.map((c) => el('option', { value: c.id }, c.name)));
          return el('div', { class: 'evidence-slot' },
            el('label', { for: id }, `근거 ${i + 1}`),
            select,
            preview);
        });
        return el('fieldset', { class: 'report-q', 'aria-labelledby': legendId, dataset: { q } },
          el('h2', { id: legendId }, LABEL[q]),
          answerRow,
          el('div', { class: 'evidence-slots', role: 'group', 'aria-labelledby': evidenceId },
            el('span', { id: evidenceId, class: 'visually-hidden' }, `${LABEL[q]} 근거`),
            ...slots));
      }

      const form = el('form', { class: 'report sheet', 'aria-labelledby': 'report-title' },
        heading,
        ...QUESTIONS.map(questionBlock),
        result,
        el('div', { class: 'actions' },
          button({ label: '추리 제출', variant: 'primary', type: 'submit' }),
          el('a', { href: '#/desk', class: 'btn btn--ghost' }, '현장으로')));
      heading.id = 'report-title';

      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const answers = Object.fromEntries(QUESTIONS.map((q) => [q, {
          answer: form.querySelector(`input[name="report-${q}"]:checked`)?.value,
          // 빈 칸은 빼고, 같은 단서를 두 칸에 골랐으면 하나로 친다
          evidence: [...new Set([...form.querySelectorAll(`select[name="evidence-${q}"]`)].map((s) => s.value).filter(Boolean))],
        }]));
        const missing = QUESTIONS.filter((q) => !answers[q].answer || !answers[q].evidence.length);
        if (missing.length) {
          fill(result, notice({
            kind: 'warn',
            icon: '!',
            body: [`빈칸이 있다: ${missing.map((q) => LABEL[q]).join(', ')}. 칸마다 답 하나와 근거 하나 이상을 적는다.`],
          }));
          result.focus();
          return;
        }
        const { correct, wrong } = grade(data, answers);
        if (!correct) {
          fill(result, notice({
            kind: 'error',
            icon: '✕',
            body: [`어긋난 칸: ${wrong.map((q) => LABEL[q]).join(', ')}. 답이나 근거가 맞지 않는다.`],
          }));
          result.focus();
          return;
        }
        commitCase(app, data, closeCase(caseState(app)));
        app.router.go('result');
      });

      // 옆에 펼쳐 둘 것: 대조표에서 맞물린 줄, 서진우 메모, 사건부
      const pairs = linkedLines(data, st);
      const side = el('aside', { class: 'puzzle-side sheet', 'aria-labelledby': 'report-pairs' },
        el('h2', { id: 'report-pairs' }, '맞물린 줄'),
        pairs.length
          ? el('ul', { class: 'board-pairs', role: 'list' }, ...pairs.map((l) =>
            el('li', {}, el('p', { class: 'board-sentence' }, el('mark', { class: 'marker' }, l.sentence)))))
          : el('p', { class: 'sheet-meta' }, '대조표에서 맞물린 줄이 아직 없다.'),
        data.hints?.[REPORT_NOTES] ? notesPanel(app, data, REPORT_NOTES, { headingId: 'report-notes' }) : null,
        clueReference(data, st));

      add(root, el('div', { class: 'report-layout' }, form, side));
      return { focus: heading };
    },
  });
}
