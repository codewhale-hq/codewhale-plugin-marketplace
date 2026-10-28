#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { buildPptx } from "./pptx.mjs";
import { buildXlsx, colName } from "./xlsx.mjs";
import { buildDocx } from "./docx.mjs";
import { unzip } from "./zip.mjs";
import { parseCsv } from "./csv.mjs";
import { profile, profileMarkdown, pivot, chartSvg } from "./analyze.mjs";

const USAGE = `office.mjs — build and check Office files with Node only.

  slides  <deck.json> --out deck.pptx        JSON deck → PowerPoint (layouts: title, section, bullets,
                                             two-column, image, image-right, quote, stats, table, bars, closing)
  sheet   <book.json|data.csv> --out f.xlsx  JSON workbook or CSV → Excel with types, formulas, totals
  doc     <doc.md> --out f.docx [--title T] [--subtitle S] [--accent #RRGGBB] [--font F]
  text    <file.pptx|docx|xlsx>              extract the text of an Office file (to read or verify one)
  render  <file> [--out dir] [--dpi 60]      LibreOffice → PDF → PNG pages + contact sheet, for visual QA
  recalc  <file.xlsx> [--out dir]            LibreOffice recalculation → one CSV per sheet with formula results
  profile <data.csv> [--json]                column types, missing values, stats, outliers, duplicates
  pivot   <data.csv> --by col[,col] [--value col] [--agg sum|mean|median|min|max|count] [--top N]
  chart   <data.csv> --x col --y col[,col] [--type bar|line] [--title T] --out chart.svg [--png]

Exit codes: 0 ok, 1 built with warnings or a failed check, 2 bad input.`;

function args(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      out[key] = argv[i + 1] === undefined || argv[i + 1].startsWith("--") ? true : argv[++i];
    } else out._.push(a);
  }
  return out;
}

const fail = (msg, code = 2) => { console.error(`error: ${msg}`); process.exit(code); };
const need = (v, name) => (v && v !== true ? v : fail(`missing ${name}`));
const readJson = (file) => { try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch (e) { fail(`${file}: ${e.message}`); } };
const write = (file, data) => { fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true }); fs.writeFileSync(file, data); };

function soffice() {
  for (const c of ["soffice", "libreoffice", "/Applications/LibreOffice.app/Contents/MacOS/soffice"]) {
    const r = spawnSync(c, ["--version"], { encoding: "utf8" });
    if (r.status === 0) return c;
  }
  return null;
}

function convert(file, format, outDir) {
  const bin = soffice();
  if (!bin) fail("LibreOffice (soffice) is not installed; install it to render or recalculate, or open the file in Office and look", 1);
  const profileDir = fs.mkdtempSync(path.join(outDir, ".lo-profile-"));
  const started = Date.now() - 1000;
  const r = spawnSync(bin, [`-env:UserInstallation=file://${profileDir}`, "--headless", "--convert-to", format, "--outdir", outDir, file], { encoding: "utf8", timeout: 180000 });
  fs.rmSync(profileDir, { recursive: true, force: true });
  const made = fs.readdirSync(outDir).filter((f) => !f.startsWith(".lo-profile-") && fs.statSync(path.join(outDir, f)).mtimeMs >= started);
  if (r.status !== 0 || !made.length) fail(`LibreOffice produced no output (exit ${r.status ?? r.signal ?? r.error?.code}). If this runs inside a sandbox, LibreOffice may be blocked from starting; run the check outside it or open the file in Office and look.${(r.stderr || "").trim() ? `\n${r.stderr.trim()}` : ""}`, 1);
  return made;
}

