// 게임 저장(localStorage). 형식 검사는 engine/saveCode.js가 맡는다.

import { storage } from './store.js';
import { SAVE_KEY } from './state.js';
import { checkGame } from './engine/saveCode.js';

// { status: 'none' | 'ok' | 'old' | 'broken' | 'blocked', game }
export function loadGame() {
  const result = storage.read(SAVE_KEY);
  if (!result.ok) return { status: result.error instanceof SyntaxError ? 'broken' : 'blocked', game: null };
  if (result.value == null) return { status: 'none', game: null };
  const status = checkGame(result.value);
  return { status, game: status === 'ok' ? result.value : null };
}

export function saveGame(game) {
  return storage.write(SAVE_KEY, game);
}

export function clearGame() {
  return storage.remove(SAVE_KEY);
}
