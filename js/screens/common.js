// 사건 데이터가 필요한 화면의 공통 틀: 불러오기 / 오류 / 상태 반영

import { el, button, notice, fill, add } from '../ui/dom.js';
import { announce } from '../ui/toast.js';
import { play } from '../sound.js';
import { updateCase, currentCase } from '../engine/game.js';
import { findClue } from '../engine/clues.js';
import { currentObjective } from '../engine/graph.js';

// render({ root, params, data, story, game }) → { focus, cleanup }
// caseId(params, game)로 어느 사건을 불러올지 정한다. 기본은 진행 중인 사건.
export function caseScreen(app, { title, chrome = 'desk', caseId, render }) {
  return ({ root, params }) => {
    const { game } = app.store.get();
    const id = caseId ? caseId(params, game) : game?.current;
    if (!id) {
      queueMicrotask(() => app.router.go('title'));
      return { chrome: 'none' };
    }

    const status = el('p', { class: 'loading', tabindex: '-1' }, '사건 기록을 불러오는 중');
    add(root, status);
    let disposed = false;
    let cleanup = null;

    Promise.all([app.loadCase(id), app.loadStory()]).then(([data, story]) => {
      if (disposed) return;
      const focusHere = document.activeElement === status;
      fill(root);
      const st = currentCase(app.store.get().game);
      if (st && app.store.get().game.current === data.id) {
        app.store.set({ objective: objectiveFor(data, st) });
      }
      const out = render({ root, params, data, story }) ?? {};
      cleanup = out.cleanup ?? null;
      if (focusHere) out.focus?.focus();
    }).catch((error) => {
      if (disposed) return;
      fill(root, loadError(app, error));
    });

    return {
      focus: status,
      title: typeof title === 'function' ? title(params) : title,
      chrome,
      cleanup: () => { disposed = true; cleanup?.(); },
    };
  };
}

export function loadError(app, error) {
  const box = notice({
    kind: 'error',
    icon: '!',
    title: '사건 기록을 불러오지 못했습니다.',
    body: [
      location.protocol === 'file:'
        ? '파일을 직접 열면 브라우저가 사건 기록을 읽지 못합니다. 웹 서버로 열어 주세요.'
        : '네트워크가 끊겼거나 파일이 없습니다. 잠시 뒤 다시 시도해 주세요.',
      `(${error.message})`,
    ],
    actions: [button({ label: '다시 시도', variant: 'primary', onClick: () => app.router.refresh() })],
  });
  box.setAttribute('role', 'alert');
  return box;
}

// "사건 1 · 방송실의 출석", "프롤로그 · 인수인계", "최종장 · 06-117"
export function chapterLabel(data) {
  const kind = data.kind ?? 'case';
  const head = kind === 'prologue' ? '프롤로그' : kind === 'final' ? '최종장' : `사건 ${data.chapter}`;
  return `${head} · ${data.title}`;
}

export function caseState(app) {
  return currentCase(app.store.get().game);
}

// 사건 상태를 store에 넣고, 새로 얻은 단서를 알림 줄에 띄운다.
// speak: 포커스가 옮겨 갈 글이 이미 같은 내용을 읽으면 false
// 지금 할 일 한 줄. 닫힌 장은 데이터의 목표 대신 다시 읽는 중이라고만 적는다.
export function objectiveFor(data, st) {
  return st.solved ? '종결된 사건부를 다시 읽는다' : currentObjective(data, new Set(st.have));
}

// sound: 새 단서를 적을 때 펜 소리. 다른 소리를 낼 화면(퍼즐 풀이)은 false로 끈다.
// toast: false면 알림 줄을 띄우지 않는다(현장의 메시지 창이 같은 줄을 이미 보여 줄 때).
export function commitCase(app, data, st, gained = [], { speak = true, sound = true, toast = true } = {}) {
  app.store.set((s) => ({
    ...s,
    game: updateCase(s.game, data, st, gained),
    objective: objectiveFor(data, st),
  }));
  for (const id of gained) {
    if (toast) announce(`사건부에 한 줄이 더해진다. ${findClue(data, id).name}`, { speak });
  }
  if (gained.length && sound) play('note');
}
