# Choose and ship an extension

This repository's catalog lists nineteen installable bundles. The first six are
Computer Use, Codewhale for Chrome, WhaleSong, WhaleWiki, Cloudflare docs and the
bundled Codewhale skills. The October 2026 wave added thirteen more (see
"What the October wave added"). The catalog declares
local or remote sources, stable IDs, human-readable names and versions. An entry offers installation; it does not grant
capabilities or establish a service login.

Computer Use (`computer-use`) is an independently released plugin. Its catalog
entry points to the canonical repository's stable
[plugin archive](https://github.com/codewhale-hq/codewhale-cu-plugin/releases/latest/download/computer-use.tar.gz).
Codewhale's ordinary installer downloads and reviews that bundle; its Update
action checks the same source. This repository carries no copy of the runtime
and does not build or test it. The offline catalog check validates the source
syntax, not the remote bytes or publication status.

The separate native Mac helper owns OS permissions and the visible computer
controls. Use the [setup page](https://codewhale.net/computer-use),
[canonical guidance](https://github.com/codewhale-hq/codewhale-cu-plugin/blob/main/README.md)
and [release checklist](https://github.com/codewhale-hq/codewhale-cu-plugin/blob/main/docs/RELEASE_CHECKLIST.md)
for the current installation steps, trust behavior and platform qualification.
Catalog version metadata alone does not establish release availability.

Codewhale for Chrome (formerly Chromewhale; the plugin id and `/chromewhale` commands keep that name) source 0.4.0 is an unreleased developer preview that also drives a browser, with a separate profile boundary.
Computer Use owns a Chromium instance it launches under its own
`--user-data-dir` and states that the person's own profile is never attached
to, typed into or closed; Codewhale for Chrome acts on selected tabs and frames in the person's own profile and sessions. `page_tabs` selects or creates a background task tab;
`page_frames` finds embedded content, with consent checked for each origin.
Actions require an opaque snapshot handle bound to the MCP session, tab, frame
and document. Changing the foreground does not redirect an action; navigation
invalidates the observed document. Only the creating session can close a task
tab. The panel displays the target and lets the person explicitly change it. The vocabularies are
kept apart for that reason: `browser_*` for the self-owned instance, `page_*`
for the person's. Codewhale for Chrome's tools live in its MCP server rather than in the
Chrome extension it ships, so they reach the model through the ordinary tool
path and the bundle's trust review; a client that registered them with the
Runtime directly would carry `ApprovalRequirement::Auto` and reach no approval
gate. `/chromewhale setup` copies the extension to a stable path outside the
content-hashed staged root, where it is loaded unpacked (a manifest `key`
fixes its ID), and installs a per-user Native Messaging connector that Chrome,
Chromium, Edge and Brave start for that ID only. The connector holds the
pairing token and dials the loopback bridge — a Chrome extension cannot listen
on a socket — so nothing is pasted and the token never enters the browser; a
pasted port and token remain the fallback. The bridge refuses web origins and
foreign `Host` headers. Pairing is challenge-response: both
ends prove they hold the token with HMACs over single-use nonces and neither
ever sends it, so a program squatting on the port can neither learn it nor
drive the panel. Several Codewhale sessions share one bridge port: the first
server owns it and later ones forward to it, taking over when the owner exits
without re-running a call the old owner may have started. Calls carry
deadlines and host cancellations reach the panel, so a late click never acts
on a call the model was told had failed. Everything read off a page travels in an
untrusted-content envelope whose markers carry a per-block random nonce. A
per-origin decision in the side panel (defaulting to this browser session),
Chrome's own optional host permission, a confirming click before any form
submit, and a refusal to type into password, one-time-code or payment-card
fields sit under that. The server also supplies its packaged skill through standard initialization
and a fixed resource. Automated tests cover the server, signed bridge, native
pairing and unpacked extension against real Chromium with disposable profiles
and local fixtures. The harness opens the panel page separately and supplies
its window identity. This does not establish ordinary toolbar onboarding, a
provider-led task, Chrome Store availability or packaged-app acceptance. DOM
clicks remain synthetic; sites requiring trusted input need further work.

Catalog artwork is inline PNG, bounded to
32 KiB and 256 by 256 pixels; browsing a listing never fetches an icon URL.

## Choose a home

| Surface | Responsibility | Example |
| --- | --- | --- |
| `plugins/` | Reviewed tools, commands or skills that complete a useful task | WhaleWiki's repository read tools |
| `connections/` | Official endpoints and host-owned authentication guidance | Linear's read-only MCP setup |
| `integrations/` | External messages connected to the existing runtime | Telegram polling and signed webhook intake |
| `skills/` | Reusable agent workflows with a separate Core mirror owner | Review, handoff and implementation workflows |

A URL alone does not earn an installable plugin. See
[Connections and inbound requests](integrations.md) for service setup and bot
boundaries. An adapter must reuse Codewhale's runtime, approvals and model
selection; adding another model loop or credential store splits that ownership.

## What the October wave added

Review toolkit (six read-only reviewer profiles and `/review-pr`), Loop
(`/loop` with a hard cap and `/cancel-loop`; macOS and Linux, needs the control
socket), GitHub workflow and Linear workflow (skills over each service's remote
MCP with a token you supply), Cloudflare and Vercel workflow (skills plus an
offline preflight script; deploys wait for approval), Web artifacts builder,
Design review, four domain skill plugins (`skills-docs`, `skills-google`,
`skills-personal`, `skills-dev-process`) and one native TypeScript sample,
`hello-extension`. The GitHub, Linear and Vercel plugins carry a `-workflow`
suffix because their bare names are connection-recipe ids, and a test keeps
recipe ids out of the catalog.

The domain skill plugins are byte copies of files in `skills/`. Their
`provenance.json` pins the same Core commit, and `npm run sync:skills` refreshes
them through `scripts/sync-skill-plugins.mjs`; `npm run check:skill-plugins`
fails on drift. Each plugin's own tests run from `npm test` by discovery
(`scripts/test-plugins.mjs`), so a new plugin cannot ship tests that are never
run. `tests/catalog-wiring.test.mjs` checks that qualified skill references name
the plugin that really ships the skill. Two samples, `claude-sample` and
`dsh-sample`, stay out of the catalog because the packaging tooling does not yet
recognise their formats.

## Package before review

From a development checkout, run `npm run package:plugin -- whalewiki` or select
another local catalog name. Remote release entries are packaged upstream. `packagePlugin` reads Git's working source inventory,
excludes ignored local artifacts and deleted files, refuses symlinks, and rejects
a bundle over 5 MiB. It creates `dist/<name>` and refuses to overwrite it.
Use `--out /another/directory` when building a later revision.

Review the packaged capabilities before trusting and enabling them. The
packager excludes local artifacts; installation remains a host operation.

## Find a skill by the job you need done

The [skill directory](../../skills/README.md) groups 47 generation-18 Core skills into
software work, research/documents, everyday tasks and agent extension. Run
`npm run skills -- email` or `npm run skills -- audio` for a filtered list.
Each skill installs as `codewhale-skills:<name>`; accounts, tools and permissions
are separate prerequisites.

The active set comes from Core's catalog matrix, not every retained asset
folder. `skills/upstream.json` records its source commit and hashes. The mirror
includes supporting resources and excludes old generation bodies. Repository
skills (`feedback`, `contributor-onboarding`), optional Feishu and retired v4
instructions do not become current defaults merely because their files remain
in Core for migration.

After committing a reviewed Core update, `npm run sync:skills` refreshes the
mirror and directory. It refuses dirty source assets or locally edited skill
content. `npm run check` validates pinned bytes; adding `-- --core ../codewhale`
also catches upstream changes to membership, wording or resources.

## Evidence before readiness

Run `npm run check` and `npm test && npm run check:web`. The catalog check covers
manifest identity, declared remote hosts and skill metadata. Unit and protocol
tests cover implementation behavior; browser tests exercise the wiki reader and Chrome extension.
The catalog check also rejects generic manifest keywords, listed in the check
itself: everyday words such as browser, web and wiki, and Codewhale's own
vocabulary such as agent, MCP, model, session and tool. Keywords feed
Codewhale's plugin offers, and a request about Codewhale itself is not a reason
to offer a vendor's plugin.
The repository wiki has its own `npm run check:wiki` source-drift gate.

Passing local checks is not hosted CI, a real service login, native platform
acceptance or a customer completing a task. Preserve those distinctions in the
handoff and inspect the current validation receipt before publication.

## Source basis

- `marketplace.json`: installable names, versions and local or remote sources.
- `CONTRIBUTING.md`: admission and ownership rules.
- `scripts/package-plugin.mjs`, `packagePlugin`: source inventory and package guards.
- `scripts/check-marketplace.mjs`: catalog, manifest, keyword and MCP contract checks.
- `package.json`: executable repository gates.
- `scripts/test-plugins.mjs`, `scripts/sync-skill-plugins.mjs`, `tests/catalog-wiring.test.mjs`: plugin test discovery, domain-skill refresh and catalog wiring checks.
- `scripts/skills.mjs`, `skills/upstream.json`, `skills/README.md`: active catalog,
  provenance, resource checks and user-facing workflow directory.
- `plugins/chromewhale/README.md`: the `page_*` surface, the bridge, and the
  stated split from Computer Use's `browser_*` tools.
- `plugins/chromewhale/src/tools.mjs`: the advertised tool set and why it does
  not reuse the `browser_*` names.

- `tests/browser/chromewhale.spec.mjs`: Chrome fixture coverage and harness limits.
