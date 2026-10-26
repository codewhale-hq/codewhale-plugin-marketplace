# Codemap

_354 files. Regenerate with `whalewiki map` — deterministic, no model._

## Languages

- `.md` — 151
- `.mjs` — 92
- `.json` — 49
- `(none)` — 23
- `.js` — 10
- `.toml` — 8
- `.png` — 7
- `.html` — 5
- `.yml` — 2
- `.css` — 2
- `.jsx` — 2
- `.jpg` — 1
- `.sh` — 1
- `.mts` — 1

## Modules

### `./` (7 files)

- `CONTRIBUTING.md`
- `LICENSE`
- `README.md`
- `marketplace.json`
- `package-lock.json`
- `package.json`
- `playwright.config.mjs`

### `.github/` (1 files)

- `CODEOWNERS`

### `.github/workflows/` (1 files)

- `check.yml`

### `assets/` (1 files)

- `codewhale.png`

### `connections/` (1 files)

- `catalog.json`

### `docs/` (6 files)

- `CONNECTIONS.md`
- `MARKETPLACE-REVIEW-20260919.md`
- `REVIEW-BOT.md`
- `SECURITY-20260911.md`
- `VALIDATION-20260911.md`
- `VALIDATION-20261005.md`

### `docs/assets/` (2 files)

- `weixin-bridge-qr-login.png`
- `weixin-bridge-status-verify.jpg`

### `integrations/` (3 files)

- `LICENSE`
- `README.md`
- `upstream.json`

### `integrations/bridge-core/` (1 files)

- `package.json`

### `integrations/bridge-core/src/` (1 files)

- `lib.mjs` — `writeFileDurable`, `ThreadStore`, `ApprovalOwnershipError`, `decideApproval`, `settleStoredApproval`, `envFirst`, `parseList`, `parseBool`, `parseEnvText`, `cleanEnvValue`, `isPlaceholderValue`, `parseTextContent`

### `integrations/bridge-core/test/` (3 files)

- `approvals.test.mjs`
- `lib.test.mjs`
- `recovery-policy.test.mjs`

### `integrations/feishu-bridge/` (3 files)

- `README.md`
- `package-lock.json`
- `package.json`

### `integrations/feishu-bridge/scripts/` (1 files)

- `validate-config.mjs`

### `integrations/feishu-bridge/src/` (2 files)

- `index.mjs`
- `lib.mjs` — `parseTextContent`, `incomingIdentity`, `isAllowed`, `pairingRefusalText`, `stripGroupPrefix`, `commandAction`, `preservedChatStateFields`, `validateBridgeConfig`, `formatValidationReport`, `helpText`

### `integrations/feishu-bridge/test/` (2 files)

- `lib.test.mjs`
- `startup-order.test.mjs`

### `integrations/telegram-bridge/` (3 files)

- `README.md`
- `package-lock.json`
- `package.json`

### `integrations/telegram-bridge/scripts/` (1 files)

- `validate-config.mjs`

### `integrations/telegram-bridge/src/` (2 files)

- `index.mjs`
- `lib.mjs` — `telegramIdentity`, `isGroupChat`, `isAllowed`, `pairingRefusalText`, `stripGroupPrefix`, `parseCommand`, `commandAction`, `controlKeyboard`, `activeTurnKeyboard`, `approvalKeyboard`, `threadListKeyboard`, `callbackAction`

### `integrations/telegram-bridge/test/` (3 files)

- `dispatch-concurrency.test.mjs`
- `lib.test.mjs`
- `startup-order.test.mjs`

### `integrations/webhook-bridge/` (2 files)

- `README.md`
- `package.json`

### `integrations/webhook-bridge/src/` (2 files)

- `index.mjs`
- `lib.mjs` — `parseEvent`, `configFromEnv`, `Inbox`, `dispatch`

### `integrations/webhook-bridge/test/` (1 files)

- `bridge.test.mjs`

