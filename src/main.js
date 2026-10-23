import * as engine from "./engine.js";
import { generateWords } from "./words.js";
import { createHistory } from "./history.js";
import { drawChart } from "./chart.js";

const $ = (sel) => document.querySelector(sel);
const wordsEl = $("#words");
const timerEl = $("#timer");
const liveWpmEl = $("#live-wpm");
const testView = $("#test-view");
const resultView = $("#result-view");
const chartEl = $("#chart");

const BATCH = 100;
const history = createHistory();
const settings = loadSettings();

let test;
let timer = { started: false, finished: false, startTime: 0, interval: null };

// ---------- lifecycle ----------

function newTest() {
  clearInterval(timer.interval);
  timer = { started: false, finished: false, startTime: 0, interval: null };
  test = engine.createTest(generateWords(BATCH, settings));
  timerEl.textContent = settings.duration;
  liveWpmEl.textContent = "";
  testView.hidden = false;
  resultView.hidden = true;
  document.body.classList.remove("typing");
  renderWords();
  wordsEl.focus();
}

function start() {
  timer.started = true;
  timer.startTime = performance.now();
  document.body.classList.add("typing");
  timer.interval = setInterval(tick, 50);
}

function elapsed() {
  return (performance.now() - timer.startTime) / 1000;
}

function tick() {
  const t = Math.min(elapsed(), settings.duration);
  while (test.timeline.length < Math.floor(t)) engine.recordSecond(test);
  timerEl.textContent = Math.ceil(settings.duration - t);
  if (t >= 1) liveWpmEl.textContent = `${Math.round(engine.wpm(engine.correctChars(test), t))} wpm`;
  if (t >= settings.duration) finish();
}

function finish() {
  clearInterval(timer.interval);
  timer.finished = true;
  document.body.classList.remove("typing");

  const r = engine.results(test, settings.duration);
  const previousBest = history.best(settings.duration);
  const mode = [settings.punctuation && "punctuation", settings.numbers && "numbers"].filter(Boolean);
  history.add({ wpm: r.wpm, raw: r.raw, accuracy: r.accuracy, consistency: r.consistency, duration: settings.duration, mode });

  $("#r-wpm").textContent = r.wpm;
  $("#r-acc").textContent = `${r.accuracy}%`;
  $("#r-raw").textContent = r.raw;
  $("#r-cons").textContent = `${r.consistency}%`;
  $("#r-words").textContent = `${r.wordsCorrect} / ${r.wordsIncorrect}`;
  $("#r-type").textContent = `${settings.duration}s${mode.length ? " · " + mode.join(" · ") : ""}`;
  $("#pb-badge").hidden = !(r.wpm > previousBest && r.wpm > 0);

  testView.hidden = true;
  resultView.hidden = false;
  drawChart(chartEl, r.chart, { maxX: settings.duration });
  lastChart = r.chart;
  renderHistory();
  $("#restart").focus();
}

// ---------- rendering ----------

function renderWords() {
  const current = engine.currentIndex(test);
  const frag = document.createDocumentFragment();

  test.words.forEach((word, i) => {
    const w = document.createElement("span");
    w.className = `word ${engine.wordStatus(test, i)}`;
    const letters = engine.letterStates(word, test.typed[i] ?? "");
    for (const { ch, state } of letters) {
      const l = document.createElement("span");
      l.className = `letter ${state}`;
      l.textContent = ch;
      w.appendChild(l);
    }
    if (i === current) {
      const typedLen = test.typed[i].length;
      const caretAt = Math.min(typedLen, letters.length - 1);
      w.children[caretAt].classList.add("caret");
      if (typedLen >= letters.length) w.children[caretAt].classList.add("after");
    }
    frag.appendChild(w);
  });

  wordsEl.replaceChildren(frag);
  keepCurrentLineVisible(current);
}

// Keep the active word on the second visible line, like a teleprompter.
function keepCurrentLineVisible(index) {
  const el = wordsEl.children[index];
  if (!el) return;
  wordsEl.scrollTop = Math.max(0, el.offsetTop - wordsEl.offsetTop - el.offsetHeight);
}

