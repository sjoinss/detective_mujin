// 사건부: 단서 / 진술 / 기록 / 개요 / 메인 스토리
// 펼친 노트 모양(.sheet) 안에 그린다. 비어 있으면 서진우 메모 한 줄.

import { el, memo, lines } from './dom.js';
import { createTabs } from './tabs.js';
import { foundClues, sourceLabel, findClue, findObject, findScene, findPuzzle } from '../engine/clues.js';

export const BOOK_TABS = [
  ['clues', '단서'],
  ['statements', '진술'],
  ['log', '기록'],
  ['people', '개요'],
  ['story', '메인 스토리'],
];

// "새로 적음" 표시를 달 단서: 아직 펼쳐 보지 않은 줄 + 마지막 행동으로 얻은 줄(로그 끝에 이어진 clue 줄)
export function freshClues(data, st) {
  const ids = new Set(st.unread ? foundClues(data, st).slice(-st.unread).map((c) => c.id) : []);
  for (let i = st.log.length - 1; i >= 0 && st.log[i].k === 'clue'; i--) ids.add(st.log[i].id);
  return ids;
}

function clueList(data, st, fresh) {
  const clues = foundClues(data, st).reverse();
  if (!clues.length) return memo('아직 적을 것이 없다.');
  const names = new Map((data.suspects ?? []).map((s) => [s.id, s.name]));
  return el('ol', { class: 'clue-list', role: 'list' }, ...clues.map((clue) => el('li', {},
    el('article', { class: 'clue', 'aria-labelledby': `clue-${clue.id}`, dataset: { fresh: String(fresh.has(clue.id)) } },
      el('h3', { class: 'clue-name', id: `clue-${clue.id}` },
        clue.name,
        fresh.has(clue.id) ? el('span', { class: 'clue-tag' }, '새로 적음') : null),
      el('p', {}, clue.text),
      // 얻은 곳과 관련 인물을 한 줄에(목록이 길어도 한눈에 훑이게)
      el('p', { class: 'clue-meta' },
        el('span', { class: 'visually-hidden' }, '얻은 곳 '),
        sourceLabel(data, st.found[clue.id]) || '—',
        clue.people?.length ? [
          el('span', { 'aria-hidden': 'true' }, ' / '),
          el('span', { class: 'visually-hidden' }, '관련 인물 '),
          clue.people.map((id) => names.get(id) ?? id).join(', '),
        ] : null)))));
}

// 개요: 브리핑(사건 개요, 도는 소문)과 인물. 브리핑은 한 번 지나가면 끝이 아니라 여기 남는다.
function overview(data) {
  const b = data.briefing ?? {};
  return el('div', { class: 'people' },
    b.summary?.length ? [el('h3', {}, '개요'), el('div', {}, ...b.summary.map((t) => el('p', {}, t)))] : null,
    b.rumor?.length ? [el('h3', {}, '도는 소문'), el('div', {}, ...b.rumor.map((t) => el('p', {}, t)))] : null,
    people(data));
}

function people(data) {
  const victim = data.briefing?.victim;
  const person = (p, extra) => el('li', { class: 'person' },
    el('h4', {}, p.name, el('span', { class: 'person-age' }, ` (${p.age})`)),
    el('p', { class: 'sheet-meta' }, p.role),
    extra ? el('p', {}, extra) : null);
  return el('div', { class: 'people' },
    victim ? [el('h3', {}, '피해자'), el('ul', { role: 'list' }, person(victim, victim.text))] : null,
    data.suspects?.length ? [
      el('h3', {}, (data.kind ?? 'case') === 'case' ? '용의자' : '마주 앉을 사람'),
      el('ul', { role: 'list' }, ...data.suspects.map((s) => person(s, s.intro))),
    ] : null);
}