### `integrations/wecom-bridge/` (4 files)

- `DEPLOYMENT.md`
- `README.md`
- `package-lock.json`
- `package.json`

### `integrations/wecom-bridge/src/` (2 files)

- `index.mjs`
- `lib.mjs` — `requiredEnv`, `parseTextContent`, `incomingIdentity`, `isAllowed`, `pairingRefusalText`, `stripGroupPrefix`, `isApprovalResponse`, `isDenyResponse`, `commandAction`, `helpText`, `ThreadStore`, `validateBridgeConfig`

### `integrations/wecom-bridge/test/` (1 files)

- `lib.test.mjs`

### `integrations/weixin-bridge/` (2 files)

- `README.md`
- `package.json`

### `integrations/weixin-bridge/scripts/` (1 files)

- `dev-up.sh`

### `integrations/weixin-bridge/src/` (3 files)

- `index.mjs`
- `lib.mjs` — `processUpdateBatch`, `randomUin`, `MessageItemType`, `extractText`, `helpText`, `ILinkLoginBase`, `apiPost`, `apiGet`, `getLoginQR`, `waitForLogin`, `getUpdates`, `sendMessage`
- `qr.mjs` — `encodeQr`, `renderQrToText`

### `integrations/weixin-bridge/test/` (3 files)

- `lib.test.mjs`
- `qr.test.mjs`
- `runtime.test.mjs`

### `plugins/chromewhale/` (6 files)

- `LICENSE`
- `README.md`
- `kimi.plugin.json`
- `mcp.json`
- `package.json`
- `plugin.json`

### `plugins/chromewhale/bin/` (2 files)

- `chromewhale.mjs`
- `native-host.mjs`

### `plugins/chromewhale/commands/` (1 files)

- `chromewhale.md`

### `plugins/chromewhale/extension/` (3 files)

- `manifest.json`
- `panel.css`
- `panel.html`

### `plugins/chromewhale/extension/media/` (5 files)

- `icon-128.png`
- `icon-16.png`
- `icon-32.png`
- `icon-48.png`
- `icon.png`

### `plugins/chromewhale/extension/src/` (9 files)

- `background.js`
- `bridge.js` — `BridgeClient`, `hmacHex`, `BridgeAuthError`, `BridgeImpostorError`, `BridgeSupersededError`, `readyStatus`
- `browser.js` — `createBrowserTools`, `splitDataUrl`
- `native.js` — `NATIVE_HOST`, `NativeClient`
- `page.js` — `snapshotPage`, `inspectRef`, `clickRef`, `typeRef`
- `panel.js`
- `policy.js` — `SENSITIVE_AUTOCOMPLETE`, `SENSITIVE_NAME_SOURCE`, `fieldText`, `classifyTarget`, `decisionFor`, `withDecision`, `sensitiveField`
- `runtime.js` — `RuntimeClient`
- `sse.js` — `SseParser`, `frameData`, `runtimeEvent`, `bridgeFrame`

### `plugins/chromewhale/mcp/` (1 files)

- `server.mjs`

### `plugins/chromewhale/scripts/` (1 files)

- `build-store.mjs` — `buildStoreZip`

### `plugins/chromewhale/skills/chromewhale/` (1 files)

- `SKILL.md`

### `plugins/chromewhale/src/` (7 files)

- `bridge.mjs` — `createBridge`
- `cli.mjs` — `runCli`
- `content.mjs` — `untrusted`, `normalizeContent`
- `install.mjs` — `STORE_EXTENSION_IDS`, `extensionIdFromKey`, `manifestDirs`, `WINDOWS_REGISTRY_KEYS`, `stableNode`, `installHost`, `removeHost`, `registeredBrowsers`
- `native.mjs` — `HOST_NAME`, `encodeMessage`, `MessageReader`, `runNativeHost`
- `pairing.mjs` — `DEFAULT_PORT`, `DEFAULT_HOST`, `stateDir`, `pairingPath`, `resolveEndpoint`, `recordEndpoint`, `readPairing`, `isLoopbackHost`, `tokenMatches`, `bearerOf`, `mac`, `macMatches`
- `tools.mjs` — `SERVER_NAME`, `SNAPSHOT_CHAR_BUDGET`, `CALL_TIMEOUT_MS`, `TOOLS`, `TOOL_NAMES`, `isTool`, `annotationsFor`, `describeCall`

