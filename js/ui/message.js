// 메시지 창: 살펴본 글을 화면 아래 창에 띄우고, 닫으면 사라진다(글 흐름에 쌓아 스크롤을 밀지 않는다).
// 지난 글은 사건부 "기록" 탭에 모두 남는다. 닫기: 버튼, Enter·Space, ESC, 창 바깥 누르기.
// 닫히면 restore()로 포커스를 돌린다(뒤 화면을 다시 그려서 열 때 누른 요소는 이미 없을 수 있다).

import { el, button, lines, nextId, add } from './dom.js';

// label: 고른 행동이나 말하는 사람. text: 지문 줄. gained: 사건부에 적은 단서 이름.
// opened: 새로 열린 곳·사람 줄. extra: 창 안에 둘 입력 칸 같은 노드.
export function showMessage({ label, speaker = false, text = [], gained = [], opened = [], extra = null, restore }) {
  const labelId = nextId('msg-label');
  const bodyId = nextId('msg-body');
  const dialog = el('dialog', { class: 'message', 'aria-labelledby': labelId, 'aria-describedby': bodyId });
  const close = button({ label: '닫기', variant: 'primary', onClick: () => dialog.close() });
  add(dialog,
    el('p', { class: speaker ? 'message-speaker' : 'message-label', id: labelId }, label),
    el('div', { class: 'message-body', id: bodyId },
      ...lines(text),
      gained.length ? el('ul', { class: 'message-gains', role: 'list' }, ...gained.map((name) => el('li', { class: 'log-note' },
        el('span', { class: 'log-note-tag' }, '사건부에 적었다'), name))) : null,
      ...opened.map((t) => el('p', { class: 'message-open' }, t))),
    extra,
    el('div', { class: 'message-actions' }, close));

  dialog.addEventListener('click', (event) => {
    // 창 바깥(배경)을 누르면 닫는다
    if (event.target === dialog) {
      const r = dialog.getBoundingClientRect();
      const inside = event.clientX >= r.left && event.clientX <= r.right && event.clientY >= r.top && event.clientY <= r.bottom;
      if (!inside) dialog.close();
    }
  });
  dialog.addEventListener('keydown', (event) => {
    // 글을 읽다가 Enter·Space로 넘긴다. 입력 칸과 버튼은 제 동작을 그대로 한다.
    if ((event.key === 'Enter' || event.key === ' ') && !event.target.closest('input, button, a, textarea, select')) {
      event.preventDefault();
      dialog.close();
    }
  });
  dialog.addEventListener('close', () => {
    dialog.remove();
    restore?.();
  });
  add(document.body, dialog);
  dialog.showModal();
  close.focus();
  return dialog;
}
