#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const env = (k) => (process.env[k] ?? "").trim();

const OPENAI_API = "https://api.openai.com/v1";
const DASHSCOPE_API = "https://dashscope-intl.aliyuncs.com";
const CREDENTIAL_HOSTS = { OPENAI_API_KEY: "api.openai.com", DASHSCOPE_API_KEY: "dashscope-intl.aliyuncs.com" };
const MAX_JSON_BYTES = 96 * 1024 * 1024;
const MAX_IMAGE_BYTES = 64 * 1024 * 1024;
const MAX_VIDEO_BYTES = 512 * 1024 * 1024;

const ASPECTS = ["1:1", "16:9", "9:16", "4:3", "3:4"];
const OPENAI_SIZE = { "1:1": "1024x1024", "16:9": "1536x1024", "4:3": "1536x1024", "9:16": "1024x1536", "3:4": "1024x1536" };
const QWEN_SIZE = { "1:1": "2048*2048", "16:9": "2688*1536", "9:16": "1536*2688", "4:3": "2368*1728", "3:4": "1728*2368" };

const ALIBABA_PRICING = { url: "https://www.alibabacloud.com/help/en/model-studio/model-pricing", read: "2026-10-28", region: "International (Singapore)" };
const QWEN_PRICE = {
  "qwen-image-2.0": { image: 0.035 },
  "qwen-image-2.0-pro": { image: 0.075 },
  "qwen-image-3.0": { image: 0.03, input_image: 0.003 },
  "qwen-image-3.0-pro": { image: 0.075, input_image: 0.003 },
};
const WAN_PRICE = {
  "wan3.0-video": { "480P": 0.05, "720P": 0.1, "1080P": 0.2 },
  "wan3.0-video-prime": { "480P": 0.068, "720P": 0.14, "1080P": 0.28 },
  "wan2.7-t2v": { "720P": 0.1, "1080P": 0.15 },
  "wan2.7-i2v": { "720P": 0.1, "1080P": 0.15 },
};

export const PROVIDERS = {
  openai: {
    label: "OpenAI Images",
    key: "OPENAI_API_KEY",
    image: { default: "gpt-image-2", models: ["gpt-image-2", "gpt-image-1.5", "gpt-image-1-mini"], references: true },
    price: "unknown: Studio does not estimate OpenAI image charges; token usage and provider billing determine the actual cost",
    price_source: null,
    hosts: ["api.openai.com (fixed; the key is sent nowhere else)"],
    verified: "request shape follows OpenAI's documented Images API (generations; edits with image[] files); no live call made from this plugin",
  },
  dashscope: {
    label: "Alibaba Cloud Model Studio (DashScope, international)",
    key: "DASHSCOPE_API_KEY",
    image: { default: "qwen-image-2.0", models: Object.keys(QWEN_PRICE), references: true, referenceModel: "qwen-image-edit" },
    video: { default: "wan3.0-video", models: Object.keys(WAN_PRICE), resolutions: ["480P", "720P", "1080P"], maxSeconds: 30 },
    price: "Published list prices per image (2K output) and per second of video are used for estimates; wan3.0-video shows a limited-time 30% discount, so the estimate is the undiscounted list price. Studio does not estimate qwen-image-edit or wan2.7 at 480P, so it reports those costs as unknown. Free quotas (Singapore only, 90 days): 100 images for qwen-image-2.0/-pro, 10 for qwen-image-3.0/-pro, 30 s for wan3.0, 50 s for wan2.7",
    price_source: ALIBABA_PRICING,
    hosts: ["dashscope-intl.aliyuncs.com (fixed; the key is sent nowhere else)", "unauthenticated result downloads from *.aliyuncs.com only"],
    verified: "qwen-image text-to-image matches Model Studio's documented synchronous API; reference editing (qwen-image-edit) and the Wan async video fields follow the DashScope video-synthesis pattern and are unverified until a live call",
  },
  placeholder: {
    label: "Local placeholder (free, offline)",
    key: null,
    image: { default: "placeholder", models: ["placeholder"], references: true },
    video: { default: "placeholder", models: ["placeholder"], resolutions: ["480P", "720P", "1080P"], maxSeconds: 30 },
    price: "free: draws a flat PNG or, with ffmpeg, a still clip, so a pipeline can be tested before any paid call. Not a real generation",
    price_source: null,
    hosts: [],
    verified: "local only",
  },
};