### `plugins/chromewhale/tests/` (11 files)

- `bridge.test.mjs`
- `browser.test.mjs`
- `cli.test.mjs`
- `content.test.mjs`
- `native.test.mjs`
- `page.test.mjs`
- `pairing.test.mjs`
- `policy.test.mjs`
- `server.test.mjs`
- `sse.test.mjs`
- `store.test.mjs`

### `plugins/cloudflare/` (3 files)

- `LICENSE`
- `README.md`
- `plugin.json`

### `plugins/cloudflare-docs/` (4 files)

- `LICENSE`
- `README.md`
- `mcp.json`
- `plugin.json`

### `plugins/cloudflare-docs/skills/cloudflare-docs/` (1 files)

- `SKILL.md`

### `plugins/cloudflare/commands/` (1 files)

- `cloudflare-preflight.md`

### `plugins/cloudflare/scripts/` (1 files)

- `preflight.mjs` — `stripJsonc`, `parseJsonc`, `parseToml`, `findConfigs`, `loadConfig`, `isIgnored`, `checkConfig`, `runPreflight`

### `plugins/cloudflare/skills/cloudflare-deploy/` (1 files)

- `SKILL.md`

### `plugins/cloudflare/skills/cloudflare-durable-objects/` (1 files)

- `SKILL.md`

### `plugins/cloudflare/skills/cloudflare-pages-to-workers/` (1 files)

- `SKILL.md`

### `plugins/cloudflare/skills/cloudflare-storage/` (1 files)

- `SKILL.md`

### `plugins/cloudflare/skills/cloudflare-workers/` (1 files)

- `SKILL.md`

### `plugins/cloudflare/tests/` (2 files)

- `bundle.test.mjs`
- `preflight.test.mjs`

### `plugins/design-review/` (3 files)

- `LICENSE`
- `README.md`
- `plugin.json`

### `plugins/design-review/commands/` (1 files)

- `design-review.md`

### `plugins/design-review/scripts/` (1 files)

- `design-review.mjs` — `parseHtml`, `scanHtml`, `parseColor`, `contrast`, `extractStrings`

### `plugins/design-review/skills/accessibility-audit/` (1 files)

- `SKILL.md`

### `plugins/design-review/skills/ui-critique/` (1 files)

- `SKILL.md`

### `plugins/design-review/skills/ux-copy-review/` (1 files)

- `SKILL.md`

### `plugins/design-review/tests/` (1 files)

- `design-review.test.mjs`

### `plugins/design-review/tests/fixtures/` (2 files)

- `bad.html`
- `good.html`

### `plugins/github-workflow/` (4 files)

- `LICENSE`
- `README.md`
- `mcp.json`
- `plugin.json`

### `plugins/github-workflow/commands/` (1 files)

- `pr.md`

### `plugins/github-workflow/skills/issue-triage/` (1 files)

- `SKILL.md`

### `plugins/github-workflow/skills/pr-review/` (1 files)

- `SKILL.md`

### `plugins/github-workflow/tests/` (1 files)

- `plugin.test.mjs`

### `plugins/linear-workflow/` (4 files)

- `LICENSE`
- `README.md`
- `mcp.json`
- `plugin.json`

### `plugins/linear-workflow/commands/` (1 files)

- `linear.md`

### `plugins/linear-workflow/skills/issue-triage/` (1 files)

- `SKILL.md`

### `plugins/linear-workflow/skills/status-update/` (1 files)

