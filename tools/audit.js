// 접근성·배치 점검(브라우저 안에서 돈다). 화면 하나를 받아 문제 목록을 돌려준다.
//   const { audit } = await import('/tools/audit.js'); audit(document)
// 기획서 2.10·9.2·11장: 이름 없는 조작 요소, 44px 미만 터치 대상, 제목 계층, 중복 id,
// 본문 대비(AA), 가로 스크롤, 랜드마크, 언어.

const TOUCH = 44;

function visible(el) {
  if (!el.isConnected) return false;
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return false;
  const cs = el.ownerDocument.defaultView.getComputedStyle(el);
  return cs.visibility !== 'hidden' && cs.display !== 'none' && !el.closest('[hidden],[aria-hidden="true"],.visually-hidden');
}

function nameOf(el, doc) {
  const by = el.getAttribute('aria-labelledby');
  if (by) return by.split(/\s+/).map((id) => doc.getElementById(id)?.textContent ?? '').join(' ').trim();
  if (el.getAttribute('aria-label')) return el.getAttribute('aria-label').trim();
  if (el.id) {
    const label = doc.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    if (label) return label.textContent.trim();
  }
  const wrap = el.closest('label');
  if (wrap) return wrap.textContent.trim();
  return el.textContent.trim();
}

function lum(rgb) {
  const [r, g, b] = rgb.map((v) => v / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const parse = (c) => (c.match(/[\d.]+/g) ?? []).map(Number);
function background(el, win) {
  for (let n = el; n; n = n.parentElement) {
    const c = parse(win.getComputedStyle(n).backgroundColor);
    if (c.length >= 3 && (c[3] === undefined || c[3] > 0.5)) return c.slice(0, 3);
  }
  return parse(win.getComputedStyle(el.ownerDocument.body).backgroundColor).slice(0, 3);
}

export function audit(doc = document) {
  const win = doc.defaultView;
  const problems = [];
  const say = (kind, el, msg) => problems.push({ kind, msg, at: el ? (el.id ? `#${el.id}` : `${el.tagName.toLowerCase()}.${el.className}`).slice(0, 60) : '' });

  if (doc.documentElement.lang !== 'ko') say('lang', null, 'html lang이 ko가 아니다');
  if (!doc.querySelector('main')) say('landmark', null, 'main이 없다');
  if (doc.documentElement.scrollWidth > doc.documentElement.clientWidth) {
    say('overflow', null, `가로 스크롤 ${doc.documentElement.scrollWidth - doc.documentElement.clientWidth}px`);
  }

  const ids = new Map();
  for (const el of doc.querySelectorAll('[id]')) ids.set(el.id, (ids.get(el.id) ?? 0) + 1);
  for (const [id, n] of ids) if (n > 1) say('id', null, `id '${id}'가 ${n}번`);

  // 제목: 보이는 h1 하나, 단계 건너뛰지 않기
  const heads = [...doc.querySelectorAll('h1,h2,h3,h4')].filter((h) => !h.closest('[hidden]') && (visible(h) || h.classList.contains('visually-hidden')));
  const h1s = heads.filter((h) => h.tagName === 'H1');
  if (h1s.length !== 1) say('heading', null, `h1이 ${h1s.length}개`);
  let last = 0;
  for (const h of heads) {
    const level = Number(h.tagName[1]);
    if (last && level > last + 1) say('heading', h, `h${last} 다음에 h${level}: "${h.textContent.trim().slice(0, 20)}"`);
    last = level;
  }

  // 조작 요소: 이름과 크기
  const controls = [...doc.querySelectorAll('button, a[href], input, select, textarea, [role="tab"], summary')].filter(visible);
  for (const el of controls) {
    if (el.type === 'hidden') continue;
    if (!nameOf(el, doc)) say('name', el, '이름 없는 조작 요소');
    // 글 속 링크와, 44px 이상인 label로 감싼 라디오·체크박스는 예외(WCAG 2.5.8)
    if (el.tagName === 'A' && !el.className && el.closest('p')) continue;
    if ((el.type === 'radio' || el.type === 'checkbox') && el.closest('label')?.getBoundingClientRect().height >= TOUCH) continue;
    if (el.classList.contains('hotspot')) continue; // 같은 기능의 목록이 있다
    const r = el.getBoundingClientRect();
    if (r.height < TOUCH - 0.5 || r.width < TOUCH - 0.5) say('target', el, `터치 대상 ${Math.round(r.width)}×${Math.round(r.height)} "${nameOf(el, doc).slice(0, 16)}"`);
  }

  // 대비: 글자가 직접 있는 요소
  const seen = new Set();
  for (const el of doc.querySelectorAll('body *')) {
    if (!visible(el) || seen.size > 1500) continue;
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!own) continue;
    seen.add(el);
    const cs = win.getComputedStyle(el);
    const fg = parse(cs.color);
    if (fg[3] !== undefined && fg[3] < 1) continue;
    const bg = background(el, win);
    const [a, b] = [lum(fg), lum(bg)];
    const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    const size = parseFloat(cs.fontSize);
    const large = size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700);
    const opacity = Number(cs.opacity);
    const need = large ? 3 : 4.5;
    // 비활성 요소는 대비 기준에서 빠진다(WCAG 1.4.3 예외)
    if (el.closest('[aria-disabled="true"],:disabled')) continue;
    if (ratio < need || opacity < 0.9) {
      say('contrast', el, `대비 ${ratio.toFixed(2)}${opacity < 0.9 ? `, 투명도 ${opacity}` : ''} "${el.textContent.trim().slice(0, 16)}"`);
    }
  }
  return problems;
}
