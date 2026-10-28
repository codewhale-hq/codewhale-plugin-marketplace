import { parseCsv, toNumber, toCsv } from "./csv.mjs";
import { esc } from "./zip.mjs";

const isDate = (v) => /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?)?/.test(v) || /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(v);
const round = (n, d = 4) => (n === null || !Number.isFinite(n) ? null : Number(n.toFixed(d)));

function quantile(sorted, q) {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export function profile(text) {
  const { header, rows } = parseCsv(text);
  const widths = new Map();
  for (const r of rows) widths.set(r.length, (widths.get(r.length) ?? 0) + 1);
  const ragged = [...widths.entries()].filter(([w]) => w !== header.length).reduce((n, [, c]) => n + c, 0);
  const columns = header.map((name, c) => {
    const raw = rows.map((r) => (r[c] ?? "").trim());
    const present = raw.filter((v) => v !== "" && !/^(na|n\/a|null|none|nan|-)$/i.test(v));
    const nums = present.map(toNumber);
    const numeric = present.length > 0 && nums.filter((n) => n !== null).length / present.length >= 0.95;
    const dates = present.length > 0 && present.filter(isDate).length / present.length >= 0.95;
    const counts = new Map();
    for (const v of present) counts.set(v, (counts.get(v) ?? 0) + 1);
    const col = { name, type: numeric ? "number" : dates ? "date" : "text", count: raw.length, missing: raw.length - present.length, distinct: counts.size };
    if (numeric) {
      const vals = nums.filter((n) => n !== null).sort((a, b) => a - b);
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, vals.length - 1));
      const q1 = quantile(vals, 0.25), q3 = quantile(vals, 0.75), iqr = q3 - q1;
      Object.assign(col, { min: vals[0], p25: round(q1), median: round(quantile(vals, 0.5)), mean: round(mean), p75: round(q3), max: vals.at(-1), std: round(sd), sum: round(vals.reduce((a, b) => a + b, 0)), outliers: vals.filter((v) => v < q1 - 1.5 * iqr || v > q3 + 1.5 * iqr).length, nonNumeric: present.length - vals.length });
    } else if (dates) {
      const sorted = [...present].sort();
      Object.assign(col, { min: sorted[0], max: sorted.at(-1) });
    }
    if (!numeric || counts.size <= 12) col.top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([value, n]) => ({ value, n }));
    if (counts.size === present.length && present.length === rows.length && rows.length > 1) col.unique = true;
    return col;
  });
  const keys = new Set(rows.map((r) => r.join("\u0001")));
  return { rows: rows.length, columns, duplicateRows: rows.length - keys.size, raggedRows: ragged };
}

export function profileMarkdown(p, name = "data") {
  const lines = [`# Profile: ${name}`, "", `${p.rows} rows, ${p.columns.length} columns. Duplicate rows: ${p.duplicateRows}. Rows with a different field count than the header: ${p.raggedRows}.`, "", "| Column | Type | Missing | Distinct | Summary |", "| --- | --- | --- | --- | --- |"];
  for (const c of p.columns) {
    const summary = c.type === "number" ? `min ${c.min}, median ${c.median}, mean ${c.mean}, max ${c.max}, sd ${c.std}${c.outliers ? `, ${c.outliers} outlier(s) by IQR` : ""}${c.nonNumeric ? `, ${c.nonNumeric} non-numeric` : ""}`
      : c.type === "date" ? `${c.min} → ${c.max}` : (c.top ?? []).map((t) => `${t.value} (${t.n})`).join(", ");
    lines.push(`| ${c.name.replace(/\|/g, "\\|")} | ${c.type}${c.unique ? ", unique" : ""} | ${c.missing} | ${c.distinct} | ${summary.replace(/\|/g, "\\|")} |`);
  }
  return lines.join("\n") + "\n";
}

const AGG = {
  sum: (v) => v.reduce((a, b) => a + b, 0),
  mean: (v) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null),
  median: (v) => quantile([...v].sort((a, b) => a - b), 0.5),
  min: (v) => (v.length ? Math.min(...v) : null),
  max: (v) => (v.length ? Math.max(...v) : null),
  count: (v) => v.length,
};

export function pivot(text, { by, value, agg = "sum", sort = "desc", top }) {
  const { header, rows } = parseCsv(text);
  const keys = [].concat(by);
  const idx = keys.map((k) => header.indexOf(k));
  idx.forEach((i, n) => { if (i < 0) throw new Error(`no column '${keys[n]}' (columns: ${header.join(", ")})`); });
  const vi = value ? header.indexOf(value) : -1;
  if (value && vi < 0) throw new Error(`no column '${value}'`);
  if (!AGG[agg]) throw new Error(`agg must be one of ${Object.keys(AGG).join(", ")}`);
  const groups = new Map();
  for (const r of rows) {
    const k = idx.map((i) => r[i] ?? "").join("\u0001");
    if (!groups.has(k)) groups.set(k, []);
    const n = vi >= 0 ? toNumber(r[vi]) : 1;
    if (n !== null) groups.get(k).push(n);
  }
  let out = [...groups.entries()].map(([k, v]) => [...k.split("\u0001"), round(AGG[agg](v)), v.length]);
  if (sort !== "none") out.sort((a, b) => (sort === "asc" ? 1 : -1) * ((a[keys.length] ?? 0) - (b[keys.length] ?? 0)));
  if (top) out = out.slice(0, top);
  return toCsv([...keys, `${agg}_${value ?? "rows"}`, "n"], out);
}

