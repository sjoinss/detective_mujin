// 책상(현장 탐색) 화면: 장면·글 흐름 / 살펴볼 곳·말을 들을 사람·보고서 / 사건부.
// 상태는 store의 game에 있고, 이 화면은 엔진 함수로 바꾼 상태를 store에 넣고 다시 그린다.

import { el, button, lines, notice, fill, add } from '../ui/dom.js';
import { play } from '../sound.js';
import { sceneView, objectList } from '../ui/scene.js';
import { casebook } from '../ui/casebook.js';
import {
  inspect, move, openScenes, visibleObjects, findScene, findObject, findClue, findPuzzle,
  puzzleOpen, markRead, reconcile, askHan, complete,
} from '../engine/clues.js';
import { suspectOpen, suspectDone } from '../engine/interrogation.js';
import { canReport, closeCase } from '../engine/accusation.js';
import { setPlayer } from '../engine/game.js';
import { decideEnding, setEnding } from '../engine/final.js';
import { choiceDialog } from '../ui/dialog.js';
import { announce } from '../ui/toast.js';
import { saveGame } from '../save.js';
import { caseScreen, caseState, commitCase, chapterLabel } from './common.js';

const WIDE = '(min-width: 64em)';

let bookTab = 'clues';

export function deskScreen(app) {
  const screen = caseScreen(app, {
    title: (params) => (params[0] === 'book' ? '사건부' : '현장'),
    render: ({ params, root, data, story }) => {
      const view = params[0] === 'book' ? 'book' : 'scene';
      const desk = createDesk(app, data, story, view);
      add(root, desk.node);

      const unsubscribe = app.store.subscribe((state, prev) => {
        if (state.saveError !== prev.saveError || state.storageOk !== prev.storageOk) desk.drawStatus();
      });
      const onKey = (event) => {
        // 좁은 화면에서 사건부를 펼쳤을 때 ESC로 접는다
        if (event.key === 'Escape' && view === 'book' && !document.querySelector('dialog[open]')) {
          app.router.go('desk');
        }
      };
      document.addEventListener('keydown', onKey);
      return {
        focus: desk.focus,
        cleanup: () => { unsubscribe(); document.removeEventListener('keydown', onKey); },
      };
    },
  });

  return (ctx) => {
    // 읽을 수 없는 저장이 있으면 덮어쓰기 전에 타이틀의 안내를 거치게 한다
    const { game, saveStatus } = app.store.get();
    if (!game) {
      queueMicrotask(() => app.router.go(saveStatus === 'old' || saveStatus === 'broken' ? 'title' : 'cases'));
      return { chrome: 'none' };
    }
    return screen(ctx);
  };
}

