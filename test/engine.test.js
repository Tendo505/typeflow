import { test, describe } from "node:test";
import assert from "node:assert/strict";
import * as engine from "../src/engine.js";

function typeString(t, s) {
  for (const ch of s) {
    if (ch === " ") engine.submitWord(t);
    else engine.typeChar(t, ch);
  }
}

describe("typing", () => {
  test("correct letters are tracked per word", () => {
    const t = engine.createTest(["hello", "world"]);
    typeString(t, "hello wor");
    assert.deepEqual(t.typed, ["hello", "wor"]);
    assert.equal(engine.currentIndex(t), 1);
  });

  test("space on an empty word is ignored", () => {
    const t = engine.createTest(["a", "b"]);
    assert.equal(engine.submitWord(t), false);
    assert.equal(t.keystrokes, 0);
  });

  test("extra letters are capped", () => {
    const t = engine.createTest(["hi"]);
    for (let i = 0; i < 50; i++) engine.typeChar(t, "x");
    assert.equal(t.typed[0].length, 2 + engine.MAX_EXTRA_LETTERS);
  });

  test("space is never inserted as a letter", () => {
    const t = engine.createTest(["hi"]);
    assert.equal(engine.typeChar(t, " "), false);
  });
});

describe("backspace", () => {
  test("removes the last character", () => {
    const t = engine.createTest(["cat"]);
    typeString(t, "ca");
    engine.backspace(t);
    assert.equal(t.typed[0], "c");
  });

  test("can step back into a mistyped word", () => {
    const t = engine.createTest(["cat", "dog"]);
    typeString(t, "cot ");
    assert.equal(engine.backspace(t), true);
    assert.equal(engine.currentIndex(t), 0);
  });

  test("cannot step back into a correct word", () => {
    const t = engine.createTest(["cat", "dog"]);
    typeString(t, "cat ");
    assert.equal(engine.backspace(t), false);
    assert.equal(engine.currentIndex(t), 1);
  });

  test("deleteWord clears the current word", () => {
    const t = engine.createTest(["cat", "dog"]);
    typeString(t, "cat do");
    engine.deleteWord(t);
    assert.deepEqual(t.typed, ["cat", ""]);
  });

  test("deleteWord on an empty word clears the previous mistyped word", () => {
    const t = engine.createTest(["cat", "dog"]);
    typeString(t, "cxt ");
    engine.deleteWord(t);
    assert.deepEqual(t.typed, [""]);
  });
});

describe("scoring", () => {
  test("correct chars count completed words plus spaces", () => {
    const t = engine.createTest(["abcd", "efgh", "ijkl"]);
    typeString(t, "abcd efgh ");
    assert.equal(engine.correctChars(t), 10);
  });

  test("mistyped words contribute nothing", () => {
    const t = engine.createTest(["abcd", "efgh"]);
    typeString(t, "abcx efgh");
    assert.equal(engine.correctChars(t), 4);
  });

  test("in-progress word counts only while it is a correct prefix", () => {
    const t = engine.createTest(["hello"]);
    typeString(t, "hel");
    assert.equal(engine.correctChars(t), 3);
    typeString(t, "x");
    assert.equal(engine.correctChars(t), 0);
  });

  test("wpm uses 5 characters per word", () => {
    assert.equal(engine.wpm(50, 60), 10);
    assert.equal(engine.wpm(25, 15), 20);
    assert.equal(engine.wpm(10, 0), 0);
  });

  test("results compute wpm, raw and accuracy", () => {
    const t = engine.createTest(["abcd", "abcd", "abcd"]);
    typeString(t, "abcd abxd ");
    const r = engine.results(t, 60);
    // 10 keystrokes; correct: a,b,c,d,space,a,b,d = 8 (the 'x' and the space after the wrong word miss)
    assert.equal(t.keystrokes, 10);
    assert.equal(r.accuracy, 80);
    assert.equal(r.wpm, 1); // 5 correct chars / 5 / 1 min
    assert.equal(r.raw, 2);
    assert.equal(r.wordsCorrect, 1);
    assert.equal(r.wordsIncorrect, 1);
  });

  test("timeline produces a per-second chart", () => {
    const t = engine.createTest(["abcd", "abcd", "abcd"]);
    typeString(t, "abcd ");
    engine.recordSecond(t);
    typeString(t, "abcd ");
    engine.recordSecond(t);
    const r = engine.results(t, 2);
    assert.equal(r.chart.length, 2);
    assert.deepEqual(r.chart.map((p) => p.raw), [60, 60]);
    assert.equal(r.consistency, 100);
  });
});

describe("consistency", () => {
  test("is 100 for perfectly steady speed", () => {
    assert.equal(engine.consistency([60, 60, 60]), 100);
  });

  test("drops as speed varies", () => {
    const steady = engine.consistency([58, 60, 62]);
    const erratic = engine.consistency([20, 100, 40]);
    assert.ok(steady > erratic);
  });

  test("never goes negative", () => {
    assert.equal(engine.consistency([0, 0, 0, 300]), 0);
  });
});

describe("render helpers", () => {
  test("letterStates marks correct, incorrect, pending and extra", () => {
    const states = engine.letterStates("cat", "cxtss").map((l) => l.state);
    assert.deepEqual(states, ["correct", "incorrect", "correct", "extra", "extra"]);
    assert.deepEqual(engine.letterStates("cat", "c").map((l) => l.state), ["correct", "pending", "pending"]);
  });

  test("wordStatus reflects position and correctness", () => {
    const t = engine.createTest(["a", "b", "c", "d"]);
    typeString(t, "a x ");
    assert.equal(engine.wordStatus(t, 0), "correct");
    assert.equal(engine.wordStatus(t, 1), "incorrect");
    assert.equal(engine.wordStatus(t, 2), "current");
    assert.equal(engine.wordStatus(t, 3), "pending");
  });
});
