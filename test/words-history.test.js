import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { generateWords, COMMON_WORDS } from "../src/words.js";
import { createHistory } from "../src/history.js";

// Small deterministic PRNG (mulberry32) so word generation is reproducible.
function seeded(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
  };
}

describe("generateWords", () => {
  test("returns the requested number of dictionary words", () => {
    const words = generateWords(50, { random: seeded(1) });
    assert.equal(words.length, 50);
    assert.ok(words.every((w) => COMMON_WORDS.includes(w)));
  });

  test("is deterministic for a given random source", () => {
    assert.deepEqual(generateWords(20, { random: seeded(42) }), generateWords(20, { random: seeded(42) }));
  });

  test("punctuation mode capitalises the first word and adds punctuation", () => {
    const words = generateWords(300, { punctuation: true, random: seeded(7) });
    assert.match(words[0], /^[A-Z]/);
    assert.ok(words.some((w) => /[,.?!;:]$/.test(w)));
  });

  test("numbers mode includes numeric words", () => {
    const words = generateWords(300, { numbers: true, random: seeded(3) });
    assert.ok(words.some((w) => /^\d+$/.test(w)));
  });
});

describe("history", () => {
  test("stores results and reports personal best per duration", () => {
    const h = createHistory(memoryStorage());
    h.add({ wpm: 50, duration: 30 });
    h.add({ wpm: 72, duration: 30 });
    h.add({ wpm: 90, duration: 15 });
    assert.equal(h.all().length, 3);
    assert.equal(h.best(30), 72);
    assert.equal(h.best(15), 90);
    assert.equal(h.best(60), 0);
  });

  test("survives corrupt storage", () => {
    const storage = memoryStorage();
    storage.setItem("typeflow:history:v1", "{not json");
    const h = createHistory(storage);
    assert.deepEqual(h.all(), []);
  });

  test("works with no storage at all", () => {
    const h = createHistory(null);
    h.add({ wpm: 40, duration: 30 });
    assert.equal(h.best(30), 0); // nothing persisted, nothing thrown
  });

  test("clear removes everything", () => {
    const h = createHistory(memoryStorage());
    h.add({ wpm: 50, duration: 30 });
    h.clear();
    assert.deepEqual(h.all(), []);
  });
});
