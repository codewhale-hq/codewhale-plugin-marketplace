export function parseCsv(text, delimiter) {
  text = text.replace(/^﻿/, "");
  const sep = delimiter ?? (() => {
    const head = text.slice(0, text.indexOf("\n") >>> 0 || text.length);
    return [",", "\t", ";", "|"].map((d) => [d, head.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
  })();
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"' && field === "") quoted = true;
    else if (ch === sep) { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  const [header = [], ...body] = rows;
  return { header: header.map((h, i) => h.trim() || `column_${i + 1}`), rows: body };
}

export const toNumber = (v) => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim().replace(/[$€£¥,\s]/g, "");
  if (s === "" || !/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?%?$/i.test(s)) return null;
  return s.endsWith("%") ? Number(s.slice(0, -1)) / 100 : Number(s);
};

export function toCsv(header, rows) {
  const q = (v) => { const s = v === null || v === undefined ? "" : String(v); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [header, ...rows].map((r) => r.map(q).join(",")).join("\n") + "\n";
}
