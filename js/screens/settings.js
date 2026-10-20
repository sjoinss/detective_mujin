// 설정: 고르면 바로 바뀌고 바로 저장된다(저장 버튼을 깜빡하고 나가 바뀐 것이 사라지지 않게).
// 조작 안내는 게임 본문에 두지 않고 여기에만 둔다(2.4).

import { el, button, linkButton, notice, nextId, fill, add, setBusy } from '../ui/dom.js';
import { play } from '../sound.js';
import { radioGroup } from '../ui/fields.js';
import { announce, alertNow } from '../ui/toast.js';
import { confirmDialog } from '../ui/dialog.js';
import { DEFAULT_SETTINGS, SETTING_OPTIONS } from '../state.js';
import { applySettings, saveSettings } from '../settings.js';
import { encodeGame, decodeGame } from '../engine/saveCode.js';
import { restartCase } from '../engine/game.js';

const GROUPS = [
  { key: 'textSize', legend: '글자 크기' },
  { key: 'contrast', legend: '대비' },
  { key: 'motion', legend: '움직임', help: '화면 전환과 흔들림을 줄입니다.' },
  { key: 'fx', legend: '공포 연출', help: '화면 노이즈와 글자 어긋남. 꺼도 모든 글은 그대로 읽힙니다.' },
  { key: 'sound', legend: '소리', help: '소리가 없어도 모든 단서를 얻을 수 있습니다.' },
  { key: 'marks', legend: '누를 곳 표시', help: '장면 그림에서 살펴볼 수 있는 곳에 표식을 띄웁니다. 현장 화면에서도 바로 켜고 끌 수 있습니다.' },
];

const KEYS = [
  ['Tab / Shift+Tab', '다음 / 이전 항목'],
  ['Enter / Space', '살펴보기, 고르기, 누르기'],
  ['← → Home End', '탭 넘기기(할 일, 사건부)'],
  ['Esc', '펼친 사건부나 창 닫기'],
  ['터치', '그림 속 자리를 누르거나, 아래 "살펴볼 곳" 목록에서 고르기'],
];

// 저장 코드 내보내기/불러오기, 지금 사건 처음부터
function saveSection(app) {
  const section = el('section', { class: 'settings-group', 'aria-labelledby': 'save-title' });

  function draw() {
    const { game } = app.store.get();
    const noGame = game ? '' : '아직 펼친 사건부가 없다.';

    const exportBox = el('div', { class: 'field' });
    const exportBtn = button({
      label: '저장 코드 만들기',
      disabledReason: noGame,
      onClick: () => {
        const outId = nextId('code');
        const out = el('textarea', { class: 'code-box', id: outId, readonly: true, rows: '4' });
        out.value = encodeGame(app.store.get().game);
        const copy = button({
          label: '코드 복사',
          onClick: async () => {
            try {
              await navigator.clipboard.writeText(out.value);
              announce('저장 코드를 복사했습니다.');
            } catch {
              out.select();
              announce('복사가 막혀 있어 코드를 선택해 두었습니다. 직접 복사해 주세요.');
            }
          },
        });
        fill(exportBox, el('label', { for: outId }, '저장 코드'), out, el('div', { class: 'actions' }, copy));
        out.focus();
        out.select();
      },
    });

    const inId = nextId('import');
    const input = el('textarea', { class: 'code-box', id: inId, rows: '4', spellcheck: 'false', autocomplete: 'off' });
    const importMsg = el('div');
    const importBtn = button({
      label: '불러오기',
      onClick: async () => {
        const result = decodeGame(input.value);
        if (!result.ok) {
          fill(importMsg, el('p', { class: 'field-error', role: 'alert' }, `불러오지 못했습니다. ${result.reason}`));
          input.setAttribute('aria-invalid', 'true');
          return;
        }
        if (app.store.get().game) {
          const ok = await confirmDialog({
            title: '지금 사건부를 덮어쓸까요?',
            body: ['지금까지 적은 사건부 대신 코드 속 기록을 펼칩니다. 지금 기록은 되돌릴 수 없습니다.'],
            confirmLabel: '덮어쓰기',
            destructive: true,
          });
          if (!ok) return;
        }
        app.store.set({ game: result.game, hasSave: true, saveStatus: 'ok' });
        announce('사건부를 불러왔습니다.');
        draw();
        // 다시 그리면 누른 버튼이 사라지므로 이 묶음의 제목으로 포커스를 옮긴다
        section.querySelector('#save-title').focus();
      },
    });

    const restartBtn = button({
      label: '이 사건 처음부터',
      variant: 'destructive',
      disabledReason: noGame,
      onClick: async (event) => {
        const btn = event.currentTarget;
        const ok = await confirmDialog({
          title: '이 사건을 처음부터 다시 할까요?',
          body: ['사건을 처음 펼친 때로 돌아갑니다. 이 사건에서 적은 단서는 지워지고, 다른 사건 기록은 남습니다.'],
          confirmLabel: '처음부터',
          destructive: true,
        });
        if (!ok) return;
        const { game } = app.store.get();
        setBusy(btn, true, '되돌리는 중');
        let data;
        try { data = await app.loadCase(game.current); } finally { setBusy(btn, false); }
        app.store.set({ game: restartCase(game, data) });
        announce('사건을 처음 펼친 때로 돌렸습니다.');
      },
    });

    fill(section,
      el('h2', { id: 'save-title', tabindex: '-1' }, '저장'),
      el('p', { class: 'field-help' }, '진행은 행동할 때마다 이 브라우저에 저장됩니다. 다른 기기나 브라우저로 옮기려면 저장 코드를 쓰세요.'),
      el('div', { class: 'actions' }, exportBtn),
      exportBox,
      el('div', { class: 'field' },
        el('label', { for: inId }, '저장 코드 붙여 넣기'),
        input,
        importMsg,
        el('div', { class: 'actions' }, importBtn)),
      el('div', { class: 'actions' }, restartBtn));
  }

  draw();
  return section;
}