function extractText(file) {
  const parts = unzip(fs.readFileSync(file));
  const xmlText = (xml, tag) => [...xml.matchAll(new RegExp(`<${tag}(?: [^>]*)?>([^<]*)</${tag}>`, "g"))].map((m) => decode(m[1]));
  const decode = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
  const ext = path.extname(file).toLowerCase();
  if (ext === ".pptx") {
    const slides = [...parts.keys()].filter((k) => /^ppt\/slides\/slide\d+\.xml$/.test(k)).sort((a, b) => parseInt(a.match(/\d+/)) - parseInt(b.match(/\d+/)));
    return slides.map((k, i) => `--- slide ${i + 1} ---\n` + parts.get(k).toString("utf8").split(/<\/a:p>/).map((p) => xmlText(p, "a:t").join("")).filter(Boolean).join("\n")).join("\n");
  }
  if (ext === ".docx") {
    const doc = parts.get("word/document.xml")?.toString("utf8") ?? fail("no word/document.xml");
    return doc.split(/<\/w:p>/).map((p) => xmlText(p, "w:t").join("")).filter(Boolean).join("\n");
  }
  if (ext === ".xlsx") {
    const shared = parts.get("xl/sharedStrings.xml")?.toString("utf8").split(/<\/si>/).map((si) => xmlText(si, "t").join("")) ?? [];
    const wb = parts.get("xl/workbook.xml").toString("utf8");
    const names = [...wb.matchAll(/<sheet [^>]*name="([^"]+)"/g)].map((m) => decode(m[1]));
    const rels = parts.get("xl/_rels/workbook.xml.rels")?.toString("utf8") ?? "";
    const ids = [...wb.matchAll(/<sheet [^>]*r:id="([^"]+)"/g)].map((m) => m[1]);
    return names.map((name, i) => {
      const target = new RegExp(`Id="${ids[i]}"[^>]*Target="([^"]+)"`).exec(rels)?.[1] ?? `worksheets/sheet${i + 1}.xml`;
      const xml = parts.get(`xl/${target.replace(/^\/?xl\//, "")}`)?.toString("utf8") ?? "";
      const rows = [...xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)].map((row) => [...row[1].matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)].map((c) => {
        const attrs = c[2], inner = c[3] ?? "";
        const f = /<f>([^<]*)<\/f>/.exec(inner)?.[1];
        const v = /<v>([^<]*)<\/v>/.exec(inner)?.[1];
        const val = /t="s"/.test(attrs) ? shared[Number(v)] : /t="inlineStr"/.test(attrs) ? xmlText(inner, "t").join("") : v ?? "";
        return `${c[1]}=${f ? `=${decode(f)}` : decode(val ?? "")}`;
      }).join("\t"));
      return `--- sheet ${name} ---\n${rows.join("\n")}`;
    }).join("\n");
  }
  fail("text supports .pptx, .docx and .xlsx");
}

