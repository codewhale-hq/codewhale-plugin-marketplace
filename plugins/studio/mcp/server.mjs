#!/usr/bin/env node
import { listModels, generateImage, generateVideo, setProviders } from "../scripts/media.mjs";

const flag = process.argv.indexOf("--providers");
const PROVIDERS = flag > 0 ? process.argv[flag + 1].split(",") : ["placeholder"];
const SERVER = PROVIDERS.includes("placeholder") ? "studio" : `studio-${PROVIDERS[0] === "dashscope" ? "alibaba" : PROVIDERS[0]}`;
setProviders(PROVIDERS);

const PROTOCOL_VERSION = "2025-06-18";
const workspace = { type: "string", description: "Reserved for future confined workspace access; MCP file operations are disabled." };
const common = {
  workspace,
  out_dir: { type: "string", description: "Output directory relative to the workspace (default media)." },
  name: { type: "string", description: "Short file name stem, e.g. hero-shot." },
  dry_run: { type: "boolean", description: "Preview the request and cost estimate without calling the provider, writing or spending anything. Local reference files are unavailable over MCP." },
};

const TOOLS = [
  {
    name: "media_models",
    description: "List image and video models, dated price estimates, network destinations and request-shape verification. Previews do not need provider keys. Call this before choosing a model or quoting a cost.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "generate_image",
    description: "Preview image requests and cost estimates for OpenAI or Alibaba. Paid generation is disabled pending a verified human approval path. File generation over MCP is disabled pending confined file authority.",
    inputSchema: { type: "object", properties: {
      prompt: { type: "string" },
      provider: { type: "string", enum: ["openai", "dashscope", "placeholder"] },
      model: { type: "string" },
      aspect: { type: "string", enum: ["1:1", "16:9", "9:16", "4:3", "3:4"] },
      n: { type: "integer", minimum: 1, maximum: 4 },
      quality: { type: "string", enum: ["low", "medium", "high"], description: "OpenAI only." },
      background: { type: "string", enum: ["auto", "transparent", "opaque"], description: "OpenAI only." },
      reference_images: { type: "array", maxItems: 8, items: { type: "string" }, description: "HTTPS URLs for previews; local reference files are unavailable over MCP." },
      negative_prompt: { type: "string", description: "dashscope only." },
      seed: { type: "integer" },
      ...common,
    }, required: ["prompt"] },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
  },
  {
    name: "generate_video",
    description: "Preview Alibaba video requests and cost estimates. Paid generation is disabled pending a verified human approval path. File generation over MCP is disabled pending confined file authority.",
    inputSchema: { type: "object", properties: {
      prompt: { type: "string" },
      provider: { type: "string", enum: ["dashscope", "placeholder"] },
      model: { type: "string" },
      image: { type: "string", description: "HTTPS URL for previews; local reference files are unavailable over MCP." },
      resolution: { type: "string", enum: ["480P", "720P", "1080P"] },
      duration: { type: "integer", minimum: 2, maximum: 30 },
      negative_prompt: { type: "string" },
      seed: { type: "integer" },
      wait: { type: "boolean" },
      wait_seconds: { type: "integer", minimum: 0, maximum: 600 },
      ...common,
    }, required: ["prompt"] },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
  },
  {
    name: "video_status",
    description: "Disabled over MCP until confined file authority is available.",
    inputSchema: { type: "object", properties: { job_file: { type: "string", description: "The job_file name returned by generate_video." }, wait_seconds: { type: "integer", minimum: 0, maximum: 600 }, workspace, out_dir: common.out_dir }, required: ["job_file"] },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
  },
  {
    name: "assemble_video",
    description: "Disabled over MCP until confined file authority is available.",
    inputSchema: { type: "object", properties: {
      clips: { type: "array", minItems: 1, maxItems: 50, items: { type: "string" } },
      audio: { type: "string" },
      size: { type: "string", description: "WIDTHxHEIGHT, default 1280x720; 1080x1920 for vertical." },
      workspace, out_dir: common.out_dir, name: common.name,
    }, required: ["clips"] },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  },
];
const IMAGE = PROVIDERS.filter((p) => ["openai", "dashscope", "placeholder"].includes(p));
const VIDEO = PROVIDERS.filter((p) => ["dashscope", "placeholder"].includes(p));
const ACTIVE = TOOLS.filter((t) => {
  if (t.name === "generate_image") return IMAGE.length;
  if (t.name === "generate_video") return VIDEO.length;
  if (t.name === "video_status") return PROVIDERS.includes("dashscope");
  return SERVER === "studio";
});
for (const t of ACTIVE) {
  t.inputSchema.additionalProperties = false;
  if (t.inputSchema.properties.provider) t.inputSchema.properties.provider.enum = t.name === "generate_video" ? VIDEO : IMAGE;
}

const text = (v) => ({ content: [{ type: "text", text: typeof v === "string" ? v : JSON.stringify(v, null, 2) }] });

async function callTool(name, args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) throw new Error("arguments must be an object");
  if (name === "media_models") return text({ host: { mcp_file_operations_enabled: false, paid_generation_enabled: false }, providers: listModels() });
  if ((name !== "generate_image" && name !== "generate_video") || args.dry_run !== true) {
    throw new Error("MCP file operations and paid generation are disabled until Codewhale provides confined file authority and verified human approval; use dry_run for estimates");
  }
  const ctx = { root: null };
  if (name === "generate_image") return text(await generateImage(args, ctx));
  return text(await generateVideo(args, ctx));
}

async function handle(msg) {
  if (!msg || typeof msg !== "object" || Array.isArray(msg) || msg.jsonrpc !== "2.0" || typeof msg.method !== "string") {
    return { id: null, error: { code: -32600, message: "Invalid Request" } };
  }
  const { id, method, params } = msg;
  if (id === undefined) return null;
  switch (method) {
    case "initialize":
      return { id, result: {
        protocolVersion: ["2024-11-05", "2025-03-26", "2025-06-18"].includes(params?.protocolVersion) ? params.protocolVersion : PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: SERVER, version: "0.1.0" },
      } };
    case "ping": return { id, result: {} };
    case "tools/list": return { id, result: { tools: ACTIVE } };
    case "tools/call":
      try { return { id, result: await callTool(params?.name, params?.arguments || {}) }; }
      catch (error) { return { id, result: { content: [{ type: "text", text: `studio error: ${error.message}` }], isError: true } }; }
    default: return { id, error: { code: -32601, message: `method not supported: ${method}` } };
  }
}

let buffer = "", discarding = false;
const emit = (res) => process.stdout.write(JSON.stringify({ jsonrpc: "2.0", ...res }) + "\n");
async function lineReceived(line) {
  if (!line.trim()) return;
  let msg;
  try { msg = JSON.parse(line); } catch { emit({ id: null, error: { code: -32700, message: "Parse error" } }); return; }
  const res = await handle(msg);
  if (res) emit(res);
}
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  for (const [index, part] of chunk.split("\n").entries()) {
    if (index > 0) {
      if (!discarding) lineReceived(buffer);
      buffer = ""; discarding = false;
    }
    if (discarding) continue;
    if (Buffer.byteLength(buffer) + Buffer.byteLength(part) > 256 * 1024) {
      buffer = ""; discarding = true;
      emit({ id: null, error: { code: -32600, message: "Request exceeds 256 KiB" } });
    } else buffer += part;
  }
});
process.stdin.on("end", () => { if (buffer && !discarding) lineReceived(buffer); });
