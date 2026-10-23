// Persists past results in localStorage. Storage can be unavailable (private
// mode, blocked cookies), so every access is guarded and falls back to memory.

const KEY = "typeflow:history:v1";
const LIMIT = 200;

export function createHistory(storage = safeStorage()) {
  let memory = [];

  function load() {
    try {
      const parsed = JSON.parse(storage?.getItem(KEY) ?? "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return memory;
    }
  }

  function save(list) {
    memory = list;
    try { storage?.setItem(KEY, JSON.stringify(list)); } catch { /* keep in memory */ }
  }

  return {
    all: load,
    add(entry) {
      const list = [...load(), { ...entry, date: entry.date ?? new Date().toISOString() }].slice(-LIMIT);
      save(list);
      return list;
    },
    best(duration) {
      return load()
        .filter((r) => r.duration === duration)
        .reduce((max, r) => Math.max(max, r.wpm), 0);
    },
    clear() { save([]); },
  };
}

function safeStorage() {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}