function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const a = args(rest);
  const input = a._[0];
  if (!cmd || cmd === "help" || a.help) { console.log(USAGE); return; }
  if (!input) fail(`missing input file\n\n${USAGE}`);
  if (!fs.existsSync(input)) fail(`no such file: ${input}`);
  switch (cmd) {
    case "slides": {
      const out = need(a.out, "--out deck.pptx");
      let r;
      try { r = buildPptx(readJson(input), path.dirname(path.resolve(input))); } catch (e) { fail(e.message); }
      write(out, r.buffer);
      if (r.notes) write(out.replace(/\.pptx$/i, "") + ".notes.md", r.notes);
      console.log(`wrote ${out}: ${r.slides} slides, ${(r.buffer.length / 1024).toFixed(1)} KiB${r.notes ? ` (+ speaker notes in ${out.replace(/\.pptx$/i, "")}.notes.md)` : ""}`);
      for (const w of r.warnings) console.log(`warning: ${w}`);
      process.exitCode = r.warnings.length ? 1 : 0;
      break;
    }
    case "sheet": {
      const out = need(a.out, "--out book.xlsx");
      let book;
      if (/\.(csv|tsv|txt)$/i.test(input)) {
        const { header, rows } = parseCsv(fs.readFileSync(input, "utf8"), /\.tsv$/i.test(input) ? "\t" : undefined);
        book = { sheets: [{ name: path.basename(input).replace(/\.\w+$/, ""), columns: header.map((h) => ({ header: h })), rows }] };
      } else book = readJson(input);
      let r;
      try { r = buildXlsx(book); } catch (e) { fail(e.message); }
      write(out, r.buffer);
      console.log(`wrote ${out}: ${r.sheets.map((s) => `${s.name} (${s.rows} rows × ${s.columns} cols, A1:${colName(s.columns - 1)}${s.rows + 1})`).join("; ")}`);
      break;
    }
    case "doc": {
      const out = need(a.out, "--out doc.docx");
      let r;
      try { r = buildDocx(fs.readFileSync(input, "utf8"), { title: a.title, subtitle: a.subtitle, accent: a.accent, font: a.font, baseDir: path.dirname(path.resolve(input)) }); } catch (e) { fail(e.message); }
      write(out, r.buffer);
      console.log(`wrote ${out}: ${r.blocks} blocks, ${(r.buffer.length / 1024).toFixed(1)} KiB`);
      for (const w of r.warnings) console.log(`warning: ${w}`);
      process.exitCode = r.warnings.length ? 1 : 0;
      break;
    }
    case "text":
      console.log(extractText(input));
      break;
    case "render": {
      const outDir = path.resolve(a.out && a.out !== true ? a.out : path.join(path.dirname(input), `${path.basename(input).replace(/\.\w+$/, "")}-render`));
      fs.mkdirSync(outDir, { recursive: true });
      let pdf = path.resolve(input);
      if (!/\.pdf$/i.test(input)) { convert(path.resolve(input), "pdf", outDir); pdf = path.join(outDir, path.basename(input).replace(/\.\w+$/, ".pdf")); }
      const r = spawnSync("pdftoppm", ["-png", "-r", String(a.dpi ?? 60), pdf, path.join(outDir, "page")], { encoding: "utf8" });
      if (r.error) { console.log(`wrote ${pdf}; install poppler (pdftoppm) for PNG pages`); break; }
      const pages = fs.readdirSync(outDir).filter((f) => /^page-\d+\.png$/.test(f)).sort();
      if (!pages.length) fail(`no pages rendered from ${pdf}; the visual check did not happen`, 1);
      const sheet = path.join(outDir, "contact-sheet.png");
      const m = spawnSync("magick", ["montage", ...pages.map((p) => path.join(outDir, p)), "-tile", "4x", "-geometry", "+6+6", "-background", "#9CA3AF", sheet], { encoding: "utf8" });
      console.log(`rendered ${pages.length} page(s) to ${outDir}${m.status === 0 ? `; contact sheet ${sheet}` : ""}\nLook at every page image before calling the file done.`);
      break;
    }
    case "recalc": {
      const outDir = path.resolve(a.out && a.out !== true ? a.out : path.join(path.dirname(input), `${path.basename(input).replace(/\.\w+$/, "")}-recalc`));
      fs.mkdirSync(outDir, { recursive: true });
      const csvs = convert(path.resolve(input), 'csv:Text - txt - csv (StarCalc):44,34,76,1,,0,false,true,false,false,false,-1', outDir).filter((f) => f.endsWith(".csv")).sort();
      if (!csvs.length) fail("LibreOffice wrote no CSV; formulas are unverified", 1);
      let errors = 0;
      for (const f of csvs) {
        const body = fs.readFileSync(path.join(outDir, f), "utf8");
        const bad = body.match(/#(REF!|VALUE!|NAME\?|DIV\/0!|N\/A|NUM!|NULL!)/g) ?? [];
        errors += bad.length;
        console.log(`--- ${f}${bad.length ? ` (${bad.length} formula error(s): ${[...new Set(bad)].join(", ")})` : ""} ---\n${body.split("\n").slice(0, Number(a.rows ?? 40)).join("\n")}`);
      }
      console.log(`${csvs.length} sheet(s) recalculated in ${outDir}; ${errors} formula error(s)`);
      process.exitCode = errors ? 1 : 0;
      break;
    }
    case "profile": {
      const p = profile(fs.readFileSync(input, "utf8"));
      console.log(a.json ? JSON.stringify(p, null, 2) : profileMarkdown(p, path.basename(input)));
      break;
    }
    case "pivot":
      try { process.stdout.write(pivot(fs.readFileSync(input, "utf8"), { by: need(a.by, "--by").split(","), value: a.value === true ? undefined : a.value, agg: a.agg, top: a.top ? Number(a.top) : undefined, sort: a.sort })); } catch (e) { fail(e.message); }
      break;
    case "chart": {
      const out = need(a.out, "--out chart.svg");
      let r;
      try { r = chartSvg(fs.readFileSync(input, "utf8"), { x: need(a.x, "--x"), y: need(a.y, "--y").split(","), type: a.type, title: a.title === true ? "" : a.title, color: a.color }); } catch (e) { fail(e.message); }
      write(out, r.svg);
      let png = "";
      if (a.png) {
        const target = out.replace(/\.svg$/i, "") + ".png";
        const m = spawnSync("magick", ["-density", "144", out, target], { encoding: "utf8" });
        png = m.status === 0 ? `; ${target}` : "; PNG needs ImageMagick (magick)";
      }
      console.log(`wrote ${out}: ${r.points} points${png}`);
      break;
    }
    default:
      fail(`unknown command '${cmd}'\n\n${USAGE}`);
  }
}

main();
