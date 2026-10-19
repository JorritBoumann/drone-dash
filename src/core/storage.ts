/**
 * Round 41 (Codex audit item 2): every saved setting goes through here. `localStorage` can throw on access (a sandboxed
 * iframe on another origin, private modes, blocked site data, a full quota). Each read and write is guarded, and a
 * page-lifetime in-memory copy keeps the value for this page when the browser refuses to store it.
 */
const memory = new Map<string, string>();

function backend(): Storage | null {
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

export function storeGet(key: string): string | null {
  try {
    const s = backend();
    const v = s ? s.getItem(key) : null;
    if (v !== null) return v;
  } catch {
    /* fall through to the in-memory copy */
  }
  return memory.has(key) ? memory.get(key)! : null;
}

export function storeSet(key: string, value: string): void {
  memory.set(key, value);
  try {
    backend()?.setItem(key, value);
  } catch {
    /* kept in memory for this page */
  }
}