let allowed = Object.keys(PROVIDERS);
export function setProviders(list) {
  for (const id of list) if (!PROVIDERS[id]) throw new Error(`unknown provider '${id}'`);
  allowed = list;
}

const serverFor = (id) => (id === "placeholder" ? "studio" : `studio-${id === "dashscope" ? "alibaba" : id}`);

export function listModels() {
  return Object.entries(PROVIDERS).map(([id, p]) => ({
    provider: id, label: p.label, server: serverFor(id), key_env: p.key,
    image_models: p.image?.models ?? [], video_models: p.video?.models ?? [], reference_images: Boolean(p.image?.references),
    price: p.price, price_source: p.price_source, network: p.hosts, verified: p.verified,
  }));
}

function pickProvider(kind, requested) {
  if (requested) {
    const p = PROVIDERS[requested];
    if (!p) throw new Error(`unknown provider '${requested}' (use ${Object.keys(PROVIDERS).join(", ")})`);
    if (!p[kind]) throw new Error(`${requested} has no ${kind} models in this plugin`);
    if (!allowed.includes(requested)) throw new Error(`provider '${requested}' is served by the ${serverFor(requested)} MCP server, not this one`);
    return requested;
  }
  const available = allowed.filter((id) => PROVIDERS[id][kind]);
  if (available.length === 1) return available[0];
  const preferred = (kind === "video" ? ["dashscope"] : ["openai", "dashscope"]).filter((id) => available.includes(id));
  if (preferred.length === 1) return preferred[0];
  const found = preferred.find((id) => env(PROVIDERS[id].key));
  if (!found) throw new Error(`no ${kind} provider key is available here. Use the studio-openai or studio-alibaba server with your own OPENAI_API_KEY or DASHSCOPE_API_KEY, or pass provider "placeholder" to test the pipeline for free`);
  return found;
}

function credential(keyEnv, url) {
  const endpoint = new URL(url);
  const host = endpoint.hostname;
  if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password || endpoint.port) throw new Error(`refusing unsafe credential endpoint`);
  if (CREDENTIAL_HOSTS[keyEnv] !== host) throw new Error(`refusing to send ${keyEnv} to ${host}`);
  const value = env(keyEnv);
  if (!value) throw new Error(`${keyEnv} is not set in the server environment`);
  return `Bearer ${value}`;
}

const realInside = (root, target) => target === root || target.startsWith(root + path.sep);

function trustedRoot(ctx) {
  if (!ctx?.root) throw new Error("no trusted workspace: Codewhale has not given this server a workspace root, so Studio writes nothing");
  return ctx.root;
}

function resolveOut(ctx, outDir) {
  const root = trustedRoot(ctx);
  const rel = outDir ?? "media";
  if (typeof rel !== "string" || path.isAbsolute(rel)) throw new Error("out_dir must be a path relative to the workspace");
  const parts = path.normalize(rel).split(path.sep).filter((p) => p && p !== ".");
  if (!parts.length || parts.includes("..")) throw new Error("out_dir must name a directory inside the workspace");
  let cur = root;
  for (const part of parts) {
    cur = path.join(cur, part);
    const st = fs.lstatSync(cur, { throwIfNoEntry: false });
    if (st?.isSymbolicLink()) throw new Error(`out_dir component is a symbolic link: ${path.relative(root, cur)}`);
    if (st && !st.isDirectory()) throw new Error(`out_dir component is not a directory: ${path.relative(root, cur)}`);
    if (!st) fs.mkdirSync(cur);
  }
  const real = fs.realpathSync(cur);
  if (!realInside(root, real) || real === root) throw new Error("out_dir must stay inside the workspace");
  return real;
}

