import fs from "node:fs";
import path from "node:path";
import { zip, esc, XML, imageInfo } from "./zip.mjs";

const W_NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';

export function parseMarkdown(md) {
  const lines = md.replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  let i = 0;
  const isTableSep = (l) => /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(l);
  const cells = (l) => l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    let m;
    if ((m = /^```(\w*)/.exec(line))) {
      const code = [];
      for (i++; i < lines.length && !/^```/.test(lines[i]); i++) code.push(lines[i]);
      i++;
      blocks.push({ type: "code", text: code.join("\n") });
    } else if ((m = /^(#{1,6})\s+(.*)$/.exec(line))) {
      blocks.push({ type: "heading", level: m[1].length, text: m[2].trim() }); i++;
    } else if (/^(\*\*\*|---|___)\s*$/.test(line)) {
      blocks.push({ type: "rule" }); i++;
    } else if (/^\s*<!--\s*pagebreak\s*-->\s*$/i.test(line)) {
      blocks.push({ type: "pagebreak" }); i++;
    } else if ((m = /^!\[([^\]]*)\]\(([^)\s]+)\)\s*$/.exec(line.trim()))) {
      blocks.push({ type: "image", alt: m[1], src: m[2] }); i++;
    } else if (line.includes("|") && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const header = cells(line);
      const rows = [];
      for (i += 2; i < lines.length && lines[i].includes("|") && lines[i].trim(); i++) rows.push(cells(lines[i]));
      blocks.push({ type: "table", header, rows });
    } else if (/^>\s?/.test(line)) {
      const q = [];
      for (; i < lines.length && /^>\s?/.test(lines[i]); i++) q.push(lines[i].replace(/^>\s?/, ""));
      blocks.push({ type: "quote", text: q.join(" ") });
    } else if (/^\s*([-*+]|\d+[.)])\s+/.test(line)) {
      const items = [];
      for (; i < lines.length && /^\s*([-*+]|\d+[.)])\s+/.test(lines[i]); i++) {
        const mm = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(lines[i]);
        items.push({ level: Math.min(2, Math.floor(mm[1].replace(/\t/g, "  ").length / 2)), ordered: /\d/.test(mm[2]), text: mm[3] });
      }
      blocks.push({ type: "list", ordered: items[0].ordered, items });
    } else {
      const para = [];
      for (; i < lines.length && lines[i].trim() && !/^(#{1,6}\s|```|>|\s*([-*+]|\d+[.)])\s+|!\[)/.test(lines[i]) && !(lines[i].includes("|") && isTableSep(lines[i + 1] ?? "")); i++) para.push(lines[i].trim());
      blocks.push({ type: "para", text: para.join(" ") });
    }
  }
  return blocks;
}

export function inline(text) {
  const out = [];
  const re = /\*\*(.+?)\*\*|\*(.+?)\*|_(.+?)_|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ text: text.slice(last, m.index) });
    if (m[1] !== undefined) out.push({ text: m[1], bold: true });
    else if (m[2] !== undefined || m[3] !== undefined) out.push({ text: m[2] ?? m[3], italic: true });
    else if (m[4] !== undefined) out.push({ text: m[4], code: true });
    else out.push({ text: m[5], link: m[6] });
    last = re.lastIndex;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

