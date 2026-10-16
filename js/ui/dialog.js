// 모달은 정말 필요할 때만(저장 삭제 확인, 엔딩 선택).
// <dialog>의 showModal이 포커스 가두기와 ESC 닫기를 맡는다. 닫히면 열기 전 위치로 포커스를 돌린다.

import { el, button, add } from './dom.js';

// 선택지 모달(엔딩 선택). 고른 id, ESC로 닫으면 null.
export function choiceDialog({ title, body = [], choices }) {
  return new Promise((resolve) => {
    const opener = document.activeElement;
    const titleId = `dialog-title-${Date.now()}`;
    const dialog = el('dialog', { class: 'dialog', 'aria-labelledby': titleId });
    const buttons = choices.map((c) => button({
      label: c.label,
      variant: c.variant ?? '',
      onClick: () => dialog.close(c.id),
    }));
    add(dialog,
      el('h2', { id: titleId }, title),
      ...body.map((b) => el('p', {}, b)),
      el('div', { class: 'actions actions--stack' }, ...buttons));
    dialog.addEventListener('close', () => {
      const id = dialog.returnValue;
      dialog.remove();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
      resolve(choices.some((c) => c.id === id) ? id : null);
    });
    add(document.body, dialog);
    dialog.showModal();
    dialog.querySelector('h2').setAttribute('tabindex', '-1');
    dialog.querySelector('h2').focus();
  });
}

export function confirmDialog({ title, body = [], confirmLabel, cancelLabel = '그만두기', destructive = false }) {
  return new Promise((resolve) => {
    const opener = document.activeElement;
    const titleId = `dialog-title-${Date.now()}`;
    const dialog = el('dialog', { class: 'dialog', 'aria-labelledby': titleId });
    const cancel = button({ label: cancelLabel, onClick: () => dialog.close('cancel') });
    const confirm = button({
      label: confirmLabel,
      variant: destructive ? 'destructive' : 'primary',
      onClick: () => dialog.close('confirm'),
    });
    add(dialog,
      el('h2', { id: titleId }, title),
      ...body.map((b) => el('p', {}, b)),
      el('div', { class: 'actions' }, cancel, confirm),
    );
    dialog.addEventListener('close', () => {
      const ok = dialog.returnValue === 'confirm';
      dialog.remove();
      if (opener instanceof HTMLElement) opener.focus();
      resolve(ok);
    });
    add(document.body, dialog);
    dialog.showModal();
    // 되돌릴 수 없는 동작이면 취소 쪽에 먼저 포커스
    (destructive ? cancel : confirm).focus();
  });
}
