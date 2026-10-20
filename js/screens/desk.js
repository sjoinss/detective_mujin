// 책상(현장 탐색) 화면: 장면 / 살펴볼 곳·말을 들을 사람·보고서 / 사건부.
// 살펴본 글은 메시지 창으로 띄우고 닫으면 사라진다. 지난 글은 사건부 "기록" 탭에 모두 남는다.
// 상태는 store의 game에 있고, 이 화면은 엔진 함수로 바꾼 상태를 store에 넣고 다시 그린다.

import { el, button, lines, notice, fill, add } from '../ui/dom.js';
import { play } from '../sound.js';
import { sceneView, objectList } from '../ui/scene.js';
import { casebook, freshClues } from '../ui/casebook.js';
import { showMessage } from '../ui/message.js';
import {
  inspect, move, openScenes, visibleObjects, findScene, findClue,
  puzzleOpen, markRead, reconcile, askHan, hanLine, complete,
} from '../engine/clues.js';
import { suspectOpen, suspectDone } from '../engine/interrogation.js';
import { canReport, closeCase } from '../engine/accusation.js';
import { setPlayer } from '../engine/game.js';
import { decideEnding, setEnding } from '../engine/final.js';
import { choiceDialog } from '../ui/dialog.js';
import { announce } from '../ui/toast.js';
import { saveGame } from '../save.js';
import { saveSettings } from '../settings.js';
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
  // 단서 탭이 눈앞에 펼쳐져 있어야 새 줄을 읽은 것으로 친다
  const cluesInSight = () => bookVisible() && bookTab === 'clues';

  // 저장된 장면이 데이터에서 사라졌으면 시작 장면으로
  // fresh: "새로 적음" 표시를 달 단서. 읽음 처리 전에 골라 둔다.
  let fresh;
  {
    let st = reconcile(data, caseState(app));
    // 새 줄이 있다고 해서 사건부를 펼쳤으면 단서 탭부터 보인다
    if (view === 'book' && st.unread) bookTab = 'clues';
    fresh = freshClues(data, st);
    if (cluesInSight()) st = markRead(st);
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

  // 메시지 창이 단서 이름을 보여 주고 읽으므로 알림 줄은 띄우지 않는다
  function commit(st, gained = []) {
    fresh = freshClues(data, st);
    commitCase(app, data, cluesInSight() ? markRead(st) : st, gained, { speak: false, toast: false });
  }

  // 이번 행동으로 새로 갈 수 있게 된 곳, 말을 들을 수 있게 된 사람
  function openings(prev, st) {
    const was = new Set(openScenes(data, prev).map((s) => s.id));
    const places = openScenes(data, st).filter((s) => !was.has(s.id)).map((s) => s.name);
    const people = (data.suspects ?? []).filter((s) => suspectOpen(st, s) && !suspectOpen(prev, s)).map((s) => s.name);
    return [
      places.length ? `갈 수 있는 곳이 생겼다: ${places.join(', ')}` : null,
      people.length ? `말을 들을 사람이 생겼다: ${people.join(', ')}` : null,
    ].filter(Boolean);
  }

  // 창을 닫으면 연 자리(그림 위 핫스팟이나 목록)로 포커스를 돌린다. 스크롤은 그대로 둔다.
  function returnTo(selector) {
    return () => desk.querySelector(selector)?.focus({ preventScroll: true });
  }
  function openerOf(id) {
    const where = document.activeElement?.classList.contains('hotspot') ? '.hotspot' : '.choice';
    return returnTo(`${where}[data-obj="${CSS.escape(id)}"]`);
  }

  function doInspect(obj) {
    const restore = openerOf(obj.id);
    const prev = caseState(app);
    const { state, gained } = inspect(data, prev, obj.id);
    commit(state, gained);
    // 손댈 수 있는 물건이면 퍼즐 패널로. 패널 맨 위에 같은 지문이 다시 나온다.
    if (obj.puzzle && puzzleOpen(data, caseState(app), obj.puzzle)) {
      app.router.go(`puzzle/${obj.puzzle}`);
      return;
    }
    draw();
    showMessage({
      label: obj.label,
      text: obj.text,
      gained: gained.map((id) => findClue(data, id).name),
      opened: openings(prev, caseState(app)),
      extra: obj.input ? nameField() : null,
      restore,
    });
  }

  function doAskHan() {
    commit(askHan(data, caseState(app)));
    draw();
    const line = data.han?.[hanLine(data, caseState(app))];
    if (!line) return;
    showMessage({ label: '한도윤', speaker: true, text: [`“${line.text}”`], restore: returnTo('.choice[data-han]') });
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

  // 다른 곳으로 가면 장면 제목으로 옮긴다(그림과 장면 글이 바로 아래에 있다)
  function doMove(scene) {
    play('step');
    commit(move(data, caseState(app), scene.id));
    draw();
    sceneCol.querySelector('.scene-title')?.focus();
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
      el('div', { class: 'scene-heading' },
        el('h2', { class: 'scene-title', tabindex: '-1' }, scene.name),
        marksToggle()),
      sceneView(objects, { done, onInspect: doInspect }),
      el('div', { class: 'scene-text' }, ...lines(scene.text)));

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
          data.han?.length ? el('li', {}, el('button', { type: 'button', class: 'choice', dataset: { han: 'true' }, onclick: doAskHan },
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
        fresh,
        selected: bookTab,
        onSelect: (id) => {
          const was = bookTab;
          bookTab = id;
          // 단서 탭을 펼치면 새 줄을 읽은 것으로 친다(표시는 이번에 그린 그대로 남는다)
          if (id === 'clues' && was !== 'clues' && caseState(app).unread) {
            commitCase(app, data, markRead(caseState(app)));
            bookCol.querySelector('.tab-badge')?.remove();
          }
        },
      }));
  }

  // 그림 속 누를 곳 표시 켜기/끄기(기본은 끔). 설정에 함께 저장된다.
  function marksToggle() {
    const on = app.store.get().settings.marks === 'on';
    return el('button', {
      type: 'button',
      class: 'btn btn--ghost marks-toggle',
      'aria-pressed': String(on),
      onclick: (event) => {
        const settings = { ...app.store.get().settings, marks: on ? 'off' : 'on' };
        app.store.set({ settings });
        saveSettings(settings);
        const btn = event.currentTarget;
        btn.replaceWith(marksToggle());
        sceneCol.querySelector('.marks-toggle')?.focus();
      },
    }, on ? '누를 곳 숨기기' : '누를 곳 보기');
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