export function buildDocx(md, opts = {}) {
  const baseDir = opts.baseDir ?? process.cwd();
  const accent = String(opts.accent ?? "1F4E79").replace(/^#/, "").toUpperCase();
  const font = opts.font ?? "Calibri";
  const rels = [];
  const media = [];
  const warnings = [];
  let nums = 1;
  const numDefs = [];
  const relId = () => `rId${rels.length + 10}`;
  const run = (r) => {
    const props = `${r.code ? '<w:rStyle w:val="InlineCode"/>' : ""}${r.link ? '<w:rStyle w:val="Hyperlink"/>' : ""}${r.bold ? "<w:b/>" : ""}${r.italic ? "<w:i/>" : ""}${r.color ? `<w:color w:val="${r.color}"/>` : ""}`;
    const body = `<w:r>${props ? `<w:rPr>${props}</w:rPr>` : ""}<w:t xml:space="preserve">${esc(r.text)}</w:t></w:r>`;
    if (!r.link) return body;
    if (r.link.startsWith("#")) return `<w:hyperlink w:anchor="${esc(r.link.slice(1))}">${body}</w:hyperlink>`;
    const id = relId();
    rels.push(`<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${esc(r.link)}" TargetMode="External"/>`);
    return `<w:hyperlink r:id="${id}">${body}</w:hyperlink>`;
  };
  const para = (text, style, extra = "") => `<w:p><w:pPr>${style ? `<w:pStyle w:val="${style}"/>` : ""}${extra}</w:pPr>${inline(text).map(run).join("")}</w:p>`;
  const body = [];
  if (opts.title) body.push(para(opts.title, "Title"));
  if (opts.subtitle) body.push(para(opts.subtitle, "Subtitle"));
  for (const b of parseMarkdown(md)) {
    switch (b.type) {
      case "heading":
        if (b.level === 1 && !opts.title && !body.length) body.push(para(b.text, "Title"));
        else body.push(para(b.text, `Heading${Math.min(4, b.level)}`));
        break;
      case "para": body.push(para(b.text)); break;
      case "quote": body.push(para(b.text, "Quote")); break;
      case "rule": body.push('<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="BFBFBF"/></w:pBdr></w:pPr></w:p>'); break;
      case "pagebreak": body.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>'); break;
      case "code":
        body.push(...b.text.split("\n").map((l) => `<w:p><w:pPr><w:pStyle w:val="Code"/></w:pPr><w:r><w:t xml:space="preserve">${esc(l)}</w:t></w:r></w:p>`));
        break;
      case "list": {
        const numId = b.ordered ? ++nums : 1;
        if (b.ordered) numDefs.push(numId);
        body.push(...b.items.map((it) => para(it.text, "ListParagraph", `<w:numPr><w:ilvl w:val="${it.level}"/><w:numId w:val="${it.ordered ? numId : 1}"/></w:numPr>`)));
        break;
      }
      case "table": {
        const cols = Math.max(b.header.length, ...b.rows.map((r) => r.length));
        const width = 9360;
        const cell = (t, head) => `<w:tc><w:tcPr><w:tcW w:w="${Math.floor(width / cols)}" w:type="dxa"/>${head ? `<w:shd w:val="clear" w:color="auto" w:fill="${accent}"/>` : ""}</w:tcPr><w:p><w:pPr><w:spacing w:after="0"/></w:pPr>${inline(t ?? "").map((r) => run(head ? { ...r, bold: true, color: "FFFFFF" } : r)).join("")}</w:p></w:tc>`;
        const tr = (r, head) => `<w:tr>${head ? "<w:trPr><w:tblHeader/></w:trPr>" : ""}${Array.from({ length: cols }, (_, c) => cell(r[c], head)).join("")}</w:tr>`;
        body.push(`<w:tbl><w:tblPr><w:tblStyle w:val="GridTable"/><w:tblW w:w="${width}" w:type="dxa"/><w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="0" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/></w:tblPr><w:tblGrid>${Array.from({ length: cols }, () => `<w:gridCol w:w="${Math.floor(width / cols)}"/>`).join("")}</w:tblGrid>${tr(b.header, true)}${b.rows.map((r) => tr(r, false)).join("")}</w:tbl>`, "<w:p/>");
        break;
      }
      case "image": {
        const file = path.resolve(baseDir, b.src);
        if (!fs.existsSync(file)) { warnings.push(`image not found: ${b.src}`); body.push(para(`[missing image: ${b.alt || b.src}]`)); break; }
        const buf = fs.readFileSync(file);
        const info = imageInfo(buf);
        const maxW = 6.5 * 914400;
        const cx = Math.min(maxW, info.w * 9525), cy = Math.round(cx * info.h / info.w);
        const id = relId();
        const name = `image${media.length + 1}.${info.ext}`;
        media.push({ name, data: buf, ext: info.ext });
        rels.push(`<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${name}"/>`);
        const n = media.length;
        body.push(`<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${n}" name="Picture ${n}" descr="${esc(b.alt)}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${n}" name="${name}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${id}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`);
        if (b.alt) body.push(para(b.alt, "Caption"));
        break;
      }
    }
  }
  const sect = '<w:sectPr><w:footerReference w:type="default" r:id="rId4"/><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>';
  const document = `${XML}<w:document ${W_NS}><w:body>${body.join("")}${sect}</w:body></w:document>`;
  const lvl = (i, fmt, text) => `<w:lvl w:ilvl="${i}"><w:start w:val="1"/><w:numFmt w:val="${fmt}"/><w:lvlText w:val="${text}"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="${720 + i * 360}" w:hanging="360"/></w:pPr>${fmt === "bullet" ? '<w:rPr><w:rFonts w:ascii="Symbol" w:hAnsi="Symbol" w:hint="default"/></w:rPr>' : ""}</w:lvl>`;
  const numbering = `${XML}<w:numbering ${W_NS}><w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="hybridMultilevel"/>${[0, 1, 2].map((i) => lvl(i, "bullet", "")).join("")}</w:abstractNum><w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="hybridMultilevel"/>${lvl(0, "decimal", "%1.")}${lvl(1, "lowerLetter", "%2.")}${lvl(2, "lowerRoman", "%3.")}</w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>${numDefs.map((id) => `<w:num w:numId="${id}"><w:abstractNumId w:val="1"/><w:lvlOverride w:ilvl="0"><w:startOverride w:val="1"/></w:lvlOverride></w:num>`).join("")}</w:numbering>`;
  const pStyle = (id, name, ppr, rpr, extra = "") => `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/>${extra}<w:qFormat/><w:pPr>${ppr}</w:pPr><w:rPr>${rpr}</w:rPr></w:style>`;
  const styles = `${XML}<w:styles ${W_NS}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${esc(font)}" w:hAnsi="${esc(font)}" w:eastAsia="${esc(font)}" w:cs="${esc(font)}"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="en-US"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>${pStyle("Title", "Title", '<w:spacing w:after="120"/>', `<w:b/><w:color w:val="${accent}"/><w:sz w:val="52"/>`)}${pStyle("Subtitle", "Subtitle", '<w:spacing w:after="360"/>', '<w:color w:val="595959"/><w:sz w:val="28"/>')}${[1, 2, 3, 4].map((l) => pStyle(`Heading${l}`, `heading ${l}`, `<w:keepNext/><w:spacing w:before="${[360, 280, 200, 160][l - 1]}" w:after="${[120, 100, 80, 60][l - 1]}"/><w:outlineLvl w:val="${l - 1}"/>`, `<w:b/><w:color w:val="${l < 3 ? accent : "262626"}"/><w:sz w:val="${[32, 26, 23, 22][l - 1]}"/>`)).join("")}${pStyle("Quote", "Quote", '<w:ind w:left="567" w:right="567"/><w:pBdr><w:left w:val="single" w:sz="18" w:space="8" w:color="' + accent + '"/></w:pBdr>', '<w:i/><w:color w:val="404040"/>')}${pStyle("Code", "Code", '<w:spacing w:after="0" w:line="240" w:lineRule="auto"/><w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/>', '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/><w:sz w:val="19"/>')}${pStyle("ListParagraph", "List Paragraph", '<w:spacing w:after="60"/><w:contextualSpacing/>', "")}${pStyle("Caption", "caption", '<w:jc w:val="center"/>', '<w:i/><w:color w:val="595959"/><w:sz w:val="18"/>')}<w:style w:type="character" w:styleId="Hyperlink"><w:name w:val="Hyperlink"/><w:rPr><w:color w:val="0563C1"/><w:u w:val="single"/></w:rPr></w:style><w:style w:type="character" w:styleId="InlineCode"><w:name w:val="Inline Code"/><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/></w:rPr></w:style><w:style w:type="table" w:styleId="GridTable"><w:name w:val="Grid Table"/><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4" w:color="BFBFBF"/><w:bottom w:val="single" w:sz="4" w:color="BFBFBF"/><w:insideH w:val="single" w:sz="4" w:color="BFBFBF"/></w:tblBorders><w:tblCellMar><w:top w:w="60" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style></w:styles>`;
  const footer = `${XML}<w:ftr ${W_NS}><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:color w:val="808080"/><w:sz w:val="18"/></w:rPr><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:rPr><w:color w:val="808080"/><w:sz w:val="18"/></w:rPr><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r><w:rPr><w:color w:val="808080"/><w:sz w:val="18"/></w:rPr><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:rPr><w:color w:val="808080"/><w:sz w:val="18"/></w:rPr><w:t>1</w:t></w:r><w:r><w:rPr><w:color w:val="808080"/><w:sz w:val="18"/></w:rPr><w:fldChar w:fldCharType="end"/></w:r></w:p></w:ftr>`;
  const exts = [...new Set(media.map((m) => m.ext))];
  const files = [
    { name: "[Content_Types].xml", data: `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${exts.map((e) => `<Default Extension="${e}" ContentType="image/${e}"/>`).join("")}<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>` },
    { name: "_rels/.rels", data: `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>` },
    { name: "docProps/core.xml", data: `${XML}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${esc(opts.title ?? "")}</dc:title><dc:creator>${esc(opts.author ?? "Codewhale")}</dc:creator></cp:coreProperties>` },
    { name: "docProps/app.xml", data: `${XML}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Codewhale office</Application></Properties>` },
    { name: "word/document.xml", data: document },
    { name: "word/styles.xml", data: styles },
    { name: "word/numbering.xml", data: numbering },
    { name: "word/footer1.xml", data: footer },
    { name: "word/_rels/document.xml.rels", data: `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/><Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>${rels.join("")}</Relationships>` },
    ...media.map((m) => ({ name: `word/media/${m.name}`, data: m.data })),
  ];
  return { buffer: zip(files), warnings, blocks: body.length };
}
