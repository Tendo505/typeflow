// Pure typing-test engine. No DOM access, so it can be unit tested in Node.
//
// A test is a list of target words plus what the user has typed for each word.
// Scoring follows the common convention: 1 "word" = 5 characters, and only
// characters in correctly typed words (plus the spaces after them) count toward WPM.

export const CHARS_PER_WORD = 5;
export const MAX_EXTRA_LETTERS = 10;

export function createTest(words) {
  return {
    words: [...words],
    typed: [""],
    keystrokes: 0,
    correctKeystrokes: 0,
    // Keystrokes per elapsed second, used for the chart and consistency score.
    timeline: [],
  };
}

export function currentIndex(test) {
  return test.typed.length - 1;
}

/** Type a single printable character. Returns false if the input was ignored. */
export function typeChar(test, ch) {
  const i = currentIndex(test);
  const typed = test.typed[i];
  const word = test.words[i];
  if (ch.length !== 1 || ch === " ") return false;
  if (typed.length >= word.length + MAX_EXTRA_LETTERS) return false;

  test.keystrokes++;
  if (word[typed.length] === ch) test.correctKeystrokes++;
  test.typed[i] = typed + ch;
  return true;
}

/** Commit the current word and move to the next. Ignored on an empty word. */
export function submitWord(test) {
  const i = currentIndex(test);
  const typed = test.typed[i];
  if (typed.length === 0) return false;

  test.keystrokes++;
  if (typed === test.words[i]) test.correctKeystrokes++;
  test.typed.push("");
  return true;
}

/**
 * Delete one character. At the start of a word, step back into the previous
 * word only if it was mistyped — correct words are locked in.
 */
export function backspace(test) {
  const i = currentIndex(test);
  if (test.typed[i].length > 0) {
    test.typed[i] = test.typed[i].slice(0, -1);
    return true;
  }
  if (i > 0 && test.typed[i - 1] !== test.words[i - 1]) {
    test.typed.pop();
    return true;
  }
  return false;
}

/** Delete the whole current word (Ctrl+Backspace). */
export function deleteWord(test) {
  const i = currentIndex(test);
  if (test.typed[i].length > 0) {
    test.typed[i] = "";
    return true;
  }
  return backspace(test) && deleteWord(test);
}

export function correctChars(test) {
  const last = currentIndex(test);
  let chars = 0;
  test.typed.forEach((typed, i) => {
    const word = test.words[i];
    if (i < last) {
      if (typed === word) chars += typed.length + 1; // include the space
    } else if (word.startsWith(typed)) {
      chars += typed.length; // in-progress word counts if correct so far
    }
  });
  return chars;
}

/** Word state for rendering: "correct" | "incorrect" | "current" | "pending". */
export function wordStatus(test, i) {
  const last = currentIndex(test);
  if (i > last) return "pending";
  if (i === last) return "current";
  return test.typed[i] === test.words[i] ? "correct" : "incorrect";
}

/** Per-letter state for rendering, including overflow ("extra") letters. */
export function letterStates(word, typed) {
  const out = [];
  const len = Math.max(word.length, typed.length);
  for (let j = 0; j < len; j++) {
    if (j >= word.length) out.push({ ch: typed[j], state: "extra" });
    else if (j >= typed.length) out.push({ ch: word[j], state: "pending" });
    else out.push({ ch: word[j], state: typed[j] === word[j] ? "correct" : "incorrect" });
  }
  return out;
}

export function wpm(chars, seconds) {
  if (seconds <= 0) return 0;
  return (chars / CHARS_PER_WORD) / (seconds / 60);
}

/** Record cumulative progress at the end of each elapsed second. */
export function recordSecond(test) {
  test.timeline.push({ keystrokes: test.keystrokes, correctChars: correctChars(test) });
}

/**
 * Consistency, 0–100: how steady the per-second raw speed was.
 * 100 means identical speed every second. Based on coefficient of variation.
 */
export function consistency(perSecondRaw) {
  if (perSecondRaw.length < 2) return 100;
  const mean = perSecondRaw.reduce((a, b) => a + b, 0) / perSecondRaw.length;
  if (mean === 0) return 0;
  const variance = perSecondRaw.reduce((a, b) => a + (b - mean) ** 2, 0) / perSecondRaw.length;
  const cv = Math.sqrt(variance) / mean;
  return Math.max(0, Math.round(100 * (1 - cv)));
}

export function results(test, seconds) {
  const perSecondRaw = test.timeline.map((s, i) => {
    const prev = i === 0 ? 0 : test.timeline[i - 1].keystrokes;
    return wpm(s.keystrokes - prev, 1);
  });
  const chart = test.timeline.map((s, i) => ({
    second: i + 1,
    wpm: Math.round(wpm(s.correctChars, i + 1)),
    raw: Math.round(perSecondRaw[i]),
  }));

  return {
    wpm: Math.round(wpm(correctChars(test), seconds)),
    raw: Math.round(wpm(test.keystrokes, seconds)),
    accuracy: test.keystrokes ? Math.round((test.correctKeystrokes / test.keystrokes) * 100) : 0,
    consistency: consistency(perSecondRaw),
    wordsCorrect: test.typed.filter((t, i) => i < currentIndex(test) && t === test.words[i]).length,
    wordsIncorrect: test.typed.filter((t, i) => i < currentIndex(test) && t !== test.words[i]).length,
    chart,
  };
}