- `SKILL.md`

### `plugins/linear-workflow/tests/` (1 files)

- `plugin.test.mjs`

### `plugins/loop/` (3 files)

- `LICENSE`
- `README.md`
- `plugin.json`

### `plugins/loop/commands/` (3 files)

- `cancel-loop.md`
- `loop-status.md`
- `loop.md`

### `plugins/loop/hooks/` (1 files)

- `loop.toml`

### `plugins/loop/scripts/` (1 files)

- `loop.mjs` — `DEFAULT_MAX`, `HARD_MAX`, `MAX_AGE_MS`, `STALE_MS`, `MAX_PROMPT_CHARS`, `MAX_UNTIL_CHARS`, `parseLoopArgs`, `stateDir`, `statePath`, `validState`, `readState`, `withLock`

### `plugins/loop/skills/iterate-until-done/` (1 files)

- `SKILL.md`

### `plugins/loop/tests/` (2 files)

- `e2e.test.mjs`
- `loop.test.mjs`

### `plugins/review-toolkit/` (3 files)

- `LICENSE`
- `README.md`
- `plugin.json`

### `plugins/review-toolkit/agents/` (6 files)

- `review-comments.toml`
- `review-general.toml`
- `review-silent-failures.toml`
- `review-simplifier.toml`
- `review-test-gaps.toml`
- `review-type-design.toml`

### `plugins/review-toolkit/commands/` (1 files)

- `review-pr.md`

### `plugins/review-toolkit/skills/review-panel/` (1 files)

- `SKILL.md`

### `plugins/review-toolkit/tests/` (1 files)

- `review-toolkit.test.mjs`

### `plugins/samples/` (1 files)

- `README.md`

### `plugins/samples/claude-sample/` (2 files)

- `LICENSE`
- `README.md`

### `plugins/samples/claude-sample/commands/` (1 files)

- `draft-commit.md`

### `plugins/samples/claude-sample/skills/commit-message/` (1 files)

- `SKILL.md`

### `plugins/samples/dsh-sample/` (4 files)

- `LICENSE`
- `README.md`
- `cordis.patch.yml`
- `package.json`

### `plugins/samples/dsh-sample/mcp/` (1 files)

- `server.mjs`

### `plugins/samples/dsh-sample/skills/dsh-sample-notes/` (1 files)

- `SKILL.md`

### `plugins/samples/hello-extension/` (4 files)

- `LICENSE`
- `README.md`
- `hello.mts`
- `plugin.json`

### `plugins/samples/tests/` (1 files)

- `samples.test.mjs`

### `plugins/skills-dev-process/` (4 files)

- `LICENSE`
- `README.md`
- `plugin.json`
- `provenance.json`

### `plugins/skills-dev-process/skills/debug/` (1 files)

- `SKILL.md`

### `plugins/skills-dev-process/skills/handoff/` (1 files)

- `SKILL.md`

### `plugins/skills-dev-process/skills/implement/` (1 files)

- `SKILL.md`

### `plugins/skills-dev-process/skills/interview/` (1 files)

- `SKILL.md`

### `plugins/skills-dev-process/skills/plan/` (1 files)

- `SKILL.md`

### `plugins/skills-dev-process/skills/review/` (1 files)

- `SKILL.md`

### `plugins/skills-dev-process/skills/security-review/` (1 files)

- `SKILL.md`

### `plugins/skills-dev-process/skills/simplify/` (1 files)

- `SKILL.md`

### `plugins/skills-dev-process/skills/test/` (1 files)

- `SKILL.md`

### `plugins/skills-dev-process/skills/verify/` (1 files)

- `SKILL.md`

### `plugins/skills-dev-process/tests/` (1 files)

- `provenance.test.mjs`

### `plugins/skills-docs/` (4 files)

- `LICENSE`
- `README.md`
- `plugin.json`
- `provenance.json`

### `plugins/skills-docs/skills/document/` (1 files)

