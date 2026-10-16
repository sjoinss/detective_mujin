// 상태 하나와 구독. UI는 상태를 받아 그리기만 한다.

export function createStore(initial) {
  let state = initial;
  const listeners = new Set();
  return {
    get: () => state,
    set(update) {
      const next = typeof update === 'function' ? update(state) : { ...state, ...update };
      if (next === state) return;
      const prev = state;
      state = next;
      for (const fn of listeners) fn(state, prev);
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

// localStorage. 시크릿 창이나 사이트 데이터 차단에서는 접근만 해도 예외가 나므로 전부 감싼다.
export const storage = {
  available() {
    try {
      const key = '__mujin_probe';
      localStorage.setItem(key, '1');
      localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  },
  read(key) {
    try {
      const raw = localStorage.getItem(key);
      return { ok: true, value: raw == null ? null : JSON.parse(raw) };
    } catch (error) {
      return { ok: false, error };
    }
  },
  write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return { ok: true };
    } catch (error) {
      return { ok: false, error };
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(key);
      return { ok: true };
    } catch (error) {
      return { ok: false, error };
    }
  },
};
