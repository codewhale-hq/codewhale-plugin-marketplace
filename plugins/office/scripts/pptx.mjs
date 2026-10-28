import fs from "node:fs";
import path from "node:path";
import { zip, esc, XML, imageInfo } from "./zip.mjs";

const EMU = 914400;
const W = 13.333, H = 7.5, M = 0.6;
const NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
const LAYOUTS = ["title", "section", "bullets", "two-column", "image", "image-right", "quote", "stats", "table", "bars", "closing"];

const DEFAULT_THEME = { background: "FFFFFF", text: "1F2937", accent: "2563EB", muted: "6B7280", surface: "F3F4F6", font: "Arial", headingFont: "Arial" };
const hex = (c, fallback) => { const v = String(c ?? fallback).replace(/^#/, "").toUpperCase(); if (!/^[0-9A-F]{6}$/.test(v)) throw new Error(`color must be #RRGGBB, got ${c}`); return v; };
const emu = (inches) => Math.round(inches * EMU);

export function estimateLines(text, widthIn, pt) {
  const perLine = Math.max(8, Math.floor((widthIn * 72) / (pt * 0.52)));
  return String(text).split("\n").reduce((n, line) => n + Math.max(1, Math.ceil(line.length / perLine)), 0);
}

function fitSize(paras, widthIn, heightIn, maxPt, minPt) {
  for (let pt = maxPt; pt >= minPt; pt -= 1) {
    const lines = paras.reduce((n, p) => n + estimateLines(p.text, widthIn - 0.4 - (p.level || 0) * 0.4, pt), 0);
    const h = lines * pt * 1.25 / 72 + paras.length * pt * 0.45 / 72;
    if (h <= heightIn) return { pt, overflow: false };
  }
  return { pt: minPt, overflow: true };
}

class Slide {
  constructor(theme) { this.theme = theme; this.shapes = []; this.rels = []; this.id = 2; this.warnings = []; }
  nextId() { return this.id++; }
  rect(x, y, w, h, color) {
    const id = this.nextId();
    this.shapes.push(`<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Shape ${id}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${emu(x)}" y="${emu(y)}"/><a:ext cx="${emu(w)}" cy="${emu(h)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:ln><a:noFill/></a:ln></p:spPr></p:sp>`);
  }
  text(x, y, w, h, paras, opts = {}) {
    const t = this.theme;
    const list = paras.map((p) => (typeof p === "string" ? { text: p } : p)).filter((p) => p.text !== undefined && p.text !== "");
    if (!list.length) return;
    let pt = opts.size ?? 18;
    if (opts.fit) {
      const fit = fitSize(list, w, h, pt, opts.minSize ?? Math.min(pt, 12));
      pt = fit.pt;
      if (fit.overflow) this.warnings.push(`${opts.label ?? "text"} may overflow its box even at ${pt}pt; shorten it or split the slide`);
    }
    const id = this.nextId();
    const body = list.map((p) => {
      const size = Math.round((p.size ?? pt) * 100);
      const level = p.level || 0;
      const bullet = opts.bullets ? `<a:pPr marL="${emu(0.3 + level * 0.4)}" indent="-${emu(0.3)}" algn="${opts.align ?? "l"}"><a:spcBef><a:spcPts val="${Math.round(pt * 45)}"/></a:spcBef><a:buClr><a:srgbClr val="${t.accent}"/></a:buClr><a:buFont typeface="Arial"/><a:buChar char="${level ? "–" : "•"}"/></a:pPr>`
        : `<a:pPr algn="${opts.align ?? "l"}"><a:spcBef><a:spcPts val="${opts.spacing ?? 0}"/></a:spcBef><a:buNone/></a:pPr>`;
      const runs = inlineRuns(String(p.text)).map((r) => `<a:r><a:rPr lang="en-US" sz="${size}"${(opts.bold || r.bold) ? ' b="1"' : ""}${(opts.italic || r.italic) ? ' i="1"' : ""} dirty="0"><a:solidFill><a:srgbClr val="${p.color ?? opts.color ?? t.text}"/></a:solidFill><a:latin typeface="${esc(opts.heading ? t.headingFont : t.font)}"/><a:ea typeface="${esc(opts.heading ? t.headingFont : t.font)}"/></a:rPr><a:t>${esc(r.text)}</a:t></a:r>`).join("");
      return `<a:p>${bullet}${runs}</a:p>`;
    }).join("");
    this.shapes.push(`<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${esc(opts.label ?? "Text")} ${id}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${emu(x)}" y="${emu(y)}"/><a:ext cx="${emu(w)}" cy="${emu(h)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom>${opts.fill ? `<a:solidFill><a:srgbClr val="${opts.fill}"/></a:solidFill>` : "<a:noFill/>"}</p:spPr><p:txBody><a:bodyPr wrap="square" lIns="${emu(0.1)}" tIns="${emu(0.05)}" rIns="${emu(0.1)}" bIns="${emu(0.05)}" anchor="${opts.anchor ?? "t"}"><a:normAutofit/></a:bodyPr><a:lstStyle/>${body}</p:txBody></p:sp>`);
  }
  image(file, x, y, w, h, media) {
    const buf = fs.readFileSync(file);
    const info = imageInfo(buf);
    const scale = Math.min(w / info.w, h / info.h);
    const iw = info.w * scale, ih = info.h * scale;
    const rid = `rId${this.rels.length + 2}`;
    const name = `image${media.length + 1}.${info.ext}`;
    media.push({ name, data: buf, ext: info.ext });
    this.rels.push(`<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${name}"/>`);
    const id = this.nextId();
    this.shapes.push(`<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="Picture ${id}" descr="${esc(path.basename(file))}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="${emu(x + (w - iw) / 2)}" y="${emu(y + (h - ih) / 2)}"/><a:ext cx="${emu(iw)}" cy="${emu(ih)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`);
  }
  table(x, y, w, header, rows) {
    const t = this.theme;
    const cols = Math.max(header?.length ?? 0, ...rows.map((r) => r.length));
    const rowH = Math.min(0.5, 5 / (rows.length + 1));
    const pt = rows.length > 10 || cols > 6 ? 11 : 14;
    if (rows.length > 14) this.warnings.push(`table has ${rows.length} rows; more than about 12 is unreadable on a slide`);
    const cell = (v, head, i) => `<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr algn="${typeof v === "number" ? "r" : "l"}"/><a:r><a:rPr lang="en-US" sz="${pt * 100}"${head ? ' b="1"' : ""} dirty="0"><a:solidFill><a:srgbClr val="${head ? t.background : t.text}"/></a:solidFill><a:latin typeface="${esc(t.font)}"/></a:rPr><a:t>${esc(v ?? "")}</a:t></a:r></a:p></a:txBody><a:tcPr marL="${emu(0.08)}" marR="${emu(0.08)}" anchor="ctr"><a:lnL w="0"><a:noFill/></a:lnL><a:lnR w="0"><a:noFill/></a:lnR><a:lnT w="0"><a:noFill/></a:lnT><a:lnB w="6350"><a:solidFill><a:srgbClr val="D1D5DB"/></a:solidFill></a:lnB>${head ? `<a:solidFill><a:srgbClr val="${t.accent}"/></a:solidFill>` : i % 2 ? `<a:solidFill><a:srgbClr val="${t.surface}"/></a:solidFill>` : "<a:noFill/>"}</a:tcPr></a:tc>`;
    const all = [...(header ? [header] : []), ...rows];
    const trs = all.map((r, i) => `<a:tr h="${emu(rowH)}">${Array.from({ length: cols }, (_, c) => cell(r[c], header && i === 0, i)).join("")}</a:tr>`).join("");
    const id = this.nextId();
    this.shapes.push(`<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="${id}" name="Table ${id}"/><p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr><p:nvPr/></p:nvGraphicFramePr><p:xfrm><a:off x="${emu(x)}" y="${emu(y)}"/><a:ext cx="${emu(w)}" cy="${emu(rowH * all.length)}"/></p:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl><a:tblPr firstRow="${header ? 1 : 0}" bandRow="1"/><a:tblGrid>${Array.from({ length: cols }, () => `<a:gridCol w="${emu(w / cols)}"/>`).join("")}</a:tblGrid>${trs}</a:tbl></a:graphicData></a:graphic></p:graphicFrame>`);
  }
  xml(bg) {
    return `${XML}<p:sld ${NS}><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="${bg}"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>${this.shapes.join("")}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
  }
}

function inlineRuns(text) {
  const out = [];
  const re = /\*\*(.+?)\*\*|\*(.+?)\*/g;
  let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ text: text.slice(last, m.index) });
    out.push(m[1] !== undefined ? { text: m[1], bold: true } : { text: m[2], italic: true });
    last = re.lastIndex;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out.length ? out : [{ text }];
}

const bulletParas = (items = []) => items.map((b) => (typeof b === "string" ? { text: b } : { text: b.text, level: Math.min(2, b.level || 0) }));

function heading(s, spec, t) {
  s.text(M, 0.4, W - 2 * M, 0.95, [spec.title], { size: 30, bold: true, heading: true, fit: true, minSize: 22, anchor: "b", label: "Title" });
  s.rect(M + 0.1, 1.42, 0.9, 0.06, t.accent);
}

function footer(s, spec, t, n, total) {
  if (spec.source) s.text(M, 6.92, W - 2 * M - 1.2, 0.4, [spec.source], { size: 10, color: t.muted, fit: true, minSize: 8, label: "Source" });
  s.text(W - M - 1, 6.92, 1, 0.4, [`${n} / ${total}`], { size: 10, color: t.muted, align: "r", label: "Slide number" });
}

function render(spec, t, media, baseDir, n, total) {
  const s = new Slide(t);
  const layout = spec.layout ?? "bullets";
  if (!LAYOUTS.includes(layout)) throw new Error(`slide ${n}: unknown layout '${layout}' (use ${LAYOUTS.join(", ")})`);
  const img = (p) => path.resolve(baseDir, p);
  let bg = t.background;
  const bodyY = 1.7, bodyH = 5.0;
  switch (layout) {
    case "title":
    case "closing":
      s.rect(M + 0.1, 2.35, 1.2, 0.08, t.accent);
      s.text(M, 2.5, W - 2 * M, 1.7, [spec.title], { size: 44, bold: true, heading: true, fit: true, minSize: 30, anchor: "t", label: "Title" });
      s.text(M, 4.3, W - 2 * M, 1.2, [spec.subtitle], { size: 20, color: t.muted, fit: true, minSize: 14, label: "Subtitle" });
      if (spec.footer) s.text(M, 6.5, W - 2 * M, 0.5, [spec.footer], { size: 12, color: t.muted, label: "Footer" });
      break;
    case "section":
      bg = t.accent;
      s.text(M, 2.6, W - 2 * M, 1.4, [spec.title], { size: 40, bold: true, heading: true, color: t.background, fit: true, minSize: 28, anchor: "b", label: "Title" });
      s.text(M, 4.1, W - 2 * M, 1, [spec.subtitle], { size: 20, color: t.background, fit: true, minSize: 14, label: "Subtitle" });
      break;
    case "bullets":
      heading(s, spec, t);
      s.text(M, bodyY, W - 2 * M, bodyH, bulletParas(spec.bullets), { size: 24, bullets: true, fit: true, minSize: 14, label: "Bullets" });
      break;
    case "two-column": {
      heading(s, spec, t);
      const colW = (W - 2 * M - 0.5) / 2;
      [spec.left ?? {}, spec.right ?? {}].forEach((col, i) => {
        const x = M + i * (colW + 0.5);
        let y = bodyY;
        if (col.heading) { s.text(x, y, colW, 0.6, [col.heading], { size: 20, bold: true, color: t.accent, label: "Column heading" }); y += 0.65; }
        s.text(x, y, colW, bodyH - (y - bodyY), bulletParas(col.bullets), { size: 20, bullets: true, fit: true, minSize: 12, label: "Column" });
      });
      break;
    }
    case "image":
      heading(s, spec, t);
      if (!spec.image) throw new Error(`slide ${n}: image layout needs image`);
      s.image(img(spec.image), M, bodyY, W - 2 * M, spec.caption ? bodyH - 0.5 : bodyH, media);
      if (spec.caption) s.text(M, bodyY + bodyH - 0.45, W - 2 * M, 0.45, [spec.caption], { size: 12, color: t.muted, align: "ctr", label: "Caption" });
      break;
    case "image-right": {
      heading(s, spec, t);
      const textW = (W - 2 * M) * 0.5;
      s.text(M, bodyY, textW, bodyH, bulletParas(spec.bullets), { size: 22, bullets: true, fit: true, minSize: 13, label: "Bullets" });
      if (!spec.image) throw new Error(`slide ${n}: image-right layout needs image`);
      s.image(img(spec.image), M + textW + 0.4, bodyY, W - 2 * M - textW - 0.4, bodyH, media);
      break;
    }
    case "quote":
      s.rect(M + 0.1, 1.6, 0.08, 3.6, t.accent);
      s.text(M + 0.5, 1.6, W - 2 * M - 0.8, 3.6, [`“${spec.quote}”`], { size: 34, italic: true, heading: true, fit: true, minSize: 20, anchor: "ctr", label: "Quote" });
      if (spec.attribution) s.text(M + 0.5, 5.4, W - 2 * M - 0.8, 0.6, [`— ${spec.attribution}`], { size: 18, color: t.muted, label: "Attribution" });
      break;
    case "stats": {
      heading(s, spec, t);
      const stats = (spec.stats ?? []).slice(0, 4);
      if ((spec.stats ?? []).length > 4) s.warnings.push("stats layout shows at most 4 numbers; the rest were dropped");
      const cw = (W - 2 * M - 0.3 * (stats.length - 1)) / Math.max(1, stats.length);
      stats.forEach((st, i) => {
        const x = M + i * (cw + 0.3);
        s.rect(x, 2.2, cw, 3.2, t.surface);
        s.text(x + 0.2, 2.5, cw - 0.4, 1.4, [String(st.value)], { size: 54, bold: true, heading: true, color: t.accent, fit: true, minSize: 28, anchor: "b", label: "Stat" });
        s.text(x + 0.2, 4.0, cw - 0.4, 1.3, [st.label ?? ""], { size: 16, color: t.text, fit: true, minSize: 11, label: "Stat label" });
      });
      break;
    }
    case "table":
      heading(s, spec, t);
      s.table(M, bodyY, W - 2 * M, spec.header, spec.rows ?? []);
      break;
    case "bars": {
      heading(s, spec, t);
      const bars = spec.bars ?? [];
      if (!bars.length) throw new Error(`slide ${n}: bars layout needs bars`);
      const max = Math.max(...bars.map((b) => Math.abs(Number(b.value)) || 0)) || 1;
      const labelW = 3.0, valueW = 1.4, chartW = W - 2 * M - labelW - valueW;
      const rowH = Math.min(0.8, bodyH / bars.length);
      bars.forEach((b, i) => {
        const y = bodyY + i * rowH;
        const v = Number(b.value);
        s.text(M, y, labelW, rowH, [b.label], { size: Math.min(18, Math.round(rowH * 30)), anchor: "ctr", align: "r", fit: true, minSize: 10, label: "Bar label" });
        s.rect(M + labelW + 0.15, y + rowH * 0.18, Math.max(0.02, (chartW - 0.3) * Math.abs(v) / max), rowH * 0.64, b.highlight === false ? t.muted : t.accent);
        s.text(M + labelW + 0.15 + Math.max(0.02, (chartW - 0.3) * Math.abs(v) / max) + 0.05, y, valueW + 0.3, rowH, [`${b.display ?? v}${/^[A-Za-z]/.test(spec.unit ?? "") ? " " : ""}${spec.unit ?? ""}`], { size: Math.min(16, Math.round(rowH * 26)), anchor: "ctr", bold: true, label: "Bar value" });
      });
      break;
    }
  }
  if (!["title", "section", "closing"].includes(layout)) footer(s, spec, t, n, total);
  return { xml: s.xml(bg), rels: s.rels, warnings: s.warnings.map((w) => `slide ${n} (${layout}): ${w}`) };
}

const THEME_XML = (t) => `${XML}<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Codewhale"><a:themeElements><a:clrScheme name="Codewhale"><a:dk1><a:srgbClr val="${t.text}"/></a:dk1><a:lt1><a:srgbClr val="${t.background}"/></a:lt1><a:dk2><a:srgbClr val="${t.text}"/></a:dk2><a:lt2><a:srgbClr val="${t.surface}"/></a:lt2><a:accent1><a:srgbClr val="${t.accent}"/></a:accent1><a:accent2><a:srgbClr val="${t.muted}"/></a:accent2><a:accent3><a:srgbClr val="10B981"/></a:accent3><a:accent4><a:srgbClr val="F59E0B"/></a:accent4><a:accent5><a:srgbClr val="EF4444"/></a:accent5><a:accent6><a:srgbClr val="8B5CF6"/></a:accent6><a:hlink><a:srgbClr val="${t.accent}"/></a:hlink><a:folHlink><a:srgbClr val="${t.muted}"/></a:folHlink></a:clrScheme><a:fontScheme name="Codewhale"><a:majorFont><a:latin typeface="${esc(t.headingFont)}"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="${esc(t.font)}"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="Codewhale"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/></a:theme>`;

const GRP = '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>';
const REL = (id, type, target) => `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${target}"/>`;
const RELS = (items) => `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${items.join("")}</Relationships>`;

export function buildPptx(deck, baseDir) {
  if (!deck || !Array.isArray(deck.slides) || !deck.slides.length) throw new Error("deck needs a non-empty slides array");
  const th = { ...DEFAULT_THEME, ...(deck.theme ?? {}) };
  const t = { ...th, background: hex(th.background), text: hex(th.text), accent: hex(th.accent), muted: hex(th.muted), surface: hex(th.surface) };
  const media = [], warnings = [];
  const slides = deck.slides.map((spec, i) => {
    const r = render(spec, t, media, baseDir, i + 1, deck.slides.length);
    warnings.push(...r.warnings);
    return r;
  });
  const n = slides.length;
  const files = [];
  const exts = [...new Set(media.map((m) => m.ext))];
  files.push({ name: "[Content_Types].xml", data: `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${exts.map((e) => `<Default Extension="${e}" ContentType="image/${e}"/>`).join("")}<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/><Override PartName="/ppt/presProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presProps+xml"/><Override PartName="/ppt/viewProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.viewProps+xml"/><Override PartName="/ppt/tableStyles.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.tableStyles+xml"/>${slides.map((_, i) => `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join("")}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>` });
  files.push({ name: "_rels/.rels", data: RELS([REL("rId1", "officeDocument", "ppt/presentation.xml"), '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>', REL("rId3", "extended-properties", "docProps/app.xml")]) });
  const now = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  files.push({ name: "docProps/core.xml", data: `${XML}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc(deck.title ?? "")}</dc:title><dc:creator>${esc(deck.author ?? "Codewhale")}</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>` });
  files.push({ name: "docProps/app.xml", data: `${XML}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Codewhale office</Application><Slides>${n}</Slides></Properties>` });
  files.push({ name: "ppt/presentation.xml", data: `${XML}<p:presentation ${NS} saveSubsetFonts="1"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>${slides.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 10}"/>`).join("")}</p:sldIdLst><p:sldSz cx="${emu(W)}" cy="${emu(H)}"/><p:notesSz cx="6858000" cy="9144000"/><p:defaultTextStyle><a:defPPr><a:defRPr lang="en-US"/></a:defPPr></p:defaultTextStyle></p:presentation>` });
  files.push({ name: "ppt/_rels/presentation.xml.rels", data: RELS([REL("rId1", "slideMaster", "slideMasters/slideMaster1.xml"), REL("rId2", "theme", "theme/theme1.xml"), REL("rId3", "presProps", "presProps.xml"), REL("rId4", "viewProps", "viewProps.xml"), REL("rId5", "tableStyles", "tableStyles.xml"), ...slides.map((_, i) => REL(`rId${i + 10}`, "slide", `slides/slide${i + 1}.xml`))]) });
  files.push({ name: "ppt/presProps.xml", data: `${XML}<p:presentationPr ${NS}/>` });
  files.push({ name: "ppt/viewProps.xml", data: `${XML}<p:viewPr ${NS}><p:normalViewPr><p:restoredLeft sz="15620"/><p:restoredTop sz="94660"/></p:normalViewPr><p:gridSpacing cx="76200" cy="76200"/></p:viewPr>` });
  files.push({ name: "ppt/tableStyles.xml", data: `${XML}<a:tblStyleLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" def="{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}"/>` });
  files.push({ name: "ppt/theme/theme1.xml", data: THEME_XML(t) });
  files.push({ name: "ppt/slideMasters/slideMaster1.xml", data: `${XML}<p:sldMaster ${NS}><p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg><p:spTree>${GRP}</p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle><a:lvl1pPr><a:defRPr sz="3200"><a:latin typeface="+mj-lt"/></a:defRPr></a:lvl1pPr></p:titleStyle><p:bodyStyle><a:lvl1pPr><a:defRPr sz="2000"><a:latin typeface="+mn-lt"/></a:defRPr></a:lvl1pPr></p:bodyStyle><p:otherStyle><a:lvl1pPr><a:defRPr sz="1800"/></a:lvl1pPr></p:otherStyle></p:txStyles></p:sldMaster>` });
  files.push({ name: "ppt/slideMasters/_rels/slideMaster1.xml.rels", data: RELS([REL("rId1", "slideLayout", "../slideLayouts/slideLayout1.xml"), REL("rId2", "theme", "../theme/theme1.xml")]) });
  files.push({ name: "ppt/slideLayouts/slideLayout1.xml", data: `${XML}<p:sldLayout ${NS} type="blank" preserve="1"><p:cSld name="Blank"><p:spTree>${GRP}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>` });
  files.push({ name: "ppt/slideLayouts/_rels/slideLayout1.xml.rels", data: RELS([REL("rId1", "slideMaster", "../slideMasters/slideMaster1.xml")]) });
  slides.forEach((s, i) => {
    files.push({ name: `ppt/slides/slide${i + 1}.xml`, data: s.xml });
    files.push({ name: `ppt/slides/_rels/slide${i + 1}.xml.rels`, data: RELS([REL("rId1", "slideLayout", "../slideLayouts/slideLayout1.xml"), ...s.rels]) });
  });
  for (const m of media) files.push({ name: `ppt/media/${m.name}`, data: m.data });
  const notes = deck.slides.map((s, i) => (s.notes ? `## Slide ${i + 1}: ${s.title ?? s.layout}\n\n${s.notes}\n` : "")).filter(Boolean).join("\n");
  return { buffer: zip(files), warnings, slides: n, notes };
}
