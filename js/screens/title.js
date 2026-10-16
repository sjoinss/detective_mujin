// 타이틀: 이어하기 / 새로 시작 / 설정, 콘텐츠 주의.
// 처음 켰을 때만 연출 강도와 소리를 여기서 고른다(9.5).

import { el, button, linkButton, notice, add } from '../ui/dom.js';
import { radioGroup } from '../ui/fields.js';
import { confirmDialog } from '../ui/dialog.js';
import { alertNow } from '../ui/toast.js';
import { storage } from '../store.js';
import { SETTING_OPTIONS } from '../state.js';
import { saveSettings } from '../settings.js';
import { clearGame } from '../save.js';

const UNREADABLE = {
  old: '저장된 사건부가 예전 형식이라 이어서 펼칠 수 없습니다.',
  broken: '저장된 사건부가 손상돼 읽을 수 없습니다.',
};

export function titleScreen(app) {
  return ({ root }) => {
    const { settingsSaved, storageOk, hasSave, settings, saveStatus, game } = app.store.get();
    const player = game?.player ?? '';
    const firstRun = !settingsSaved;

    const setting = (key) => (value) => app.store.set((s) => ({ ...s, settings: { ...s.settings, [key]: value } }));

    async function startNew() {
      if (app.store.get().hasSave) {
        const ok = await confirmDialog({
          title: '사건부를 처음부터 펼칠까요?',
          body: ['지금까지 적은 사건부가 지워집니다. 되돌릴 수 없습니다.'],
          confirmLabel: '지우고 처음부터',
          destructive: true,
        });
        if (!ok) return;
      }
      clearGame();
      app.store.set({ game: null, hasSave: false, saveStatus: 'none' });
      if (firstRun && storageOk) {
        if (saveSettings(app.store.get().settings).ok) app.store.set({ settingsSaved: true });
      }
      app.router.go('cases');
    }

    const storageNotice = storageOk ? null : notice({
      kind: 'error',
      icon: '!',
      title: '이 브라우저에서는 진행을 저장할 수 없습니다.',
      body: [
        '시크릿 창이거나 사이트 데이터 저장이 막혀 있을 때 그렇습니다. 일반 창에서 열거나, 이 사이트의 저장을 허용하면 됩니다.',
        '이대로도 플레이할 수 있지만 창을 닫으면 처음부터 다시 시작합니다.',
      ],
      actions: [button({
        label: '다시 확인',
        onClick: () => {
          const ok = storage.available();
          app.store.set({ storageOk: ok });
          if (!ok) alertNow('여전히 저장이 막혀 있습니다.');
          app.router.refresh();
        },
      })],
    });

    const saveNotice = UNREADABLE[saveStatus] ? notice({
      kind: 'error',
      icon: '!',
      title: UNREADABLE[saveStatus],
      body: ['새로 시작하면 이 기록은 지워집니다. 다른 곳에 옮겨 적은 저장 코드가 있다면 설정에서 불러올 수 있습니다.'],
    }) : null;

    const warning = el('p', { class: 'title-note' },
      el('strong', {}, '콘텐츠 주의. '),
      '죽음과 사건 현장, 기록 은폐가 나옵니다. 잔혹한 장면은 그리지 않습니다. 화면 노이즈 같은 불안한 연출은 설정에서 줄이거나 끌 수 있습니다.');

    const firstRunChoices = firstRun ? el('div', { class: 'settings-group' },
      radioGroup({
        name: 'first-fx',
        legend: '공포 연출',
        options: SETTING_OPTIONS.fx,
        value: settings.fx,
        onChange: setting('fx'),
      }),
      radioGroup({
        name: 'first-sound',
        legend: '소리',
        help: '소리가 없어도 모든 단서를 얻을 수 있습니다.',
        options: SETTING_OPTIONS.sound,
        value: settings.sound,
        onChange: setting('sound'),
      })) : null;

    // 주 CTA가 맨 위에 오게: 저장이 있으면 이어하기, 없으면 새로 시작
    const continueBtn = button({
      label: '이어하기',
      variant: hasSave ? 'primary' : '',
      disabledReason: hasSave ? '' : '아직 펼친 사건부가 없다.',
      // 펼쳐 둔 사건이 아직 안 닫혔으면 현장으로, 아니면 사건부 철로
      onClick: () => {
        const { game } = app.store.get();
        const open = game?.cases?.[game.current] && !game.cases[game.current].solved;
        app.router.go(open ? 'desk' : 'cases');
      },
    });
    const newBtn = button({ label: '새로 시작', variant: hasSave ? '' : 'primary', onClick: startNew });
    const actions = el('div', { class: 'actions actions--stack' },
      ...(hasSave ? [continueBtn, newBtn] : [newBtn, continueBtn]),
      linkButton({ label: '설정', href: '#/settings', variant: 'ghost' }));

    // 사건부 표지. 인계 칸은 비어 있다. 거기에 이름을 적는 건 프롤로그에서.
    const cover = el('section', { class: 'cover sheet', 'aria-labelledby': 'cover-title' },
      el('p', { class: 'cover-org' }, '무진경찰서 장기미제 기록실'),
      el('h1', { class: 'cover-title', id: 'cover-title', tabindex: '-1' }, '무진 사건부'),
      el('dl', { class: 'cover-fields' },
        el('div', {}, el('dt', {}, '작성'), el('dd', {}, '서진우')),
        el('div', {}, el('dt', {}, '인계'), player
          ? el('dd', {}, player)
          : el('dd', { class: 'cover-blank' }, el('span', { class: 'visually-hidden' }, '빈칸'))),
        el('div', {}, el('dt', {}, '기간'), el('dd', {}, '2026년 11월부터'))),
      el('p', { class: 'cover-stamp' }, '미결'));

    add(root, el('div', { class: 'title-screen' },
      cover,
      el('div', { class: 'title-side' }, storageNotice, saveNotice, firstRunChoices, actions, warning)));

    const heading = cover.querySelector('h1');

    return { focus: heading, chrome: 'none' };
  };
}
