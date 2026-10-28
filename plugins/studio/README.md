# Studio

Plan and prototype product shots, ad sets, short social videos, storyboards
and consistent characters, with cost estimates for the image and video models
you would pay for with your own key.

**Status:** paid generation is disabled until Codewhale provides a verified
human approval path. Studio provides request previews and cost estimates over
MCP. File operations over MCP are disabled until confined file authority is
available. A human can run the free placeholder CLI in a trusted workspace.

After installing, reviewing, trusting and enabling the plugin, ask:

> Plan a 6-second vertical clip of `product.jpg` turning on a kitchen counter:
> shot list, request previews, and what a real run might cost.

## What it contains

| Piece | Use it to |
| --- | --- |
| `product-shot` skill | Packshots, lifestyle scenes and marketplace crops that keep the real product accurate |
| `ad-creative` skill | Three concepts, copy within platform limits, assets per placement and an optional video cut |
| `social-video` skill | Hook-first 6–20 s vertical or square video: keyframes, motion, cut |
| `storyboard-to-video` skill | Script → shot list → keyframes → motion → cut, estimated stage by stage |
| `consistent-character` skill | Character block and reference sheets reused across images and shots |
| `studio` MCP server (free) | `media_models` and request previews; file operations disabled |
| `studio-openai` MCP server | OpenAI image request previews; paid generation disabled |
| `studio-alibaba` MCP server | Qwen-Image and Wan request previews; paid generation and job polling disabled over MCP |
| `scripts/media.mjs` | Run from the workspace in a shell: `models`; placeholder `image` and `video`; `assemble` for local clips; and `--dry-run` for image or video providers. It writes under `./media` and never starts paid generation. The separate `status` command polls a prior Alibaba job with its key |

## Keys and prices

| Provider | Key | Price used for estimates |
| --- | --- | --- |
| OpenAI | `OPENAI_API_KEY` | **Unknown per image.** Studio does not estimate OpenAI image charges. Token usage and provider billing determine the actual cost; the preview reports it as unknown |
| Alibaba Model Studio | `DASHSCOPE_API_KEY` | Published International (Singapore) list prices from [Model Studio pricing](https://www.alibabacloud.com/help/en/model-studio/model-pricing), read 2026-10-28: qwen-image-2.0 $0.035/image, qwen-image-2.0-pro $0.075, qwen-image-3.0 $0.03 (+$0.003 per input image), qwen-image-3.0-pro $0.075 at 2K (+$0.003 per input image); wan3.0-video $0.05/$0.10/$0.20 per second at 480P/720P/1080P (shown with a limited-time 30% discount; estimates use the list price), wan3.0-video-prime $0.068/$0.14/$0.28, wan2.7-t2v and -i2v $0.10/$0.15 at 720P/1080P. Studio does not estimate `qwen-image-edit` or wan2.7 at 480P and reports their costs as unknown. Free quotas apply in Singapore for 90 days: 100 images (qwen-image-2.0/-pro), 10 (3.0/-pro), 30 s (wan3.0), 50 s (wan2.7) |
| Placeholder | none | Free and offline: flat PNGs and still clips to test a pipeline. Not a real generation |

- Previews require no provider keys. The MCP server configuration does not
  request or report keys, and paid generation is disabled.
- The retained provider code binds credentials to fixed official hosts
  (`api.openai.com`, `dashscope-intl.aliyuncs.com`) without a base-URL
  override. No live paid-generation path is enabled.
- Verified so far: request construction and dry runs for both providers, the
  fail-closed paths and byte limits against a local test
  client with the network blocked, the free placeholder path and ffmpeg
  assembly. **No call to any provider has been made from this plugin.** The
  Qwen-Image text-to-image request follows Model Studio's documented API. Qwen
  reference editing (`qwen-image-edit`) and the Wan async video fields follow
  DashScope's video-synthesis pattern and stay unverified until a live call;
  `media_models` reports this per provider.

## Prerequisites and data destinations

Node 22 or newer. `assemble_video` and placeholder video need `ffmpeg` and
`ffprobe` on PATH.

When paid generation opens, prompts and any reference images go to the
provider you choose: `api.openai.com`, or `dashscope-intl.aliyuncs.com`, whose
results are then downloaded without credentials from Alibaba Cloud storage
(`*.aliyuncs.com` only, https, no redirects). That provider's terms and data
policy apply. The placeholder generator makes no provider requests. `ffmpeg` processes
input media and is not independently sandboxed by this plugin.

The shell CLI checks paths against its current directory; inputs and outputs
use workspace-relative paths. MCP file operations are disabled. These checks are not OS isolation: concurrent path
changes and media processed by `ffmpeg` can cross the intended boundary. Use
the local pipeline only in a trusted workspace with trusted media until an
enforced sandbox or equivalent confinement is available. API responses are
capped at 96 MiB, downloaded images at 64 MiB and videos at 512 MiB, streamed to
disk with timeouts; a failed download preserves its partial file and reports its
path. Existing video outputs are not treated as verified successful downloads.
Receipts hold the prompt, model, estimate, request id and a sha256 of each file, never a key.

## What success and failure look like

- `media_models` reports `host.mcp_file_operations_enabled` and
  `host.paid_generation_enabled`, both false regardless of host capabilities.
- MCP file operations are refused, and MCP previews cannot read local reference
  images. Use text-only previews and tell the user about the limitation.
- `paid call not sent` means Studio did not send a generation request; paid
  generation is disabled.
- MCP job polling and downloads are disabled with the other file operations.

Generated media may need an AI-content label on ad networks and marketplaces.
Do not use the character skill to imitate a real person without consent.
