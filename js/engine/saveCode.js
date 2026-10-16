// 저장 형식 검사와 내보내기/불러오기 코드. DOM·localStorage 없이 돌아간다.
// 코드 모양: "MJ1-" + base64url(UTF-8 JSON)

import { SAVE_VERSION } from '../state.js';

const PREFIX = `MJ${SAVE_VERSION}-`;
const LOG_KINDS = ['scene', 'look', 'clue', 'solve', 'han'];

const isStr = (v) => typeof v === 'string' && v.length > 0 && v.length < 200;
const strArray = (v) => Array.isArray(v) && v.every(isStr);
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function validCaseState(st) {
  return isObj(st)
    && isStr(st.sceneId)
    && strArray(st.have)
    && isObj(st.found) && Object.entries(st.found).every(([k, v]) => isStr(k) && isStr(v))
    && Array.isArray(st.log) && st.log.every((e) => isObj(e) && LOG_KINDS.includes(e.k) && isStr(e.id))
    && Number.isInteger(st.unread) && st.unread >= 0
    // 나중에 생긴 필드는 있으면 검사한다
    && (st.notes === undefined || (isObj(st.notes) && Object.values(st.notes).every((n) => Number.isInteger(n) && n >= 0)))
    && (st.solved === undefined || typeof st.solved === 'boolean')
    && (st.heard === undefined || strArray(st.heard))
    && (st.skipped === undefined || strArray(st.skipped))
    && (st.unease === undefined || (typeof st.unease === 'number' && st.unease >= 0 && st.unease <= 1));
}

// 'ok' | 'old'(다른 버전) | 'broken'
export function checkGame(raw) {
  if (!isObj(raw)) return 'broken';
  if (raw.v !== SAVE_VERSION) return Number.isInteger(raw.v) ? 'old' : 'broken';
  const ok = isStr(raw.current)
    && isObj(raw.cases) && Object.values(raw.cases).every(validCaseState)
    && isObj(raw.checkpoints) && Object.values(raw.checkpoints).every(validCaseState)
    && strArray(raw.fragments)
    && (raw.player === undefined || (typeof raw.player === 'string' && raw.player.length <= 12))
    && (raw.ending === undefined || ['', 'truth', 'partial', 'cover'].includes(raw.ending));
  return ok ? 'ok' : 'broken';
}

export function encodeGame(game) {
  const bytes = new TextEncoder().encode(JSON.stringify(game));
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return PREFIX + btoa(bin).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

// { ok: true, game } | { ok: false, reason }
export function decodeGame(code) {
  const text = String(code ?? '').replace(/\s+/g, '');
  if (!text) return { ok: false, reason: '코드가 비어 있습니다.' };
  if (!text.startsWith('MJ')) return { ok: false, reason: '무진 사건부의 저장 코드가 아닙니다.' };
  if (!text.startsWith(PREFIX)) return { ok: false, reason: '다른 버전에서 만든 코드라 읽을 수 없습니다.' };
  let game;
  try {
    const b64 = text.slice(PREFIX.length).replaceAll('-', '+').replaceAll('_', '/');
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
    game = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return { ok: false, reason: '코드 일부가 빠졌거나 바뀌었습니다. 처음부터 끝까지 다시 붙여 넣어 주세요.' };
  }
  if (checkGame(game) !== 'ok') return { ok: false, reason: '코드 안의 기록이 온전하지 않습니다.' };
  return { ok: true, game };
}
