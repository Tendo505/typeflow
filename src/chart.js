// Dependency-free line chart on <canvas>. Draws net WPM as a line and raw
// per-second speed as faint dots, re-reading theme colours from CSS variables.

export function drawChart(canvas, points, { maxX } = {}) {
  const dpr = window.devicePixelRatio || 1;
  const { width, height } = canvas.getBoundingClientRect();
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);
  if (points.length === 0) return;

  const css = getComputedStyle(document.documentElement);
  const accent = css.getPropertyValue("--accent").trim();
  const muted = css.getPropertyValue("--muted").trim();
  const grid = css.getPropertyValue("--panel").trim();

  const pad = { top: 12, right: 12, bottom: 24, left: 36 };
  const w = width - pad.left - pad.right;
  const h = height - pad.top - pad.bottom;
  const xMax = maxX ?? points.length;
  const yMax = niceCeil(Math.max(10, ...points.map((p) => Math.max(p.wpm, p.raw))));

  const x = (s) => pad.left + ((s - 1) / Math.max(1, xMax - 1)) * w;
  const y = (v) => pad.top + h - (v / yMax) * h;

  ctx.font = "11px ui-monospace, Consolas, monospace";
  ctx.fillStyle = muted;
  ctx.strokeStyle = grid;
  ctx.lineWidth = 1;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (let i = 0; i <= 4; i++) {
    const v = (yMax / 4) * i;
    ctx.beginPath();
    ctx.moveTo(pad.left, y(v));
    ctx.lineTo(pad.left + w, y(v));
    ctx.stroke();
    ctx.fillText(String(Math.round(v)), pad.left - 8, y(v));
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const step = Math.max(1, Math.ceil(xMax / 10));
  for (let s = 1; s <= xMax; s += step) ctx.fillText(String(s), x(s), pad.top + h + 8);

  ctx.fillStyle = muted;
  for (const p of points) {
    ctx.beginPath();
    ctx.arc(x(p.second), y(p.raw), 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = accent;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = "round";
  ctx.beginPath();
  points.forEach((p, i) => (i ? ctx.lineTo(x(p.second), y(p.wpm)) : ctx.moveTo(x(p.second), y(p.wpm))));
  ctx.stroke();
}

function niceCeil(v) {
  const step = v > 100 ? 50 : v > 40 ? 20 : 10;
  return Math.ceil(v / step) * step;
}