- `SKILL.md`

### `plugins/skills-docs/skills/docx/` (1 files)

- `SKILL.md`

### `plugins/skills-docs/skills/pdf/` (1 files)

- `SKILL.md`

### `plugins/skills-docs/skills/pptx/` (1 files)

- `SKILL.md`

### `plugins/skills-docs/skills/xlsx/` (1 files)

- `SKILL.md`

### `plugins/skills-docs/tests/` (1 files)

- `provenance.test.mjs`

### `plugins/skills-google/` (4 files)

- `LICENSE`
- `README.md`
- `plugin.json`
- `provenance.json`

### `plugins/skills-google/skills/gmail/` (1 files)

- `SKILL.md`

### `plugins/skills-google/skills/google-calendar/` (1 files)

- `SKILL.md`

### `plugins/skills-google/tests/` (1 files)

- `provenance.test.mjs`

### `plugins/skills-personal/` (4 files)

- `LICENSE`
- `README.md`
- `plugin.json`
- `provenance.json`

### `plugins/skills-personal/skills/flights/` (1 files)

- `SKILL.md`

### `plugins/skills-personal/skills/image-search/` (1 files)

- `SKILL.md`

### `plugins/skills-personal/skills/money/` (1 files)

- `SKILL.md`

### `plugins/skills-personal/skills/photos/` (1 files)

- `SKILL.md`

### `plugins/skills-personal/skills/podcast/` (1 files)

- `SKILL.md`

### `plugins/skills-personal/skills/shopping/` (1 files)

- `SKILL.md`

### `plugins/skills-personal/skills/spotify/` (1 files)

- `SKILL.md`

### `plugins/skills-personal/skills/tts/` (1 files)

- `SKILL.md`

### `plugins/skills-personal/tests/` (1 files)

- `provenance.test.mjs`

### `plugins/vercel-workflow/` (3 files)

- `LICENSE`
- `README.md`
- `plugin.json`

### `plugins/vercel-workflow/commands/` (1 files)

- `vercel-preflight.md`

### `plugins/vercel-workflow/scripts/` (1 files)

- `preflight.mjs` — `isIgnored`, `parseEnvFile`, `checkProject`, `runPreflight`

### `plugins/vercel-workflow/skills/vercel-deploy/` (1 files)

- `SKILL.md`

### `plugins/vercel-workflow/skills/vercel-env-vars/` (1 files)

- `SKILL.md`

### `plugins/vercel-workflow/skills/vercel-logs-debug/` (1 files)

- `SKILL.md`

### `plugins/vercel-workflow/skills/vercel-nextjs-config/` (1 files)

- `SKILL.md`

### `plugins/vercel-workflow/tests/` (2 files)

- `bundle.test.mjs`
- `preflight.test.mjs` — `middleware`

### `plugins/web-artifacts-builder/` (3 files)

- `LICENSE`
- `README.md`
- `plugin.json`

### `plugins/web-artifacts-builder/commands/` (1 files)

- `artifact.md`

### `plugins/web-artifacts-builder/scripts/` (1 files)

- `wab.mjs` — `scaffold`, `checkHtml`, `build`, `startPreview`

### `plugins/web-artifacts-builder/skills/web-artifacts-builder/` (1 files)

- `SKILL.md`

### `plugins/web-artifacts-builder/templates/react/` (3 files)

- `index.html`
- `package.json`
- `vite.config.js`

### `plugins/web-artifacts-builder/templates/react/src/` (3 files)

- `App.jsx` — `App`
- `index.css`
- `main.jsx`

### `plugins/web-artifacts-builder/templates/single/` (1 files)

- `index.html`

### `plugins/web-artifacts-builder/tests/` (1 files)

- `wab.test.mjs`

### `plugins/whalesong/` (4 files)

- `LICENSE`
- `README.md`
- `mcp.json`
- `plugin.json`

### `plugins/whalesong/mcp/` (1 files)

