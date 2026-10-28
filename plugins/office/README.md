# Office

Decks, spreadsheets, reports and data analysis that end in a real file you can
send, plus a rendered image of every page so the agent checks its own work.
Everything is built by `scripts/office.mjs`, a Node 22+ helper with no
dependencies: no Python packages, no Office install, no network.

After installing, reviewing, trusting and enabling the plugin, ask:

> Turn `sales.csv` into a one-page report, a workbook with totals and a
> five-slide deck for Monday's review.

You get `report.docx`, `sales.xlsx` and `deck.pptx`, the commands that produced
every number, and rendered pages the agent looked at before handing them over.

## What it contains

| Piece | Use it to |
| --- | --- |
| `slides` skill | Storyline first, then a .pptx with title, section, bullets, two-column, stats, bars, table, image, image-right, quote and closing layouts; overflow warnings; speaker notes |
| `sheets` skill | .xlsx from CSV or JSON with typed columns, formulas, total rows, frozen headers and filters; recalculation that counts formula errors |
| `docs` skill | .docx from Markdown: headings, nested lists, tables, images with captions, links, code, quotes, page numbers |
| `data-analysis` skill | Profile a CSV, group and aggregate it, chart the answer as SVG/PNG, report with method and caveats |
| `examples/` | `sales.csv`, `deck.json`, `workbook.json` and `report.md`, the inputs used to check this plugin |

## Use the helper directly

```sh
node scripts/office.mjs slides examples/deck.json --out deck.pptx
node scripts/office.mjs sheet examples/workbook.json --out book.xlsx
node scripts/office.mjs doc examples/report.md --out report.docx
node scripts/office.mjs profile examples/sales.csv
node scripts/office.mjs pivot examples/sales.csv --by region --value revenue
node scripts/office.mjs chart by-region.csv --x region --y sum_revenue --out chart.svg --png
node scripts/office.mjs render deck.pptx          # PDF + PNG per page + contact sheet
node scripts/office.mjs recalc book.xlsx          # computed values, formula error count
node scripts/office.mjs text any.pptx             # text of a .pptx, .docx or .xlsx
```

## Prerequisites and data destinations

Node 22 or newer. The visual check (`render`, `recalc`) uses LibreOffice
(`soffice`) and, for PNG pages, Poppler's `pdftoppm`; the contact sheet and PNG
charts use ImageMagick (`magick`). Without them the files are still built and
the skills say the layout or formulas are unverified.

The helper reads only the files you name and writes only the outputs you name
(plus a temporary LibreOffice profile it deletes). It makes no network
requests. The skills run in your selected model and provider, so data you hand
them goes where your session sends prompts.

## What success and failure look like

- `slides` exits 0 with a slide count, or 1 with a warning per text box that
  may overflow; the skill fixes those before handing over.
- `recalc` prints every sheet's computed values and exits 1 if any cell shows
  `#REF!`, `#DIV/0!`, `#NAME?` or another formula error.
- `render` writes one PNG per page. A deck is done only after those images were
  viewed. Fonts can differ slightly between LibreOffice, PowerPoint and Keynote.
- Exit 2 means unreadable input: bad JSON, an unknown layout or format, a
  missing column, or an unsupported image type (PNG and JPEG only).

## Limits

Decks are rebuilt from a JSON spec, so editing an existing deck does not keep
its custom masters or animations. Charts in slides are images or editable bar
shapes, not native Office charts. Speaker notes go to a `.notes.md` file next
to the deck, not into the .pptx. On macOS, LibreOffice does not start inside
Codewhale's `workspace-write` shell sandbox; `render` and `recalc` then exit 1
with that explanation instead of passing, and need a run outside the sandbox.
