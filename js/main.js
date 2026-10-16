// 시작점: 설정과 저장을 불러와 적용하고, 상태 변화를 화면 틀과 자동 저장에 잇고, 라우터를 켠다.

import { createStore, storage } from './store.js';
import { initialState } from './state.js';
import { loadSettings, applySettings, applyUnease } from './settings.js';
import { loadGame, saveGame } from './save.js';
import { currentCase } from './engine/game.js';
import { createRouter } from './router.js';
import { alertNow } from './ui/toast.js';
import { titleScreen } from './screens/title.js';
import { deskScreen } from './screens/desk.js';
import { boardScreen } from './screens/board.js';
import { settingsScreen } from './screens/settings.js';
import { casesScreen } from './screens/cases.js';
import { briefingScreen } from './screens/briefing.js';
import { puzzleScreen } from './screens/puzzle.js';
import { talkScreen } from './screens/talk.js';
import { reportScreen } from './screens/report.js';
import { resultScreen } from './screens/result.js';
import { endingScreen } from './screens/ending.js';

const store = createStore(initialState());

const storageOk = storage.available();
const { settings, saved } = loadSettings();
const loaded = storageOk ? loadGame() : { status: 'none', game: null };
store.set({
  storageOk,
  settings,
  settingsSaved: saved,
  saveStatus: loaded.status,
  game: loaded.game,
  hasSave: loaded.status === 'ok',
});
applySettings(settings);

const objective = document.getElementById('objective');
const bookBadge = document.getElementById('book-badge');

store.subscribe((state, prev) => {
  if (state.settings !== prev.settings) applySettings(state.settings);
  if (state.objective !== prev.objective) objective.textContent = state.objective;
  if (state.game !== prev.game) {
    applyUnease(currentCase(state.game)?.unease ?? 0);
    const unread = currentCase(state.game)?.unread ?? 0;
    bookBadge.textContent = unread ? ` · 새 줄 ${unread}` : '';

    // 자동 저장. 실패는 한 번만 바로 알리고, 화면에는 계속 남긴다.
    if (state.game && state.storageOk) {
      const ok = saveGame(state.game).ok;
      if (!ok && !state.saveError) alertNow('진행을 저장하지 못했습니다.');
      if (ok !== !state.saveError) store.set({ saveError: !ok });
    }
  }
});

const cache = new Map();
// 같은 파일을 동시에 여러 번 부르면 한 번만 받는다(약속을 담아 둔다). 실패하면 지워서 다시 시도할 수 있게.
function fetchJson(url) {
  if (!cache.has(url)) {
    // 사건 데이터는 고쳐질 수 있으므로 매번 서버에 새 버전이 있는지 묻는다(바뀌지 않았으면 304)
    cache.set(url, fetch(url, { cache: 'no-cache' })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .catch((error) => { cache.delete(url); throw error; }));
  }
  return cache.get(url);
}

const app = {
  store,
  router: null,
  // 장 파일 경로는 story.json의 chapters[].file이 정한다(최종장은 data/final.json)
  loadCase: async (id) => {
    const story = await fetchJson('data/story.json');
    const chapter = (story.chapters ?? []).find((c) => c.id === id);
    if (!chapter) throw new Error(`없는 장 ${id}`);
    return fetchJson(`data/${chapter.file}`);
  },
  loadStory: () => fetchJson('data/story.json'),
};

const navLinks = [...document.querySelectorAll('.bottombar a[data-route]')];
app.router = createRouter({
  root: document.getElementById('main'),
  fallback: 'title',
  routes: {
    title: titleScreen(app),
    desk: deskScreen(app),
    board: boardScreen(app),
    settings: settingsScreen(app),
    cases: casesScreen(app),
    briefing: briefingScreen(app),
    puzzle: puzzleScreen(app),
    talk: talkScreen(app),
    report: reportScreen(app),
    result: resultScreen(app),
    ending: endingScreen(app),
  },
  onChange: ({ name, path }) => {
    for (const a of navLinks) {
      if (a.dataset.route === path) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    }
    if (name !== 'settings') store.set({ route: path, returnTo: path });
  },
});
app.router.start();
