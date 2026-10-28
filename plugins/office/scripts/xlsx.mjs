import { zip, esc, XML } from "./zip.mjs";

const FORMATS = ["general", "text", "integer", "decimal", "percent", "currency", "date"];
const NUMFMT = { general: 0, text: 49, integer: 3, decimal: 4, percent: 164, currency: 165, date: 166 };

export const colName = (i) => { let s = ""; for (i += 1; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s; return s; };

const styleIndex = (format, bold) => 2 + FORMATS.indexOf(format) * 2 + (bold ? 1 : 0);

function serialDate(v) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(String(v));
  if (!m) return null;
  const ms = Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0));
  return ms / 86400000 + 25569;
}

export function inferFormat(values) {
  const present = values.filter((v) => v !== null && v !== undefined && v !== "");
  if (!present.length) return "general";
  if (present.every((v) => typeof v === "number" || /^-?\d+$/.test(String(v).replace(/,/g, "")))) return "integer";
  if (present.every((v) => /^-?[\d,]*\.?\d+%$/.test(String(v)))) return "percent";
  if (present.every((v) => /^-?\$[\d,]*\.?\d+$/.test(String(v)))) return "currency";
  if (present.every((v) => typeof v === "number" || /^-?[\d,]*\.\d+(e[+-]?\d+)?$/i.test(String(v)))) return "decimal";
  if (present.every((v) => /^\d{4}-\d{2}-\d{2}/.test(String(v)))) return "date";
  return "text";
}

export function coerce(v, format) {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "object") return v;
  if (format === "text") return String(v);
  if (format === "date") return serialDate(v) ?? String(v);
  const s = String(v).trim();
  if (format === "percent" && s.endsWith("%")) return Number(s.slice(0, -1).replace(/,/g, "")) / 100;
  if (["integer", "decimal", "currency", "percent", "general"].includes(format)) {
    const n = Number(s.replace(/[$,]/g, ""));
    if (s !== "" && Number.isFinite(n) && /^-?\$?[\d,]*\.?\d+(e[+-]?\d+)?%?$/i.test(s)) return n;
  }
  return typeof v === "number" ? v : s;
}

function cellXml(ref, v, style) {
  if (v === null || v === undefined) return style ? `<c r="${ref}" s="${style}"/>` : "";
  if (typeof v === "object" && v.f) return `<c r="${ref}" s="${style}"><f>${esc(String(v.f).replace(/^=/, ""))}</f></c>`;
  if (typeof v === "number") return Number.isFinite(v) ? `<c r="${ref}" s="${style}"><v>${v}</v></c>` : "";
  if (typeof v === "boolean") return `<c r="${ref}" s="${style}" t="b"><v>${v ? 1 : 0}</v></c>`;
  const s = String(v);
  if (s.startsWith("=") && s.length > 1) return `<c r="${ref}" s="${style}"><f>${esc(s.slice(1))}</f></c>`;
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${esc(s)}</t></is></c>`;
}

function sheetXml(sheet) {
  const rows = sheet.rows ?? [];
  const width = Math.max(sheet.columns?.length ?? 0, ...rows.map((r) => r.length));
  const columns = Array.from({ length: width }, (_, c) => {
    const col = sheet.columns?.[c] ?? {};
    const header = typeof col === "string" ? col : col.header ?? "";
    const format = (typeof col === "object" && col.format) || inferFormat(rows.map((r) => r[c]).filter((v) => typeof v !== "object" || v === null));
    if (!FORMATS.includes(format)) throw new Error(`sheet '${sheet.name}': unknown format '${format}' (use ${FORMATS.join(", ")})`);
    const longest = Math.max(String(header).length, ...rows.slice(0, 500).map((r) => (r[c] && typeof r[c] === "object" ? 10 : String(r[c] ?? "").length)));
    return { header, format, width: (typeof col === "object" && col.width) || Math.min(60, Math.max(8, longest * 1.15 + 2)) };
  });
  const hasHeader = columns.some((c) => c.header !== "");
  const out = [];
  let r = 1;
  if (hasHeader) out.push(`<row r="${r++}">${columns.map((c, i) => cellXml(`${colName(i)}1`, String(c.header), 1)).join("")}</row>`);
  const first = r;
  for (const row of rows) {
    out.push(`<row r="${r}">${columns.map((c, i) => cellXml(`${colName(i)}${r}`, coerce(row[i], c.format), styleIndex(c.format, false))).join("")}</row>`);
    r++;
  }
  const last = r - 1;
  if (sheet.totals && rows.length) {
    const fn = (agg) => ({ sum: "SUM", average: "AVERAGE", mean: "AVERAGE", count: "COUNTA", min: "MIN", max: "MAX", median: "MEDIAN" })[String(agg).toLowerCase()];
    const cells = columns.map((c, i) => {
      const letter = colName(i);
      const agg = sheet.totals.columns?.[letter] ?? sheet.totals.columns?.[c.header];
      if (i === 0 && !agg) return cellXml(`${letter}${r}`, sheet.totals.label ?? "Total", styleIndex("text", true));
      if (!agg) return "";
      if (!fn(agg)) throw new Error(`sheet '${sheet.name}': unknown total '${agg}'`);
      return cellXml(`${letter}${r}`, { f: `${fn(agg)}(${letter}${first}:${letter}${last})` }, styleIndex(c.format, true));
    });
    out.push(`<row r="${r}">${cells.join("")}</row>`);
  }
  const freeze = sheet.freeze !== false && hasHeader;
  const view = freeze ? `<sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView>` : `<sheetView workbookViewId="0"/>`;
  const filter = sheet.autofilter !== false && hasHeader && rows.length ? `<autoFilter ref="A1:${colName(width - 1)}${last}"/>` : "";
  return {
    xml: `${XML}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetViews>${view}</sheetViews><sheetFormatPr defaultRowHeight="15"/><cols>${columns.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.width.toFixed(1)}" customWidth="1"/>`).join("")}</cols><sheetData>${out.join("")}</sheetData>${filter}</worksheet>`,
    filter: filter ? `'${sheet.name.replace(/'/g, "''")}'!$A$1:$${colName(width - 1)}$${last}` : null,
    rows: rows.length, columns: width,
  };
}