- `server.mjs`

### `plugins/whalesong/skills/whalesong-analyze/` (1 files)

- `SKILL.md`

### `plugins/whalesong/skills/whalesong-annotate/` (1 files)

- `SKILL.md`

### `plugins/whalesong/skills/whalesong-listen/` (1 files)

- `SKILL.md`

### `plugins/whalesong/skills/whalesong-rhythm/` (1 files)

- `SKILL.md`

### `plugins/whalesong/skills/whalesong-triage/` (1 files)

- `SKILL.md`

### `plugins/whalewiki/` (5 files)

- `LICENSE`
- `README.md`
- `kimi.plugin.json`
- `mcp.json`
- `plugin.json`

### `plugins/whalewiki/agents/` (1 files)

- `wiki-keeper.toml`

### `plugins/whalewiki/commands/` (1 files)

- `whalewiki.md`

### `plugins/whalewiki/docs/` (1 files)

- `DESIGN.md`

### `plugins/whalewiki/mcp/` (1 files)

- `server.mjs`

### `plugins/whalewiki/scripts/` (1 files)

- `whalewiki.mjs` — `repoRoot`, `wikiDir`, `readWikiConfig`, `normalizeContent`, `safeFile`, `readWikiFile`, `manifestPath`, `loadManifest`, `sourceRoots`, `pageVerdict`, `statusReport`, `scan`

### `plugins/whalewiki/skills/whalewiki/` (1 files)

- `SKILL.md`

### `plugins/whalewiki/tests/` (3 files)

- `engine.test.mjs` — `greet`, `x`, `Engine`, `moved`, `drift`
- `safety.test.mjs`
- `write-boundaries.test.mjs` — `x`

### `scripts/` (8 files)

- `check-marketplace.mjs`
- `connections.mjs`
- `integrations.mjs`
- `package-plugin.mjs` — `ROOT`, `packagePlugin`
- `skills.mjs`
- `sync-skill-plugins.mjs`
- `test-integrations.mjs`
- `test-plugins.mjs`

### `skills/` (4 files)

- `LICENSE`
- `README.md`
- `plugin.json`
- `upstream.json`

### `skills/batch/` (1 files)

- `SKILL.md`

### `skills/best-of-n/` (1 files)

- `SKILL.md`

### `skills/dataviz/` (1 files)

- `SKILL.md`

### `skills/debug/` (1 files)

- `SKILL.md`

### `skills/delegate/` (1 files)

- `SKILL.md`

### `skills/dependency-update/` (1 files)

- `SKILL.md`

### `skills/document/` (1 files)

- `SKILL.md`

### `skills/documents/` (1 files)

- `SKILL.md`

### `skills/docx/` (1 files)

- `SKILL.md`

### `skills/fleet-manager/` (1 files)

- `SKILL.md`

### `skills/flights/` (1 files)

- `SKILL.md`

### `skills/forget/` (1 files)

- `SKILL.md`

### `skills/frontend-design/` (1 files)

- `SKILL.md`

### `skills/github/` (1 files)

- `SKILL.md`

### `skills/gmail/` (1 files)

- `SKILL.md`

### `skills/goals/` (1 files)

- `SKILL.md`

### `skills/google-calendar/` (1 files)

- `SKILL.md`

### `skills/handoff/` (1 files)

- `SKILL.md`

### `skills/help/` (1 files)

- `SKILL.md`

### `skills/image-search/` (1 files)

- `SKILL.md`

### `skills/implement/` (1 files)

- `SKILL.md`

### `skills/interview/` (1 files)

- `SKILL.md`

### `skills/mcp-builder/` (1 files)

- `SKILL.md`

### `skills/mcp-discovery/` (1 files)

- `SKILL.md`

### `skills/money/` (1 files)

- `SKILL.md`

### `skills/pdf/` (1 files)

- `SKILL.md`

### `skills/photos/` (1 files)