// 들은 진술: 사람별로, 모순을 짚은 말에는 표시
function statementList(data, st) {
  const heard = new Set(st.heard ?? []);
  const groups = (data.suspects ?? [])
    .map((s) => ({ suspect: s, said: (s.rounds ?? []).flatMap((r) => r.statements ?? []).filter((x) => heard.has(x.id)) }))
    .filter((g) => g.said.length);
  if (!groups.length) return memo('들은 말이 아직 없다.');
  return el('div', { class: 'people' }, ...groups.map(({ suspect, said }) => [
    el('h3', {}, suspect.name),
    el('ul', { role: 'list' }, ...said.map((x) => el('li', { class: 'said' },
      el('p', {}, `“${x.text}”`),
      st.have.includes(x.id) ? el('p', { class: 'said-mark' }, '✓ 모순 확인') : null))),
  ]));
}

function storyPages(story, fragments) {
  const got = (story?.fragments ?? []).filter((f) => fragments.includes(f.id));
  if (!got.length) return memo('한 장도 없다. 아직.');
  const titles = new Map((story.chapters ?? []).map((c) => [c.id, c.title]));
  return el('ol', { class: 'clue-list', role: 'list' }, ...got.map((f) => el('li', {},
    el('article', { class: 'clue' },
      el('h3', { class: 'clue-name' }, f.name),
      el('p', { class: 'sheet-meta' }, titles.get(f.chapter) ?? '')))));
}

// 기록: 지금까지 읽은 지문 전부(장면·살펴본 것·전화·풀이). 현장에서는 창으로 띄우고 지우므로 다시 읽는 곳은 여기다.
// 장면에 들어간 줄마다 묶고, 지금 장면 앞은 접어 둔다. 최근 것이 위.
function logPages(data, st) {
  const groups = [];
  st.log.forEach((item) => {
    if (item.k === 'scene' || !groups.length) groups.push({ scene: item.k === 'scene' ? findScene(data, item.id) : null, items: [] });
    if (item.k !== 'scene') groups[groups.length - 1].items.push(item);
  });
  const entry = (item) => {
    if (item.k === 'look') {
      const obj = findObject(data, item.id)?.obj;
      return obj && el('div', { class: 'log-entry' }, el('p', { class: 'log-choice' }, obj.label), ...lines(obj.text));
    }
    if (item.k === 'han') {
      const line = data.han?.[Number(item.id.split('.')[1])];
      return line && el('div', { class: 'log-entry' },
        el('p', { class: 'log-choice' }, '한도윤에게 전화한다'),
        el('p', {}, el('span', { class: 'log-speaker' }, '한도윤 '), `“${line.text}”`));
    }
    if (item.k === 'solve') {
      const puzzle = findPuzzle(data, item.id);
      return puzzle && el('div', { class: 'log-entry' }, el('p', { class: 'log-choice' }, puzzle.title), ...lines(puzzle.solvedText));
    }
    if (item.k === 'clue') {
      const clue = findClue(data, item.id);
      return clue && el('p', { class: 'log-note' }, el('span', { class: 'log-note-tag' }, '사건부에 적었다'), clue.name);
    }
    return null;
  };
  const block = (g) => el('section', { class: 'log' },
    g.scene ? [el('h3', {}, g.scene.name), ...lines(g.scene.text)] : null,
    ...g.items.map(entry));
  const blocks = groups.map(block).reverse();
  if (!blocks.length) return memo('아직 적힌 글이 없다.');
  const [now, ...past] = blocks;
  return el('div', { class: 'log-book' },
    now,
    past.length ? el('details', { class: 'log-past' }, el('summary', {}, `앞서 본 곳 (${past.length})`), el('div', { class: 'log-book' }, ...past)) : null);
}

export function casebook({ data, st, story, fragments, selected, onSelect, fresh = freshClues(data, st) }) {
  const render = {
    clues: () => clueList(data, st, fresh),
    people: () => overview(data),
    statements: () => statementList(data, st),
    log: () => logPages(data, st),
    story: () => storyPages(story, fragments),
  };
  // 펼쳐 보지 않은 단서가 있으면 단서 탭에 수를 단다
  const badges = { clues: st.unread ? `새 ${st.unread}` : '' };
  return createTabs({
    label: '사건부 분류',
    tabs: BOOK_TABS.map(([id, label]) => ({ id, label, badge: badges[id], render: render[id] })),
    selected,
    onSelect,
  }).node;
}