function stylesXml(accent, currency) {
  const fmts = FORMATS.flatMap((f) => [false, true].map((bold) => `<xf numFmtId="${NUMFMT[f]}" fontId="${bold ? 1 : 0}" fillId="0" borderId="${bold ? 2 : 0}" xfId="0"${NUMFMT[f] ? ' applyNumberFormat="1"' : ""}${bold ? ' applyFont="1" applyBorder="1"' : ""}/>`));
  return `${XML}<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="3"><numFmt numFmtId="164" formatCode="0.0%"/><numFmt numFmtId="165" formatCode="${esc(currency)}#,##0.00"/><numFmt numFmtId="166" formatCode="yyyy-mm-dd"/></numFmts><fonts count="3"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF${accent}"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="3"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color rgb="FF9CA3AF"/></bottom><diagonal/></border><border><left/><right/><top style="thin"><color rgb="FF374151"/></top><bottom style="double"><color rgb="FF374151"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${2 + fmts.length}"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>${fmts.join("")}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
}

export function buildXlsx(book) {
  const sheets = book.sheets;
  if (!Array.isArray(sheets) || !sheets.length) throw new Error("workbook needs a non-empty sheets array");
  const names = new Set();
  sheets.forEach((s, i) => {
    s.name = String(s.name ?? `Sheet${i + 1}`).replace(/[\\/?*[\]:]/g, " ").slice(0, 31).trim() || `Sheet${i + 1}`;
    if (names.has(s.name.toLowerCase())) throw new Error(`duplicate sheet name '${s.name}'`);
    names.add(s.name.toLowerCase());
  });
  const accent = String(book.accent ?? "1F4E79").replace(/^#/, "").toUpperCase();
  const built = sheets.map(sheetXml);
  const files = [
    { name: "[Content_Types].xml", data: `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${built.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>` },
    { name: "_rels/.rels", data: `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>` },
    { name: "docProps/core.xml", data: `${XML}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${esc(book.title ?? "")}</dc:title><dc:creator>${esc(book.author ?? "Codewhale")}</dc:creator></cp:coreProperties>` },
    { name: "docProps/app.xml", data: `${XML}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Codewhale office</Application></Properties>` },
    { name: "xl/workbook.xml", data: `${XML}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>${sheets.map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets>${built.some((b) => b.filter) ? `<definedNames>${built.map((b, i) => (b.filter ? `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">${esc(b.filter)}</definedName>` : "")).join("")}</definedNames>` : ""}<calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>` },
    { name: "xl/_rels/workbook.xml.rels", data: `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${built.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${built.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { name: "xl/styles.xml", data: stylesXml(accent, book.currency ?? "$") },
    ...built.map((b, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: b.xml })),
  ];
  return { buffer: zip(files), sheets: sheets.map((s, i) => ({ name: s.name, rows: built[i].rows, columns: built[i].columns })) };
}