export function settingsScreen(app) {
  return ({ root }) => {
    let draft = { ...app.store.get().settings };
    const heading = el('h1', { tabindex: '-1' }, '설정');
    const autosave = el('p', { class: 'field-help' }, '고르면 바로 바뀌고 저장된다.');
    const status = el('div', { 'aria-live': 'polite' });
    const groups = el('div', { class: 'settings-group' });

    function drawGroups() {
      fill(groups, ...GROUPS.map(({ key, legend, help }) => radioGroup({
        name: `setting-${key}`,
        legend,
        help,
        options: SETTING_OPTIONS[key],
        value: draft[key],
        onChange: (value) => {
          draft = { ...draft, [key]: value };
          save();
          // 소리를 켜면 한 번 들려준다(어떤 소리인지, 크기는 어떤지)
          if (key === 'sound' && value === 'on') play('note', { force: true });
        },
      })));
    }

    function save() {
      app.store.set({ settings: draft });
      applySettings(draft);
      const result = saveSettings(draft);
      if (result.ok) {
        app.store.set({ settingsSaved: true });
        fill(status);
      } else {
        fill(status, notice({
          kind: 'error',
          icon: '!',
          title: '설정을 저장하지 못했습니다.',
          body: ['이번 창에서는 적용되지만, 브라우저가 저장을 막고 있어 다음에 열면 기본값으로 돌아갑니다.'],
        }));
        alertNow('설정을 저장하지 못했습니다.');
      }
    }

    drawGroups();
    const back = app.store.get().returnTo || 'title';
    add(root, el('form', { class: 'settings', onsubmit: (event) => event.preventDefault() },
      heading,
      autosave,
      groups,
      saveSection(app),
      el('section', { 'aria-labelledby': 'keys-title' },
        el('h2', { id: 'keys-title' }, '조작'),
        el('dl', { class: 'keys' }, ...KEYS.flatMap(([k, d]) => [el('dt', {}, k), el('dd', {}, d)]))),
      status,
      el('div', { class: 'settings-foot actions' },
        linkButton({ label: '돌아가기', href: `#/${back}`, variant: 'primary' }),
        button({
          label: '기본값으로',
          variant: 'ghost',
          onClick: () => {
            draft = { ...DEFAULT_SETTINGS };
            save();
            drawGroups();
            announce('기본값으로 바꿨습니다.', { visible: false });
          },
        }))));

    return {
      focus: heading,
      title: '설정',
      chrome: 'none',
    };
  };
}