export function chartSvg(text, { x, y, type = "bar", title = "", width = 960, height = 540, color = "#2563EB" }) {
  const { header, rows } = parseCsv(text);
  const xi = header.indexOf(x);
  const ys = [].concat(y);
  const yi = ys.map((c) => header.indexOf(c));
  if (xi < 0) throw new Error(`no column '${x}'`);
  yi.forEach((i, n) => { if (i < 0) throw new Error(`no column '${ys[n]}'`); });
  const data = rows.map((r) => ({ label: r[xi], values: yi.map((i) => toNumber(r[i])) })).filter((d) => d.values.every((v) => v !== null));
  if (!data.length) throw new Error("no numeric rows to chart");
  if (type === "bar" && data.length > 40) throw new Error(`${data.length} bars is unreadable; pivot or filter to 40 or fewer first`);
  const palette = [color, "#F59E0B", "#10B981", "#EF4444", "#8B5CF6", "#6B7280"];
  const pad = { l: 80, r: 24, t: title ? 56 : 24, b: 90 };
  const pw = width - pad.l - pad.r, ph = height - pad.t - pad.b;
  const all = data.flatMap((d) => d.values);
  const lo = Math.min(0, ...all), hi = Math.max(0, ...all);
  const step = niceStep((hi - lo) / 5 || 1);
  const yMin = Math.floor(lo / step) * step, yMax = Math.ceil(hi / step) * step || step;
  const sy = (v) => pad.t + ph - ((v - yMin) / (yMax - yMin)) * ph;
  const fmt = (v) => (Math.abs(v) >= 1e6 ? `${round(v / 1e6, 1)}M` : Math.abs(v) >= 1e3 ? `${round(v / 1e3, 1)}k` : String(round(v, 2)));
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="Helvetica, Arial, sans-serif"><rect width="100%" height="100%" fill="#FFFFFF"/>`];
  if (title) parts.push(`<text x="${pad.l}" y="34" font-size="22" font-weight="700" fill="#111827">${esc(title)}</text>`);
  for (let v = yMin; v <= yMax + step / 2; v += step) parts.push(`<line x1="${pad.l}" x2="${width - pad.r}" y1="${sy(v)}" y2="${sy(v)}" stroke="#E5E7EB"/><text x="${pad.l - 8}" y="${sy(v) + 4}" font-size="12" text-anchor="end" fill="#6B7280">${fmt(v)}</text>`);
  const slot = pw / data.length;
  const labelEvery = Math.ceil(data.length / 20);
  data.forEach((d, i) => {
    const cx = pad.l + slot * (i + 0.5);
    if (i % labelEvery === 0) parts.push(`<text transform="translate(${cx},${height - pad.b + 16}) rotate(${data.length > 8 ? -35 : 0})" font-size="12" text-anchor="${data.length > 8 ? "end" : "middle"}" fill="#374151">${esc(String(d.label).slice(0, 24))}</text>`);
    if (type === "bar") {
      const bw = (slot * 0.7) / ys.length;
      d.values.forEach((v, s) => parts.push(`<rect x="${cx - (slot * 0.7) / 2 + s * bw}" y="${Math.min(sy(v), sy(0))}" width="${bw - 1}" height="${Math.abs(sy(v) - sy(0))}" fill="${palette[s % palette.length]}"><title>${esc(d.label)}: ${v}</title></rect>`));
    }
  });
  if (type === "line") ys.forEach((_, s) => {
    const pts = data.map((d, i) => `${pad.l + slot * (i + 0.5)},${sy(d.values[s])}`).join(" ");
    parts.push(`<polyline points="${pts}" fill="none" stroke="${palette[s % palette.length]}" stroke-width="3" stroke-linejoin="round"/>`);
  });
  parts.push(`<line x1="${pad.l}" x2="${width - pad.r}" y1="${sy(0)}" y2="${sy(0)}" stroke="#9CA3AF"/>`);
  if (ys.length > 1) ys.forEach((name, s) => parts.push(`<rect x="${width - pad.r - 160}" y="${pad.t + s * 20}" width="12" height="12" fill="${palette[s % palette.length]}"/><text x="${width - pad.r - 142}" y="${pad.t + s * 20 + 11}" font-size="12" fill="#374151">${esc(name)}</text>`));
  parts.push("</svg>");
  return { svg: parts.join(""), points: data.length };
}

function niceStep(raw) {
  const p = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= raw) ?? 10 * p;
}
