// 알림 줄. 사건부에 한 줄이 더해지는 표시와 짧은 지문(눈으로 보는 줄과 읽히는 줄).
// 눈으로 보는 줄(#toasts)과 스크린리더가 읽는 줄(#announcer)을 따로 둔다.

import { el, add } from './dom.js';

const KEEP = 3;
const SHOW_MS = 4500;

// speak: false면 눈으로만 보인다(포커스가 옮겨 간 글이 이미 같은 내용을 읽을 때).
export function announce(text, { visible = true, speak = true } = {}) {
  if (speak) {
    const live = document.getElementById('announcer');
    add(live, el('p', {}, text));
    while (live.childElementCount > KEEP) live.firstElementChild.remove();
  }

  if (!visible) return;
  const box = document.getElementById('toasts');
  const toast = el('p', { class: 'toast' }, text);
  add(box, toast);
  while (box.childElementCount > KEEP) box.firstElementChild.remove();
  setTimeout(() => {
    toast.dataset.leaving = 'true';
    setTimeout(() => toast.remove(), 600);
  }, SHOW_MS);
}

// 저장 실패 같은 시스템 알림. 바로 읽힌다.
export function alertNow(text) {
  const box = document.getElementById('alerter');
  box.textContent = '';
  requestAnimationFrame(() => { box.textContent = text; });
}
