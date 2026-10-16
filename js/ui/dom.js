// DOM 만들기. 문자열은 언제나 텍스트 노드로 들어간다. innerHTML은 쓰지 않는다.

let uid = 0;
export const nextId = (prefix = 'id') => `${prefix}-${++uid}`;

// el('p', { class: 'x', onclick: fn }, '글', child)
// props: class, dataset, text, on*(이벤트), 그 밖은 속성. false/null은 건너뛴다.
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === false || value == null) continue;
    if (key === 'class') node.className = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  node.append(...children.flat(Infinity).filter((c) => c != null && c !== false));
  return node;
}

// replaceChildren/append는 배열을 펼치지 않고 null을 "null" 글자로 넣는다. 그래서 늘 이것을 쓴다.
const clean = (children) => children.flat(Infinity).filter((c) => c != null && c !== false);
export function fill(node, ...children) {
  node.replaceChildren(...clean(children));
  return node;
}
export function add(node, ...children) {
  node.append(...clean(children));
  return node;
}

// 버튼. disabledReason이 있으면 누를 수 없고, 이유가 화면과 스크린리더에 함께 나온다.
export function button({ label, variant = '', onClick, disabledReason = '', type = 'button', ...rest }) {
  const reasonId = disabledReason ? nextId('reason') : null;
  const btn = el('button', {
    type,
    class: ['btn', variant && `btn--${variant}`].filter(Boolean).join(' '),
    'aria-disabled': disabledReason ? 'true' : null,
    'aria-describedby': reasonId,
    ...rest,
  }, label);
  btn.addEventListener('click', (event) => {
    if (btn.getAttribute('aria-disabled') === 'true' || btn.getAttribute('aria-busy') === 'true') {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  });
  if (!disabledReason) return btn;
  return el('div', {}, btn, el('span', { class: 'btn-reason', id: reasonId }, disabledReason));
}

// 이동은 a. 모양만 버튼.
export function linkButton({ label, href, variant = '' }) {
  return el('a', { href, class: ['btn', variant && `btn--${variant}`].filter(Boolean).join(' ') }, label);
}

export function setBusy(btn, busy, busyLabel) {
  if (busy) {
    btn.dataset.label = btn.textContent;
    btn.setAttribute('aria-busy', 'true');
    if (busyLabel) btn.textContent = busyLabel;
  } else {
    btn.removeAttribute('aria-busy');
    if (btn.dataset.label) btn.textContent = btn.dataset.label;
  }
}

// 지문 여러 줄. 빈 문자열은 한 줄 띄움(결정타 앞).
export function lines(texts, className = 'log-line') {
  return (texts ?? []).map((t) => (t === '' ? el('div', { class: 'log-gap', 'aria-hidden': 'true' }) : el('p', { class: className }, t)));
}

// 서진우 메모
export function memo(text) {
  return el('p', { class: 'memo' }, el('span', { class: 'memo-tag' }, '메모'), text);
}

export function notice({ kind = 'info', icon = '·', title, body = [], actions = [] }) {
  return el('div', { class: `notice notice--${kind}` },
    el('span', { class: 'notice-icon', 'aria-hidden': 'true' }, icon),
    title && el('p', { class: 'notice-title' }, el('strong', {}, title)),
    ...body.map((b) => el('p', {}, b)),
    actions.length ? el('div', { class: 'actions' }, ...actions) : null);
}