- `SKILL.md`

### `skills/plan/` (1 files)

- `SKILL.md`

### `skills/plugin-creator/` (1 files)

- `SKILL.md`

### `skills/podcast/` (1 files)

- `SKILL.md`

### `skills/pptx/` (1 files)

- `SKILL.md`

### `skills/presentations/` (1 files)

- `SKILL.md`

### `skills/release/` (1 files)

- `SKILL.md`

### `skills/research/` (1 files)

- `SKILL.md`

### `skills/review/` (1 files)

- `SKILL.md`

### `skills/security-review/` (1 files)

- `SKILL.md`

### `skills/shopping/` (1 files)

- `SKILL.md`

### `skills/simplify/` (1 files)

- `SKILL.md`

### `skills/skill-creator/` (1 files)

- `SKILL.md`

### `skills/skill-installer/` (1 files)

- `SKILL.md`

### `skills/spotify/` (1 files)

- `SKILL.md`

### `skills/spreadsheets/` (1 files)

- `SKILL.md`

### `skills/test/` (1 files)

- `SKILL.md`

### `skills/tts/` (1 files)

- `SKILL.md`

### `skills/verify/` (1 files)

- `SKILL.md`

### `skills/webapp-testing/` (1 files)

- `SKILL.md`

### `skills/xlsx/` (1 files)

- `SKILL.md`

### `tests/` (4 files)

- `catalog-wiring.test.mjs`
- `connections.test.mjs`
- `keyword-stoplist.test.mjs`
- `repository.test.mjs` — `value`

### `tests/browser/` (2 files)

- `chromewhale.spec.mjs`
- `viewer.spec.mjs` — `mode`

## Internal edges