function inputFile(ctx, file, label) {
  if (typeof file !== "string" || !file) throw new Error(`${label} must be a file path`);
  const root = trustedRoot(ctx);
  if (path.isAbsolute(file)) throw new Error(`${label} must be a path relative to the workspace`);
  let real;
  try { real = fs.realpathSync(path.resolve(root, file)); } catch { throw new Error(`${label} not found: ${file}`); }
  if (!realInside(root, real)) throw new Error(`${label} must be inside the workspace (symbolic links out of it are refused): ${file}`);
  if (!fs.statSync(real).isFile()) throw new Error(`${label} is not a file: ${file}`);
  return real;
}

const createFlags = () => fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | (fs.constants.O_NOFOLLOW ?? 0);
function writeNew(file, data) {
  const fd = fs.openSync(file, createFlags(), 0o644);
  try { fs.writeFileSync(fd, data); } finally { fs.closeSync(fd); }
}

const NAME_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "media";
const stamp = () => new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-");
const sha256 = (buf) => crypto.createHash("sha256").update(buf).digest("hex");
const newBase = (a) => `${stamp()}-${crypto.randomBytes(3).toString("hex")}-${slug(a.name ?? a.prompt)}`;

function validatePrompt(a) {
  if (typeof a?.prompt !== "string" || !a.prompt.trim()) throw new Error("prompt is required");
  if (a.prompt.length > 4000) throw new Error("prompt is over 4000 characters");
  if (a.negative_prompt !== undefined && (typeof a.negative_prompt !== "string" || a.negative_prompt.length > 500)) throw new Error("negative_prompt must be text of at most 500 characters");
  if (a.seed !== undefined && !(Number.isInteger(Number(a.seed)) && Number(a.seed) >= 0 && Number(a.seed) <= 2147483647)) throw new Error("seed must be an integer from 0 to 2147483647");
  if (a.model !== undefined && !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(String(a.model))) throw new Error("model must be a plain model id");
  if (a.name !== undefined && !NAME_RE.test(String(a.name))) throw new Error("name must be lowercase letters, digits and hyphens (max 40)");
}