function renderHistory() {
  const rows = history.all().slice(-10).reverse();
  const body = $("#history-body");
  body.replaceChildren(
    ...rows.map((r) => {
      const tr = document.createElement("tr");
      const date = new Date(r.date).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
      for (const v of [r.wpm, `${r.accuracy}%`, r.raw, `${r.duration}s`, r.mode?.join(", ") || "—", date]) {
        const td = document.createElement("td");
        td.textContent = v;
        tr.appendChild(td);
      }
      return tr;
    })
  );
  $("#history").hidden = rows.length === 0;
  for (const d of [15, 30, 60, 120]) $(`#best-${d}`).textContent = history.best(d) || "–";
}

// ---------- input ----------

function handleKey(e) {
  if (timer.finished) return;

  if (e.key === "Backspace") {
    e.preventDefault();
    const changed = e.ctrlKey || e.altKey ? engine.deleteWord(test) : engine.backspace(test);
    if (changed) renderWords();
    return;
  }
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  if (e.key === " ") {
    e.preventDefault();
    if (engine.submitWord(test)) {
      if (engine.currentIndex(test) > test.words.length - 30) test.words.push(...generateWords(BATCH, settings));
      renderWords();
    }
    return;
  }

  if (e.key.length !== 1) return;
  e.preventDefault();
  if (!timer.started) start();
  if (engine.typeChar(test, e.key)) renderWords();
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    e.preventDefault();
    newTest();
    return;
  }
  if (!testView.hidden && e.key.length === 1 && document.activeElement !== wordsEl && !e.target.closest("button")) {
    wordsEl.focus();
  }
  if (document.activeElement === wordsEl) handleKey(e);
});

wordsEl.addEventListener("click", () => wordsEl.focus());
$("#restart").addEventListener("click", newTest);

// ---------- settings ----------

function loadSettings() {
  const defaults = { duration: 30, punctuation: false, numbers: false };
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem("typeflow:settings") ?? "{}") };
  } catch {
    return defaults;
  }
}

function saveSettings() {
  try { localStorage.setItem("typeflow:settings", JSON.stringify(settings)); } catch { /* optional */ }
}

function syncSettingsUI() {
  document.querySelectorAll("[data-duration]").forEach((b) =>
    b.setAttribute("aria-pressed", String(Number(b.dataset.duration) === settings.duration))
  );
  document.querySelectorAll("[data-toggle]").forEach((b) =>
    b.setAttribute("aria-pressed", String(settings[b.dataset.toggle]))
  );
}

document.querySelectorAll("[data-duration]").forEach((b) =>
  b.addEventListener("click", () => {
    settings.duration = Number(b.dataset.duration);
    saveSettings();
    syncSettingsUI();
    newTest();
  })
);
document.querySelectorAll("[data-toggle]").forEach((b) =>
  b.addEventListener("click", () => {
    settings[b.dataset.toggle] = !settings[b.dataset.toggle];
    saveSettings();
    syncSettingsUI();
    newTest();
  })
);

$("#clear-history").addEventListener("click", () => {
  if (confirm("Clear all saved results?")) {
    history.clear();
    renderHistory();
  }
});

// ---------- theme ----------

const root = document.documentElement;
try {
  const saved = localStorage.getItem("typeflow:theme");
  if (saved) root.dataset.theme = saved;
} catch { /* optional */ }

$("#theme-toggle").addEventListener("click", () => {
  const dark = root.dataset.theme
    ? root.dataset.theme === "dark"
    : matchMedia("(prefers-color-scheme: dark)").matches;
  root.dataset.theme = dark ? "light" : "dark";
  try { localStorage.setItem("typeflow:theme", root.dataset.theme); } catch { /* optional */ }
  if (!resultView.hidden) drawChart(chartEl, lastChart, { maxX: settings.duration });
});

let lastChart = [];
window.addEventListener("resize", () => {
  if (!resultView.hidden) drawChart(chartEl, lastChart, { maxX: settings.duration });
  else keepCurrentLineVisible(engine.currentIndex(test));
});

syncSettingsUI();
renderHistory();
newTest();
