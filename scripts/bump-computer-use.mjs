#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const ROOT = path.dirname(path.dirname(url.fileURLToPath(import.meta.url)));
const REPO = "codewhale-hq/codewhale-cu-plugin";

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    if (key === "check-current") {
      args.checkCurrent = true;
      continue;
    }
    const val = argv[++i];
    if (val === undefined) throw new Error(`Missing value for --${key}`);
    args[key] = val;
  }
  return args;
}

function writeOutputs(pairs) {
  for (const [k, v] of Object.entries(pairs)) {
    if (/[\r\n]/.test(String(k)) || /[\r\n]/.test(String(v))) {
      throw new Error(`Refusing newline in workflow output: ${k}`);
    }
  }
  const outPath = process.env.GITHUB_OUTPUT;
  if (!outPath) return;
  const lines = Object.entries(pairs).map(([k, v]) => `${k}=${v}`);
  fs.appendFileSync(outPath, `${lines.join("\n")}\n`, "utf8");
}

function compareSemver(a, b) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i];
  }
  return 0;
}

function parseSha256Sums(sumsText, filename) {
  let found = null;
  for (const raw of sumsText.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const match = /^([a-f0-9]{64})\s+\*?(.+)$/.exec(line);
    if (match && match[2].trim() === filename) {
      if (found && found !== match[1]) {
        throw new Error(`Duplicate conflicting SHA256SUMS entries for ${filename}`);
      }
      found = match[1];
    }
  }
  return found;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const tag = args.tag || "";
  if (!/^v[0-9]+\.[0-9]+\.[0-9]+$/.test(tag)) {
    throw new Error(`Invalid release tag: '${tag}'`);
  }
  const version = tag.slice(1);
  const releaseUrl = `https://github.com/${REPO}/releases/download/${tag}/computer-use.tar.gz`;
  const catalogPath = path.resolve(args.catalog || path.join(ROOT, "marketplace.json"));
  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  const entry = (catalog.plugins || []).find((p) => p.name === "computer-use");
  if (!entry) throw new Error("computer-use entry not found in catalog");

  const oldVersion = entry.version || "";
  if (/^[0-9]+\.[0-9]+\.[0-9]+$/.test(oldVersion) && compareSemver(version, oldVersion) < 0) {
    throw new Error(`Refusing downgrade: release ${version} is older than pinned ${oldVersion}`);
  }

  if (args.checkCurrent) {
    const isCurrent = entry.version === version && entry.source === releaseUrl;
    writeOutputs({
      current: isCurrent ? "true" : "false",
    });
    console.log(isCurrent ? "already current" : `update needed: ${oldVersion} -> ${version}`);
    return;
  }

  if (!args.tarball || !args.sums || !args.assets || !args.digest) {
    throw new Error("Required arguments: --tarball, --sums, --assets, --digest");
  }
  const assets = JSON.parse(args.assets);
  if (!Array.isArray(assets)) throw new Error("--assets must be a JSON array");

  const tarballBytes = fs.readFileSync(args.tarball);
  const computedSha = crypto.createHash("sha256").update(tarballBytes).digest("hex");
  const expectedSha = parseSha256Sums(fs.readFileSync(args.sums, "utf8"), "computer-use.tar.gz");
  if (!expectedSha) throw new Error("Missing computer-use.tar.gz entry in SHA256SUMS.txt");
  if (computedSha !== expectedSha) {
    throw new Error(`SHA256 mismatch: computed ${computedSha}, expected ${expectedSha}`);
  }
  const expectedDigest = args.digest.startsWith("sha256:") ? args.digest.slice(7) : "";
  if (!/^[a-f0-9]{64}$/.test(expectedDigest) || computedSha !== expectedDigest) {
    throw new Error(`Release API digest mismatch: computed ${computedSha}, api ${args.digest}`);
  }

  const platformAssets = assets.filter(
    (name) =>
      typeof name === "string" &&
      /\.(tar\.gz|tgz|zip)$/i.test(name) &&
      /(macos|darwin|windows|win32|linux)/i.test(name)
  );
  const currentPlatforms = Array.isArray(entry.platforms) ? entry.platforms.join(", ") : "";

  entry.source = releaseUrl;
  entry.version = version;
  entry.sha256 = computedSha;

  writeOutputs({
    sha256: computedSha,
    old_version: oldVersion,
    new_version: version,
    source_url: releaseUrl,
    current_platforms: currentPlatforms,
    platform_assets: platformAssets.join(", "),
  });
  fs.writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
  console.log(`Updated computer-use: ${oldVersion} -> ${version}`);
  console.log(`sha256: ${computedSha}`);
  console.log(`platforms (unchanged): ${currentPlatforms}`);
  console.log(`release platform assets: ${platformAssets.join(", ")}`);
}

main();