function readImage(file, ctx) {
  if (/^https:\/\//.test(file)) return { url: file };
  if (!ctx?.root) throw new Error("local reference images are unavailable in MCP dry runs until confined file authority is available");
  const p = inputFile(ctx, file, "image");
  if (fs.statSync(p).size > 20 * 1024 * 1024) throw new Error(`${file} is over 20 MiB`);
  const buf = fs.readFileSync(p);
  const mime = buf.length > 12 && buf.readUInt32BE(0) === 0x89504e47 ? "image/png" : buf[0] === 0xff && buf[1] === 0xd8 ? "image/jpeg" : buf.toString("ascii", 8, 12) === "WEBP" ? "image/webp" : null;
  if (!mime) throw new Error(`${file}: reference images must be PNG, JPEG or WebP`);
  return { path: p, buf, mime };
}

async function readCapped(res, cap, label) {
  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > cap) throw new Error(`${label}: response of ${declared} bytes is over the ${cap}-byte limit`);
  const chunks = [];
  let total = 0;
  for await (const chunk of res.body ?? []) {
    total += chunk.length;
    if (total > cap) throw new Error(`${label}: response is over the ${cap}-byte limit`);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function http(url, init, label, timeoutMs = 180000) {
  let res, raw;
  try {
    res = await fetch(url, { ...init, redirect: "error", signal: AbortSignal.timeout(timeoutMs) });
    raw = await readCapped(res, MAX_JSON_BYTES, label);
  } catch (e) {
    if (String(e.message).includes("-byte limit")) throw e;
    throw new Error(`${label}: request failed (${e.cause?.code ?? e.cause?.name ?? e.name}: ${e.message})`);
  }
  let body; try { body = JSON.parse(raw.toString("utf8")); } catch { body = { raw: raw.toString("utf8", 0, 400) }; }
  if (!res.ok || body.code) {
    const msg = body.error?.message ?? body.message ?? body.raw ?? res.statusText;
    throw new Error(`${label}: HTTP ${res.status}${body.code ? ` ${String(body.code).slice(0, 60)}` : ""}: ${String(msg).slice(0, 400)}`);
  }
  return { body, requestId: res.headers.get("x-request-id") ?? body.request_id ?? null };
}

async function downloadTo(url, file, cap) {
  let u;
  try { u = new URL(url); } catch { throw new Error("provider returned an invalid result URL"); }
  if (u.protocol !== "https:") throw new Error("refusing non-https result URL");
  if (u.username || u.password || u.port) throw new Error("refusing result URL with credentials or a non-default port");
  if (!(u.hostname === "aliyuncs.com" || u.hostname.endsWith(".aliyuncs.com"))) throw new Error(`refusing result URL on unexpected host ${u.hostname}`);
  const res = await fetch(u, { redirect: "error", signal: AbortSignal.timeout(300000) });
  if (!res.ok) throw new Error(`download failed: HTTP ${res.status}`);
  if (Number(res.headers.get("content-length") ?? 0) > cap) throw new Error(`result is over the ${cap}-byte limit`);
  const fd = fs.openSync(file, createFlags(), 0o644);
  const hash = crypto.createHash("sha256");
  let total = 0;
  try {
    for await (const chunk of res.body ?? []) {
      total += chunk.length;
      if (total > cap) throw new Error(`result is over the ${cap}-byte limit`);
      hash.update(chunk);
      fs.writeFileSync(fd, chunk);
    }
  } catch (error) {
    throw new Error(`download failed: ${error.message}; partial file preserved at ${file}`);
  } finally {
    fs.closeSync(fd);
  }
  return { file, bytes: total, sha256: hash.digest("hex") };
}

function writeReceipt(dir, base, receipt, outputs) {
  const receiptFile = path.join(dir, `${base}.json`);
  writeNew(receiptFile, JSON.stringify({ ...receipt, outputs, created_at: new Date().toISOString() }, null, 2) + "\n");
  return receiptFile;
}

function writeBuffers(dir, base, buffers, ext) {
  return buffers.map((buf, i) => {
    const file = path.join(dir, `${base}${buffers.length > 1 ? `-${i + 1}` : ""}.${ext}`);
    writeNew(file, buf);
    return { file, bytes: buf.length, sha256: sha256(buf) };
  });
}

export function placeholderPng(width, height, seedText = "") {
  const h = sha256(Buffer.from(seedText));
  const c1 = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  const c2 = [parseInt(h.slice(6, 8), 16), parseInt(h.slice(8, 10), 16), parseInt(h.slice(10, 12), 16)];
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (width * 3 + 1);
    for (let x = 0; x < width; x++) {
      const t = (x + y) / (width + height);
      const frame = x < 8 || y < 8 || x >= width - 8 || y >= height - 8;
      for (let k = 0; k < 3; k++) raw[row + 1 + x * 3 + k] = frame ? 255 : Math.round(c1[k] * (1 - t) + c2[k] * t);
    }
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

function refusePaidGeneration() {
  throw new Error("paid call not sent: Studio paid generation is disabled until Codewhale provides a verified human approval path. Use dry_run for estimates and provider \"placeholder\" for the pipeline");
}

function imageEstimate(provider, model, n, refs) {
  if (provider === "placeholder") return 0;
  if (provider === "dashscope" && QWEN_PRICE[model]) return n * QWEN_PRICE[model].image + refs * (QWEN_PRICE[model].input_image ?? 0);
  return null;
}

export async function generateImage(a, ctx) {
  validatePrompt(a);
  const aspect = a.aspect ?? "1:1";
  if (!ASPECTS.includes(aspect)) throw new Error(`aspect must be one of ${ASPECTS.join(", ")}`);
  const n = Number(a.n ?? 1);
  if (!Number.isInteger(n) || n < 1 || n > 4) throw new Error("n must be an integer from 1 to 4");
  const provider = pickProvider("image", a.provider);
  const p = PROVIDERS[provider];
  const refList = a.reference_images ?? [];
  if (!Array.isArray(refList) || refList.length > 8) throw new Error("reference_images must be a list of at most 8 files");
  const refs = refList.map((f) => readImage(f, ctx));
  const model = String(a.model ?? (refs.length && p.image.referenceModel ? p.image.referenceModel : p.image.default));
  const quality = a.quality ?? "medium";
  if (provider === "openai" && !["low", "medium", "high"].includes(quality)) throw new Error("quality must be low, medium or high");
  if (a.background !== undefined && !["auto", "transparent", "opaque"].includes(a.background)) throw new Error("background must be auto, transparent or opaque");
  const estimate = imageEstimate(provider, model, n, refs.length);
  let request;
  if (provider === "openai") {
    request = { url: `${OPENAI_API}/images/${refs.length ? "edits" : "generations"}`, body: { model, prompt: a.prompt, size: OPENAI_SIZE[aspect], quality, n, ...(a.background ? { background: a.background } : {}) }, references: refs.map((r) => r.path ?? r.url) };
  } else if (provider === "dashscope") {
    const content = [...refs.map((r) => ({ image: r.url ?? `data:${r.mime};base64,${r.buf.toString("base64")}` })), { text: a.prompt }];
    request = { url: `${DASHSCOPE_API}/api/v1/services/aigc/multimodal-generation/generation`, body: { model, input: { messages: [{ role: "user", content }] }, parameters: { size: QWEN_SIZE[aspect], n, prompt_extend: a.prompt_extend !== false, watermark: false, ...(a.negative_prompt ? { negative_prompt: a.negative_prompt } : {}), ...(a.seed !== undefined ? { seed: Number(a.seed) } : {}) } } };
  } else {
    request = { local: true, aspect, n };
  }
  const quote = { provider, model, estimated_cost_usd: estimate === null ? null : Number(estimate.toFixed(4)), price: estimate === null ? "unknown" : provider === "placeholder" ? "free" : "published list price", price_source: p.price_source, paid: provider !== "placeholder" };
  const shown = JSON.parse(JSON.stringify(request, (k, v) => (k === "image" && typeof v === "string" && v.startsWith("data:") ? `${v.slice(0, 32)}…(${v.length} chars)` : v)));
  if (a.dry_run) return { dry_run: true, ...quote, key_env: p.key, request: shown };
  if (quote.paid) refusePaidGeneration();
  const dir = resolveOut(ctx, a.out_dir);
  const base = newBase(a);
  let files, requestId = null, revised = null;
  if (provider === "openai") {
    let init;
    if (refs.length) {
      const form = new FormData();
      for (const [k, v] of Object.entries(request.body)) form.append(k, String(v));
      refs.forEach((r, i) => { if (!r.buf) throw new Error("OpenAI edits need local reference files, not URLs"); form.append("image[]", new Blob([r.buf], { type: r.mime }), `ref-${i}.${r.mime.split("/")[1]}`); });
      init = { method: "POST", headers: { Authorization: credential(p.key, request.url) }, body: form };
    } else init = { method: "POST", headers: { Authorization: credential(p.key, request.url), "Content-Type": "application/json" }, body: JSON.stringify(request.body) };
    const r = await http(request.url, init, "OpenAI Images");
    requestId = r.requestId;
    const buffers = (r.body.data ?? []).slice(0, n).map((d) => Buffer.from(String(d.b64_json ?? ""), "base64")).filter((b) => b.length && b.length <= MAX_IMAGE_BYTES);
    if (!buffers.length) throw new Error("OpenAI returned no images");
    files = writeBuffers(dir, base, buffers, "png");
    revised = r.body.data?.[0]?.revised_prompt ?? null;
  } else if (provider === "dashscope") {
    const r = await http(request.url, { method: "POST", headers: { Authorization: credential(p.key, request.url), "Content-Type": "application/json" }, body: JSON.stringify(request.body) }, "Model Studio image");
    requestId = r.requestId;
    const urls = (r.body.output?.choices ?? []).flatMap((c) => (c.message?.content ?? []).map((x) => x.image)).filter((u) => typeof u === "string").slice(0, n);
    if (!urls.length) throw new Error("Model Studio returned no images");
    files = [];
    for (const [i, u] of urls.entries()) files.push(await downloadTo(u, path.join(dir, `${base}${urls.length > 1 ? `-${i + 1}` : ""}.png`), MAX_IMAGE_BYTES));
  } else {
    const [w, h] = { "1:1": [1024, 1024], "16:9": [1536, 864], "9:16": [864, 1536], "4:3": [1280, 960], "3:4": [960, 1280] }[aspect];
    files = writeBuffers(dir, base, Array.from({ length: n }, (_, i) => placeholderPng(w, h, `${a.prompt}#${i}`)), "png");
  }
  const receipt = writeReceipt(dir, base, { kind: "image", ...quote, prompt: a.prompt, revised_prompt: revised, aspect, n, quality: provider === "openai" ? quality : undefined, references: refs.map((r) => r.path ?? r.url), request_id: requestId, placeholder: provider === "placeholder" || undefined }, files);
  return { ...quote, files, receipt };
}

const ffmpeg = () => spawnSync("ffmpeg", ["-version"], { encoding: "utf8" }).status === 0;
const runFfmpeg = (args) => spawnSync("ffmpeg", args, { encoding: "utf8", timeout: 600000, maxBuffer: 4 * 1024 * 1024 });

export async function generateVideo(a, ctx) {
  validatePrompt(a);
  const provider = pickProvider("video", a.provider);
  const p = PROVIDERS[provider];
  const model = String(a.model ?? p.video.default);
  const resolution = String(a.resolution ?? "720P").toUpperCase();
  if (!p.video.resolutions.includes(resolution)) throw new Error(`resolution must be one of ${p.video.resolutions.join(", ")}`);
  const duration = Number(a.duration ?? 5);
  if (!Number.isInteger(duration) || duration < 2 || duration > p.video.maxSeconds) throw new Error(`duration must be a whole number of seconds from 2 to ${p.video.maxSeconds}`);
  const first = a.image ? readImage(a.image, ctx) : null;
  const rate = provider === "dashscope" ? WAN_PRICE[model]?.[resolution] : 0;
  const estimate = provider === "placeholder" ? 0 : rate === undefined ? null : duration * rate;
  const quote = { provider, model, estimated_cost_usd: estimate === null ? null : Number(estimate.toFixed(3)), price: estimate === null ? "unknown" : provider === "placeholder" ? "free" : "published list price", price_source: p.price_source, paid: provider !== "placeholder" };
  const request = provider === "dashscope"
    ? { url: `${DASHSCOPE_API}/api/v1/services/aigc/video-generation/video-synthesis`, headers: { "X-DashScope-Async": "enable" }, body: { model, input: { prompt: a.prompt, ...(first ? { img_url: first.url ?? `data:${first.mime};base64,${first.buf.toString("base64")}` } : {}), ...(a.negative_prompt ? { negative_prompt: a.negative_prompt } : {}) }, parameters: { resolution, duration, prompt_extend: a.prompt_extend !== false, watermark: false, ...(a.seed !== undefined ? { seed: Number(a.seed) } : {}) } } }
    : { local: true, resolution, duration, image: first?.path ?? null };
  const shown = JSON.parse(JSON.stringify(request, (k, v) => (k === "img_url" && String(v).startsWith("data:") ? `${v.slice(0, 32)}…(${v.length} chars)` : v)));
  if (a.dry_run) return { dry_run: true, ...quote, key_env: p.key, request: shown };
  if (quote.paid) refusePaidGeneration();
  const dir = resolveOut(ctx, a.out_dir);
  const base = newBase(a);
  const receipt = { kind: "video", ...quote, prompt: a.prompt, resolution, duration, first_frame: first?.path ?? first?.url ?? null };
  if (provider === "placeholder") {
    if (!ffmpeg()) throw new Error("the placeholder video needs ffmpeg on PATH");
    const h = { "480P": 480, "720P": 720, "1080P": 1080 }[resolution];
    const w = Math.round((h * 16) / 9 / 2) * 2;
    let still = first?.path;
    if (!still) { still = path.join(dir, `${base}-frame.png`); writeNew(still, placeholderPng(w, h, a.prompt)); }
    const file = path.join(dir, `${base}.mp4`);
    const r = runFfmpeg(["-n", "-loglevel", "error", "-loop", "1", "-i", still, "-t", String(duration), "-vf", `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2,zoompan=z='min(zoom+0.0015,1.2)':d=${duration * 25}:s=${w}x${h},format=yuv420p`, "-r", "25", file]);
    if (r.status !== 0) throw new Error(`ffmpeg failed: ${String(r.stderr ?? r.error?.message ?? "").trim().slice(0, 300)}`);
    const buf = fs.readFileSync(file);
    const files = [{ file, bytes: buf.length, sha256: sha256(buf) }];
    return { ...quote, status: "SUCCEEDED", files, receipt: writeReceipt(dir, base, { ...receipt, placeholder: true }, files) };
  }
  const r = await http(request.url, { method: "POST", headers: { Authorization: credential(p.key, request.url), "Content-Type": "application/json", ...request.headers }, body: JSON.stringify(request.body) }, "Model Studio video");
  const taskId = r.body.output?.task_id;
  if (typeof taskId !== "string" || !/^[A-Za-z0-9-]{1,128}$/.test(taskId)) throw new Error("Model Studio returned no valid task_id");
  const jobName = `${base}.job.json`;
  writeNew(path.join(dir, jobName), JSON.stringify({ provider, task_id: taskId, base, receipt: { ...receipt, request_id: r.requestId, task_id: taskId } }, null, 2) + "\n");
  const job = { status: "PENDING", ...quote, task_id: taskId, job_file: jobName };
  return a.wait === false ? { ...job, next: "call video_status with this job_file and the same out_dir" } : videoStatus({ out_dir: a.out_dir, job_file: jobName, wait_seconds: a.wait_seconds ?? 240 }, ctx);
}

export async function videoStatus(a, ctx) {
  if (typeof a?.job_file !== "string") throw new Error("job_file is required");
  if (!allowed.includes("dashscope")) throw new Error("video_status is served by the studio-alibaba MCP server");
  const dir = resolveOut(ctx, a.out_dir);
  const m = /^(\d{8}-\d{6}-[0-9a-f]{6}-[a-z0-9-]{1,40})\.job\.json$/.exec(path.basename(a.job_file));
  if (!m || path.basename(a.job_file) !== a.job_file) throw new Error("job_file must be the .job.json name that generate_video returned");
  const jobFile = path.join(dir, a.job_file);
  const st = fs.lstatSync(jobFile, { throwIfNoEntry: false });
  if (!st || !st.isFile() || st.isSymbolicLink() || st.size > 64 * 1024) throw new Error(`no job file ${a.job_file} in ${dir}`);
  let job;
  try { job = JSON.parse(fs.readFileSync(jobFile, "utf8")); } catch { throw new Error("job file is not valid JSON"); }
  if (job.provider !== "dashscope" || typeof job.task_id !== "string" || !/^[A-Za-z0-9-]{1,128}$/.test(job.task_id) || job.base !== m[1]) throw new Error("job file does not match a Studio video job");
  const mp4 = path.join(dir, `${m[1]}.mp4`);
  if (fs.lstatSync(mp4, { throwIfNoEntry: false })) throw new Error(`output already exists and cannot be verified: ${mp4}`);
  const waitSeconds = Number(a.wait_seconds ?? 0);
  if (!Number.isFinite(waitSeconds) || waitSeconds < 0) throw new Error("wait_seconds must be a non-negative number");
  const deadline = Date.now() + Math.min(600, waitSeconds) * 1000;
  const url = `${DASHSCOPE_API}/api/v1/tasks/${encodeURIComponent(job.task_id)}`;
  for (;;) {
    const r = await http(url, { method: "GET", headers: { Authorization: credential(PROVIDERS.dashscope.key, url) } }, "Model Studio task", 60000);
    const status = r.body.output?.task_status ?? "UNKNOWN";
    if (status === "SUCCEEDED") {
      const result = r.body.output?.video_url ?? r.body.output?.results?.[0]?.url;
      if (typeof result !== "string") throw new Error("task succeeded without a video_url");
      const files = [await downloadTo(result, mp4, MAX_VIDEO_BYTES)];
      const receiptSrc = job.receipt && typeof job.receipt === "object" ? job.receipt : {};
      return { status, provider: job.provider, files, receipt: writeReceipt(dir, m[1], { ...receiptSrc, usage: r.body.usage ?? null }, files) };
    }
    if (["FAILED", "CANCELED", "UNKNOWN"].includes(status)) return { status, provider: job.provider, task_id: job.task_id, error: String(r.body.output?.message ?? r.body.output?.code ?? "").slice(0, 400) || null };
    if (Date.now() >= deadline) return { status, provider: job.provider, task_id: job.task_id, job_file: a.job_file, next: "still running; call video_status again" };
    await new Promise((res) => setTimeout(res, 8000));
  }
}

export function assembleVideo(a, ctx) {
  if (!ffmpeg()) throw new Error("assemble_video needs ffmpeg on PATH");
  if (!Array.isArray(a.clips) || a.clips.length < 1 || a.clips.length > 50) throw new Error("clips needs 1 to 50 video files");
  if (a.name !== undefined && !NAME_RE.test(String(a.name))) throw new Error("name must be lowercase letters, digits and hyphens (max 40)");
  const clips = a.clips.map((c) => inputFile(ctx, c, "clip"));
  const audio = a.audio ? inputFile(ctx, a.audio, "audio") : null;
  const size = String(a.size ?? "1280x720");
  const sm = /^(\d{3,4})x(\d{3,4})$/.exec(size);
  if (!sm || +sm[1] % 2 || +sm[2] % 2 || +sm[1] > 3840 || +sm[2] > 3840) throw new Error("size must be WIDTHxHEIGHT with even numbers up to 3840");
  const [w, h] = [+sm[1], +sm[2]];
  const dir = resolveOut(ctx, a.out_dir);
  const file = path.join(dir, `${newBase({ name: a.name ?? "cut" })}.mp4`);
  const inputs = clips.flatMap((c) => ["-i", c]);
  const norm = clips.map((_, i) => `[${i}:v]scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=25,format=yuv420p[v${i}]`).join(";");
  const filter = `${norm};${clips.map((_, i) => `[v${i}]`).join("")}concat=n=${clips.length}:v=1:a=0[out]`;
  const args = ["-n", "-loglevel", "error", ...inputs];
  if (audio) args.push("-i", audio);
  args.push("-filter_complex", filter, "-map", "[out]");
  if (audio) args.push("-map", `${clips.length}:a`, "-shortest");
  args.push("-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", file);
  const r = runFfmpeg(args);
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${String(r.stderr ?? r.error?.message ?? "").trim().slice(0, 400)}`);
  const probe = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], { encoding: "utf8", timeout: 60000 });
  return { file, clips: clips.length, seconds: Number(probe.stdout?.trim()) || null, size: `${w}x${h}` };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [cmd, ...rest] = process.argv.slice(2);
  const a = {};
  for (let i = 0; i < rest.length; i++) {
    if (!rest[i].startsWith("--")) continue;
    const k = rest[i].slice(2).replace(/-/g, "_");
    const v = rest[i + 1] === undefined || rest[i + 1].startsWith("--") ? true : rest[++i];
    a[k] = k === "reference_images" || k === "clips" ? [...(a[k] ?? []), v] : ["n", "seed", "duration", "wait_seconds"].includes(k) ? Number(v) : v;
  }
  if (a.wait === "false") a.wait = false;
  if (a.workspace !== undefined) { console.error("error: the CLI writes under its current directory; there is no --workspace option"); process.exit(2); }
  const ctx = { root: fs.realpathSync(process.cwd()) };
  const run = { models: async () => listModels(), image: () => generateImage(a, ctx), video: () => generateVideo(a, ctx), status: () => videoStatus(a, ctx), assemble: async () => assembleVideo(a, ctx) }[cmd];
  if (!run) { console.log("usage (run from the workspace; outputs go under ./media): media.mjs models | image --prompt P [--provider placeholder|openai|dashscope] [--aspect 16:9] [--reference-images f] [--dry-run] | video --prompt P [--image f] [--resolution 720P] [--duration 5] [--dry-run] | assemble --clips a.mp4 --clips b.mp4 [--audio m.mp3]. Paid providers accept only --dry-run here."); process.exit(cmd ? 2 : 0); }
  run().then((r) => console.log(JSON.stringify(r, null, 2))).catch((e) => { console.error(`error: ${e.message}`); process.exit(1); });
}