function createDesk(app, data, story, view) {
  const bookVisible = () => view === 'book' || window.matchMedia(WIDE).matches;

  // 저장된 장면이 데이터에서 사라졌으면 시작 장면으로
  {
    let st = reconcile(data, caseState(app));
    if (bookVisible()) st = markRead(st);
    commitCase(app, data, st);
  }
  const kind = data.kind ?? 'case';

  // 프롤로그는 닫히는 조건을 채우면 바로 닫히고 결과로 간다
  function closePrologueIfDone() {
    const st = caseState(app);
    if (kind !== 'prologue' || st.solved || !complete(data, st)) return false;
    commitCase(app, data, closeCase(st));
    queueMicrotask(() => app.router.go('result'));
    return true;
  }
  if (closePrologueIfDone()) return { node: el('p', { class: 'loading' }, '사건부를 넘기는 중'), drawStatus() {}, focus: null };

  // 최종장: 한도윤의 제안. 모달은 엔딩 선택에만 쓴다.
  async function hearOffer() {
    const offer = data.offer;
    const pick = await choiceDialog({
      title: '한도윤의 제안',
      body: offer.text,
      choices: [{ id: 'refuse', label: offer.refuse }, { id: 'accept', label: offer.accept }],
    });
    if (!pick) return;
    const { game } = app.store.get();
    const st = caseState(app);
    const ending = decideEnding({ data, story, game, st, accept: pick === 'accept' });
    commitCase(app, data, closeCase(st));
    app.store.set((s) => ({ ...s, game: setEnding(s.game, ending) }));
    app.router.go('ending');
  }

  const statusSlot = el('div', { class: 'desk-status' });
  const desk = el('div', { class: 'desk', dataset: { view } });
  const sceneCol = el('section', { class: 'desk-scene', 'aria-labelledby': 'desk-title' });
  const listCol = el('section', { class: 'desk-list', 'aria-labelledby': 'list-title' });
  const bookCol = el('aside', { class: 'desk-book sheet', 'aria-labelledby': 'book-title' });
  add(desk, sceneCol, listCol, bookCol);

  const heading = el('h1', { class: 'section-title', id: 'desk-title', tabindex: '-1' }, chapterLabel(data));
  const bookHeading = el('h2', { id: 'book-title', tabindex: '-1' }, '사건부');

  function commit(st, gained = []) {
    commitCase(app, data, bookVisible() ? markRead(st) : st, gained, { speak: false });
  }

  function doInspect(obj) {
    const before = caseState(app).log.length;
    const { state, gained } = inspect(data, caseState(app), obj.id);
    commit(state, gained);
    // 손댈 수 있는 물건이면 퍼즐 패널로. 패널 맨 위에 같은 지문이 다시 나온다.
    if (obj.puzzle && puzzleOpen(data, caseState(app), obj.puzzle)) {
      app.router.go(`puzzle/${obj.puzzle}`);
      return;
    }
    draw();
    focusEntry(before);
  }

  function doAskHan() {
    const before = caseState(app).log.length;
    commit(askHan(data, caseState(app)));
    draw();
    focusEntry(before);
  }

  // 인계 칸: 이름을 적는다. 비워 둬도 진행에는 상관없다.
  function nameField() {
    const id = 'player-name';
    const input = el('input', {
      id,
      class: 'restore-input',
      type: 'text',
      maxlength: '12',
      autocomplete: 'off',
      value: app.store.get().game.player ?? '',
    });
    const save = (event) => {
      event.preventDefault();
      app.store.set((s) => ({ ...s, game: setPlayer(s.game, input.value) }));
      const name = app.store.get().game.player;
      announce(name ? `인계 칸에 이름을 적는다. ${name}.` : '인계 칸을 비워 둔다.');
    };
    return el('form', { class: 'name-field', onsubmit: save },
      el('label', { for: id }, '인계'),
      input,
      button({ label: '적는다', type: 'submit' }));
  }

  function doMove(scene) {
    const before = caseState(app).log.length;
    play('step');
    commit(move(data, caseState(app), scene.id));
    draw();
    focusEntry(before);
  }

  // 이번 행동으로 생긴 첫 글로 포커스를 옮긴다. 글을 먼저 읽고, 다음 Tab에서 선택지로 간다.
  function focusEntry(index) {
    const entry = sceneCol.querySelector(`.log-entry[data-index="${index}"]`);
    if (!entry) return;
    entry.focus({ preventScroll: true });
    entry.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  // 글 흐름: 지금 장면에 들어온 뒤의 글만 펼치고, 그 앞은 "앞서 본 것"으로 접는다.
  // 지운 것은 없다. 접은 글도 펼치면 그대로 다시 읽힌다.
  // "사건부에 적는다" 줄은 그 단서를 얻은 행동 바로 아래에 붙인다.
  function renderLog(log) {
    const items = [];
    log.forEach((item, i) => {
      if (item.k === 'clue' && items.length) {
        const clue = findClue(data, item.id);
        if (clue) add(items[items.length - 1].node, el('p', { class: 'log-note' }, el('span', { class: 'log-note-tag' }, '사건부에 적는다'), clue.name));
        return;
      }
      const node = logEntry(item, i, log);
      if (node) items.push({ node, k: item.k, i });
    });
    let start = 0;
    items.forEach((x, n) => { if (x.k === 'scene') start = n; });
    const past = items.slice(0, start).map((x) => x.node);
    const now = items.slice(start).map((x) => x.node);
    return el('div', { class: 'log' },
      past.length ? el('details', { class: 'log-past' },
        el('summary', {}, '앞서 본 것'),
        el('div', { class: 'log' }, ...past)) : null,
      ...now);
  }

  function logEntry(item, index, log) {
    const attrs = { class: 'log-entry', tabindex: '-1', dataset: { index: String(index) } };
    if (item.k === 'han') {
      const line = data.han?.[Number(item.id.split('.')[1])];
      return line && el('div', attrs,
        el('p', { class: 'log-choice' }, '한도윤에게 전화한다'),
        el('p', {}, el('span', { class: 'log-speaker' }, '한도윤 '), `“${line.text}”`));
    }
    if (item.k === 'look') {
      const obj = findObject(data, item.id)?.obj;
      // 이름 칸은 그 물건을 마지막으로 살펴본 줄에만 둔다
      const latest = obj?.input && log.findLastIndex((e) => e.k === 'look' && e.id === item.id) === index;
      return obj && el('div', attrs, el('p', { class: 'log-choice' }, obj.label), ...lines(obj.text), latest ? nameField() : null);
    }
    if (item.k === 'scene') {
      const scene = findScene(data, item.id);
      return scene && el('div', attrs, el('h3', {}, scene.name), ...lines(scene.text));
    }
    if (item.k === 'solve') {
      const puzzle = findPuzzle(data, item.id);
      return puzzle && el('div', attrs, el('p', { class: 'log-choice' }, puzzle.title), ...lines(puzzle.solvedText));
    }
    if (item.k === 'clue') {
      const clue = findClue(data, item.id);
      return clue && el('div', attrs,
        el('p', { class: 'log-note' }, el('span', { class: 'log-note-tag' }, '사건부에 적는다'), clue.name));
    }
    return null;
  }

  function drawStatus() {
    const { saveError, storageOk } = app.store.get();
    if (!storageOk) {
      fill(statusSlot, notice({
        kind: 'warn',
        icon: '!',
        body: ['이 창에서는 진행이 저장되지 않습니다. 설정의 저장 코드로 지금까지를 옮겨 적을 수 있습니다.'],
      }));
    } else if (saveError) {
      fill(statusSlot, notice({
        kind: 'error',
        icon: '!',
        title: '진행을 저장하지 못했습니다.',
        body: ['저장 공간이 꽉 찼거나 브라우저가 저장을 막았습니다. 다시 시도하거나, 설정의 저장 코드로 지금까지를 옮겨 적어 두세요.'],
        actions: [button({
          label: '다시 저장',
          onClick: () => app.store.set({ saveError: !saveGame(app.store.get().game).ok }),
        })],
      }));
    } else {
      fill(statusSlot);
    }
  }

  function draw() {
    const { game } = app.store.get();
    const st = caseState(app);
    const scene = findScene(data, st.sceneId);
    const done = new Set(st.have);
    const objects = { ...scene, objects: visibleObjects(st, scene) };

    fill(sceneCol,
      statusSlot,
      el('h2', {}, scene.name),
      sceneView(objects, { done, onInspect: doInspect }),
      el('h2', { class: 'visually-hidden' }, '지문'),
      renderLog(st.log));

    const elsewhere = openScenes(data, st).filter((s) => s.id !== scene.id);
    const people = (data.suspects ?? []).filter((s) => suspectOpen(st, s));
    const reportReady = canReport(data, st);
    fill(listCol,
      el('h2', { class: 'section-title', id: 'list-title' }, '살펴볼 곳'),
      objectList(objects, { done, onInspect: doInspect, headingId: 'list-title' }),
      ...(elsewhere.length ? [
        el('h2', { class: 'section-title', id: 'moves-title' }, '다른 곳'),
        el('div', { class: 'scene-moves', role: 'group', 'aria-labelledby': 'moves-title' },
          ...elsewhere.map((s) => button({ label: s.name, onClick: () => doMove(s) }))),
      ] : []),
      // 말을 들을 사람과 한도윤에게 거는 전화는 한 목록에 둔다(메뉴 칸을 줄인다)
      ...(people.length || data.han?.length ? [
        el('h2', { class: 'section-title', id: 'people-title' }, '말을 들을 사람'),
        el('ul', { class: 'choices', role: 'list', 'aria-labelledby': 'people-title' },
          ...people.map((s) =>
            el('li', {}, el('a', { href: `#/talk/${s.id}`, class: 'choice', dataset: { done: String(suspectDone(st, s)) } },
              el('span', { class: 'choice-label' }, s.name),
              suspectDone(st, s) ? el('span', { class: 'choice-mark' }, '✓ 다 들었다') : null))),
          data.han?.length ? el('li', {}, el('button', { type: 'button', class: 'choice', onclick: doAskHan },
            el('span', { class: 'choice-label' }, '한도윤'),
            el('span', { class: 'choice-mark' }, '전화')) ) : null),
      ] : []),
      el('div', { class: 'desk-report' }, closingAction(st, reportReady)));

    fill(bookCol,
      el('div', { class: 'book-header' },
        bookHeading,
        el('a', { href: '#/desk', class: 'btn btn--ghost only-narrow' }, '사건부 접기')),
      casebook({
        data,
        st,
        story,
        fragments: game.fragments,
        selected: bookTab,
        onSelect: (id) => { bookTab = id; },
      }));
  }

  // 장을 닫는 동작: 사건은 보고서, 최종장은 한도윤의 제안, 프롤로그는 저절로 닫힌다
  function closingAction(st, reportReady) {
    if (kind === 'case') {
      return reportReady
        ? el('a', { href: '#/report', class: 'btn btn--primary' }, '보고서 쓰기')
        : button({ label: '보고서 쓰기', disabledReason: '아직 서류가 덜 모였다.' });
    }
    if (kind === 'final') {
      if (app.store.get().game.ending) return el('a', { href: '#/ending', class: 'btn btn--primary' }, '그 뒤');
      return complete(data, st)
        ? button({ label: '한도윤의 제안을 듣는다', variant: 'primary', onClick: hearOffer })
        : button({ label: '한도윤의 제안을 듣는다', disabledReason: '아직 마주 앉지 않았다.' });
    }
    return null;
  }

  drawStatus();
  draw();
  // 장 제목(h1)은 세 칸 위에 둔다. 좁은 화면에서 사건부만 펼쳐도 제목이 남는다.
  return { node: el('div', { class: 'desk-wrap' }, heading, desk), drawStatus, focus: view === 'book' ? bookHeading : heading };
}