- `integrations/bridge-core/test/approvals.test.mjs` → `../src/lib.mjs`, `../../wecom-bridge/src/lib.mjs`
- `integrations/bridge-core/test/lib.test.mjs` → `../src/lib.mjs`
- `integrations/bridge-core/test/recovery-policy.test.mjs` → `../src/lib.mjs`
- `integrations/feishu-bridge/scripts/validate-config.mjs` → `../src/lib.mjs`
- `integrations/feishu-bridge/src/index.mjs` → `./lib.mjs`, `../../bridge-core/src/lib.mjs`
- `integrations/feishu-bridge/src/lib.mjs` → `../../bridge-core/src/lib.mjs`
- `integrations/feishu-bridge/test/lib.test.mjs` → `../src/lib.mjs`
- `integrations/telegram-bridge/scripts/validate-config.mjs` → `../src/lib.mjs`
- `integrations/telegram-bridge/src/index.mjs` → `./lib.mjs`, `../../bridge-core/src/lib.mjs`
- `integrations/telegram-bridge/src/lib.mjs` → `../../bridge-core/src/lib.mjs`
- `integrations/telegram-bridge/test/lib.test.mjs` → `../src/lib.mjs`
- `integrations/webhook-bridge/src/index.mjs` → `./lib.mjs`
- `integrations/webhook-bridge/src/lib.mjs` → `../../bridge-core/src/lib.mjs`
- `integrations/webhook-bridge/test/bridge.test.mjs` → `../src/lib.mjs`
- `integrations/wecom-bridge/src/index.mjs` → `./lib.mjs`, `../../bridge-core/src/lib.mjs`
- `integrations/wecom-bridge/src/lib.mjs` → `../../bridge-core/src/lib.mjs`
- `integrations/wecom-bridge/test/lib.test.mjs` → `../src/lib.mjs`
- `integrations/weixin-bridge/src/index.mjs` → `./lib.mjs`, `./qr.mjs`, `../../bridge-core/src/lib.mjs`
- `integrations/weixin-bridge/src/lib.mjs` → `../../bridge-core/src/lib.mjs`
- `integrations/weixin-bridge/test/lib.test.mjs` → `../../bridge-core/src/lib.mjs`, `../src/lib.mjs`
- `integrations/weixin-bridge/test/qr.test.mjs` → `../src/qr.mjs`
- `plugins/chromewhale/bin/chromewhale.mjs` → `../src/cli.mjs`
- `plugins/chromewhale/bin/native-host.mjs` → `../src/native.mjs`
- `plugins/chromewhale/extension/src/bridge.js` → `./sse.js`
- `plugins/chromewhale/extension/src/browser.js` → `./policy.js`, `./page.js`
- `plugins/chromewhale/extension/src/panel.js` → `./runtime.js`, `./bridge.js`, `./native.js`, `./browser.js`, `./policy.js`
- `plugins/chromewhale/extension/src/runtime.js` → `./sse.js`
- `plugins/chromewhale/mcp/server.mjs` → `../src/bridge.mjs`, `../src/content.mjs`, `../src/pairing.mjs`, `../src/tools.mjs`
- `plugins/chromewhale/src/bridge.mjs` → `./pairing.mjs`, `./tools.mjs`
- `plugins/chromewhale/src/cli.mjs` → `./install.mjs`, `./pairing.mjs`
- `plugins/chromewhale/src/install.mjs` → `./native.mjs`
- `plugins/chromewhale/src/native.mjs` → `../extension/src/bridge.js`, `./pairing.mjs`
- `plugins/chromewhale/tests/bridge.test.mjs` → `../src/bridge.mjs`, `../src/pairing.mjs`
- `plugins/chromewhale/tests/browser.test.mjs` → `../extension/src/browser.js`, `../extension/src/page.js`
- `plugins/chromewhale/tests/cli.test.mjs` → `../src/bridge.mjs`, `../src/pairing.mjs`, `../src/cli.mjs`, `../src/install.mjs`
- `plugins/chromewhale/tests/content.test.mjs` → `../src/content.mjs`
- `plugins/chromewhale/tests/native.test.mjs` → `../src/bridge.mjs`, `../src/native.mjs`, `../src/pairing.mjs`
- `plugins/chromewhale/tests/page.test.mjs` → `../extension/src/page.js`
- `plugins/chromewhale/tests/pairing.test.mjs` → `../src/pairing.mjs`
- `plugins/chromewhale/tests/policy.test.mjs` → `../extension/src/policy.js`
- `plugins/chromewhale/tests/server.test.mjs` → `../src/tools.mjs`
- `plugins/chromewhale/tests/sse.test.mjs` → `../extension/src/sse.js`
- `plugins/chromewhale/tests/store.test.mjs` → `../scripts/build-store.mjs`
- `plugins/cloudflare/tests/preflight.test.mjs` → `../scripts/preflight.mjs`
- `plugins/design-review/tests/design-review.test.mjs` → `../scripts/design-review.mjs`
- `plugins/loop/tests/loop.test.mjs` → `../scripts/loop.mjs`
- `plugins/vercel-workflow/tests/preflight.test.mjs` → `../scripts/preflight.mjs`
- `plugins/web-artifacts-builder/templates/react/src/main.jsx` → `./App.jsx`
- `plugins/web-artifacts-builder/tests/wab.test.mjs` → `../scripts/wab.mjs`, `./theme.css`
- `plugins/whalewiki/mcp/server.mjs` → `../scripts/whalewiki.mjs`
- `plugins/whalewiki/tests/engine.test.mjs` → `../index`, `../index`
- `plugins/whalewiki/tests/safety.test.mjs` → `../scripts/whalewiki.mjs`
- `tests/browser/chromewhale.spec.mjs` → `../../plugins/chromewhale/src/install.mjs`
- `tests/browser/viewer.spec.mjs` → `../../plugins/whalewiki/scripts/whalewiki.mjs`
- `tests/catalog-wiring.test.mjs` → `../scripts/package-plugin.mjs`
- `tests/repository.test.mjs` → `../scripts/package-plugin.mjs`
