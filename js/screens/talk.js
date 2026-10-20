// 심문(조서). 진술을 고르고, 사건부(파일철)에서 증거를 꺼내 내민다.
// 틀리면 말투가 굳고 라운드가 닫혀 처음부터 다시 듣는다. 수치는 어디에도 없다.

import { el, button, lines, fill, add } from '../ui/dom.js';
import { play } from '../sound.js';
import { foundClues, findClue } from '../engine/clues.js';
import { findSuspect, suspectOpen, currentRound, lastRound, hear, present, skipRound } from '../engine/interrogation.js';
import { josa } from '../ui/text.js';
import { caseScreen, caseState, commitCase } from './common.js';

export function talkScreen(app) {
  return caseScreen(app, {
    title: '조서',
    render: ({ root, params, data }) => {
      const suspect = findSuspect(data, params[0]);
      const label = data.kind === 'final' ? '대면' : '조서';
      const heading = el('h1', { tabindex: '-1' }, suspect ? `${label} · ${suspect.name}` : label);
      const back = el('a', { href: '#/desk', class: 'btn btn--ghost' }, '현장으로');

      if (!suspect || !suspectOpen(caseState(app), suspect)) {
        add(root, heading, el('p', {}, '아직 마주 앉을 수 없다.'), el('div', { class: 'actions' }, back));
        return { focus: heading };
      }

      const body = el('div', { class: 'talk-body' });
      const response = el('div', { class: 'talk-response', 'aria-live': 'polite' });
      let selected = null;
      let round = null;
      // 고른 단서는 진술을 다시 고르며 목록을 새로 그려도 남는다
      let chosenClue = '';

      // 라운드에 들어간다: 증언을 적고 진술 목록을 그린다.
      // 들을 라운드가 없으면 마지막 라운드를 다시 읽을 수 있게만 둔다.
      function enterRound() {
        const current = currentRound(caseState(app), suspect);
        round = current ?? lastRound(caseState(app), suspect);
        selected = null;
        if (current) {
          const before = caseState(app);
          const { state, gained } = hear(data, before, current);
          if (state !== before) commitCase(app, data, state, gained);
        }
        draw();
      }

      function draw() {
        const st = caseState(app);
        if (!round) {
          fill(body, response, el('p', { class: 'talk-end' }, `${suspect.name}에게서 더 들을 말이 없다.`));
          return;
        }
        if (st.have.includes(round.id)) {
          fill(body,
            response,
            el('p', { class: 'talk-end' }, `${suspect.name}에게서 더 들을 말이 없다.`),
            el('h2', { id: 'statements-title', class: 'section-title' }, '적어 둔 진술'),
            el('ul', { class: 'statements', role: 'list', 'aria-labelledby': 'statements-title' },
              ...round.statements.map((s) => el('li', { class: 'statement', dataset: { proven: String(st.have.includes(s.id)) } },
                el('span', { class: 'statement-text' }, `“${s.text}”`),
                st.have.includes(s.id) ? el('span', { class: 'statement-mark' }, '✓ 모순 확인') : null))));
          return;
        }
        const statements = el('ul', { class: 'statements', role: 'list', 'aria-labelledby': 'statements-title' },
          ...round.statements.map((s) => {
            const proven = st.have.includes(s.id);
            return el('li', {},
              el('button', {
                type: 'button',
                class: 'statement',
                'aria-pressed': String(selected === s.id),
                dataset: { proven: String(proven) },
                onclick: () => { selected = s.id; draw(); body.querySelector(`[data-sid="${s.id}"]`)?.focus(); },
                'data-sid': s.id,
              },
              el('span', { class: 'statement-text' }, `“${s.text}”`),
              proven ? el('span', { class: 'statement-mark' }, '✓ 모순 확인') : null),
              proven && s.reply ? el('p', { class: 'statement-reply' }, `“${s.reply}”`) : null);
          }));

        // 사건부에서 꺼낸다: 단서 전부를 얻은 순서대로 한 칸에. 고르면 적어 둔 내용이 바로 아래에 보인다.
        // (어느 단서가 이 사람과 관련 있는지는 나누지 않는다. 그건 힌트다.)
        const clues = foundClues(data, st);
        const preview = el('p', { class: 'evidence-preview', id: 'evidence-preview' });
        const pick = el('select', {
          id: 'evidence-pick',
          class: 'wire-select evidence-select',
          'aria-describedby': 'evidence-preview',
          onchange: () => { chosenClue = pick.value; preview.textContent = findClue(data, pick.value)?.text ?? ''; },
        },
        el('option', { value: '' }, '—'),
        ...clues.map((c) => el('option', { value: c.id, selected: c.id === chosenClue }, c.name)));
        preview.textContent = findClue(data, chosenClue)?.text ?? '';
        const file = el('div', { class: 'evidence sheet', role: 'group', 'aria-labelledby': 'evidence-title' },
          el('h2', { id: 'evidence-title' }, '사건부에서 꺼낸다'),
          // 어느 말에 내미는지 버튼 옆에서 바로 보이게
          el('p', { class: 'sheet-meta' }, selected
            ? `짚은 말: “${round.statements.find((s) => s.id === selected)?.text ?? ''}”`
            : '아직 짚은 말이 없다. 위에서 하나 누른다.'),
          clues.length
            ? [
              el('label', { for: 'evidence-pick', class: 'visually-hidden' }, '내밀 단서'),
              el('div', { class: 'evidence-row' },
                pick,
                button({
                  label: '내민다',
                  variant: 'primary',
                  onClick: () => {
                    if (!pick.value) {
                      fill(response, el('p', {}, '무엇을 내밀지 먼저 고른다.'));
                      response.setAttribute('tabindex', '-1');
                      response.focus();
                      return;
                    }
                    show(pick.value);
                  },
                })),
              preview,
            ]
            : el('p', {}, '사건부가 비어 있다.'));

        // 최종장 대면: 내밀 증거가 없으면 넘어갈 수 있다. 증명은 남지 않는다.
        const skip = round.skippable ? el('div', { class: 'actions' }, button({
          label: '내밀 증거가 없다. 넘어간다',
          onClick: () => {
            commitCase(app, data, skipRound(caseState(app), round));
            fill(response,
              el('p', {}, `${josa(suspect.name, '이', '가')} 잔을 든다. 말이 다음으로 넘어간다.`));
            enterRound();
            if (!currentRound(caseState(app), suspect) && data.kind === 'final') {
              add(response, el('p', {}, el('a', { href: '#/desk' }, '책상으로 돌아가 그의 제안을 듣는다')));
            }
            response.setAttribute('tabindex', '-1');
            response.focus();
          },
        })) : null;

        // 대답은 진술 바로 아래, 증거를 꺼내는 칸 위에 뜬다(내민 자리에서 바로 읽히게)
        fill(body,
          round.intro ? el('p', {}, round.intro) : null,
          el('h2', { id: 'statements-title', class: 'section-title' }, '진술'),
          el('p', { class: 'talk-help' }, '걸리는 말을 하나 누르고, 아래 사건부에서 그 말과 어긋나는 단서를 골라 내민다. 틀리면 처음부터 다시 듣는다.'),
          statements,
          response,
          file,
          skip);
      }

      function show(clueId) {
        if (!selected) {
          fill(response, el('p', {}, '어느 말에 내밀지 먼저 정한다.'));
          response.setAttribute('tabindex', '-1');
          response.focus();
          return;
        }
        const st = caseState(app);
        const statement = round.statements.find((s) => s.id === selected);
        const outcome = present(data, st, round, selected, clueId);
        commitCase(app, data, outcome.state, outcome.gained);

        if (outcome.result === 'already') {
          fill(response, el('p', {}, '이미 짚은 말이다.'));
        } else if (outcome.result === 'wrong') {
          play('wrong');
          // 말투가 굳고 라운드가 닫힌다
          fill(response,
            el('p', { class: 'talk-wrong' }, '이 증거는 이 진술과 모순되지 않습니다.'),
            ...lines(suspect.onWrong?.length ? suspect.onWrong : [`${suspect.name}의 대답이 짧아진다. 말이 처음으로 돌아간다.`], 'talk-cold'));
          // 글자 어긋남 연출. 연출을 끄거나 움직임을 줄이면 CSS가 막는다. 글은 그대로 남는다.
          response.classList.remove('fx-jolt');
          void response.offsetWidth;
          response.classList.add('fx-jolt');
          selected = null;
          draw();
        } else {
          fill(response,
            el('p', {}, `${josa(findClue(data, clueId).name, '을', '를')} 내민다.`),
            statement.reply ? el('p', { class: 'statement-reply' }, `“${statement.reply}”`) : null);
          if (outcome.roundDone) {
            const next = currentRound(caseState(app), suspect);
            const who = josa(suspect.name, '이', '가');
            add(response, el('p', {}, next ? `${who} 다른 이야기를 꺼낸다.` : `${who} 입을 다문다.`));
            if (!next && data.kind === 'final') {
              add(response, el('p', {}, el('a', { href: '#/desk' }, '책상으로 돌아가 그의 제안을 듣는다')));
            }
            enterRound();
          } else {
            selected = null;
            draw();
          }
        }
        response.setAttribute('tabindex', '-1');
        response.focus();
      }

      add(root,
        heading,
        el('p', { class: 'talk-meta' }, `${suspect.age}세, ${suspect.role}`),
        suspect.intro ? el('div', { class: 'log' }, ...lines([suspect.intro])) : null,
        body,
        el('div', { class: 'actions' }, back));
      enterRound();
      return { focus: heading };
    },
  });
}
