---
name: scapp-report-blueprint
description: Build, restyle, or review PBIR pages specifically in the in-house Scapp visual system used by Core Marketing, Daily Sale, Core Auto, F1 Loans, Daily Collection, Call Sales, and RPC. Use only when the user names Scapp, asks for the company or house style, references one of those reports as the design target, or audits an existing Scapp page for design drift. For generic Power BI design, use powerbi-report-design instead.
---

# Scapp Power BI Report Blueprint

The house visual language, reverse-engineered from 39 pages and 464 visuals
across the seven production reports. Every value below is measured from those
files, not invented. Reproduce it exactly and a new report is
indistinguishable from the existing ones.

## The one-paragraph summary

A light grey canvas carries a **full-width red band** across the top of every
page. The band holds a white "Last Update" card on the left, a **page navigator
in the middle**, and period slicers on the right. Below it sits an optional
full-width slicer strip, then a row of **white KPI cards with a small navy
title above a large navy number**, then charts, then a **matrix or table with
crimson column headers in white bold text and navy row headers**. Two inks do
almost all the work: **navy `#094780`** for every number and label, **crimson
`#E43E4C`** for every header, total, and emphasis fill. Charts are near-naked —
no value axis, no gridlines, no legend, data labels on.

## How to use this skill

**Read [design-tokens.md](references/design-tokens.md) first** — colors, fonts,
sizes. It is the shortest file and everything else depends on it.

Then, by task:

| Task | Read | Then |
| --- | --- | --- |
| New report from scratch | [page-layout.md](references/page-layout.md) | `install_theme.py`, then `new_page.py` per page |
| Add a page to an existing report | [page-layout.md](references/page-layout.md) | `scripts/new_page.py --report <dir>` |
| Add or style one visual | [component-recipes.md](references/component-recipes.md) | `scripts/make_visual.py` |
| Restyle a report to house style | [component-recipes.md](references/component-recipes.md) | `scripts/restyle.py` (dry-run by default) |
| Check a report for drift | — | `scripts/check_style.py` |
| Install the house theme | [design-tokens.md](references/design-tokens.md) | `scripts/install_theme.py` |

All scripts take `--help`. `new_page.py` and `make_visual.py` emit visuals
**without field bindings** — bind them in Desktop afterwards. Until you do,
`powerbi-report-author validate` reports one `PBIR_QUERY_STATE_MISSING` per
unbound visual; the scripts tell you how many to expect.

[archetypes.md](references/archetypes.md) has the five page layouts these
reports actually use, with real coordinates. Copy one rather than inventing a
layout.

[evidence.md](references/evidence.md) records the measured frequency behind
every rule, so you can tell a hard convention from a soft one.

## Non-negotiables

These appear on essentially every page. Getting one wrong is what makes a
report look foreign:

1. **The red header band** — `shape`, rectangle, `x=0 y=0 w=<pageWidth>`,
   `h=47` (`h=70` on canvases wider than 1500), fill `#EA3F3F`, `z=0`.
   Everything else in the header sits on top of it.
2. **Page navigator** — `x=508 w=400 h=46` on a 1280 canvas. Selected fill
   `#094780`, unselected transparent, text 12pt. Never restyle it per-page.
3. **Navy `#094780` is the ink.** Card values, card titles, matrix row headers,
   table values, axis labels, slicer text. If a number is not navy, justify it.
4. **Crimson `#E43E4C` is the header/total.** Matrix column headers, row totals,
   grand totals, bar fills, chart titles on tables.
5. **Card titles go above the value, centered, small (11–14pt); values are
   large (16–18pt) and not bold.** `categoryLabels.show = false` always —
   the container title replaces it.
6. **Charts hide the value axis** (`valueAxis.show = false`), hide axis titles,
   hide the legend when the donut/bar labels already carry the categories, and
   turn data labels on.
7. **Page background** `#E6E6E6` at 30% transparency, `displayOption:
   FitToPage`.

## Rules that keep it from looking cheap

- **Two fonts only.** `wf_standard-font, helvetica, arial, sans-serif` for
  everything; the Semibold variant for emphasis. Never introduce a third.
- **Drop shadow, not border.** Cards and matrices use
  `dropShadow` with `ThemeDataColor 0 @ -0.2`; borders are usually off. When a
  border is on, it is `#094780` or white, radius 8–10.
- **Round the corners of floating panels** (radius 10), never the matrices.
- **Titles are centered**, not left-aligned — 134/134 card titles and 25/30
  matrix titles are centered.
- **Display units on.** `labelDisplayUnits = 1` (Auto) on card values and data
  labels; raw digits only for counts under ~1000.
- **Do not add a fourth accent color** to a page. Navy, crimson, white, grey.
  Categorical series get the theme palette only inside donuts and multi-series
  charts.

## Working on PBIR files

These reports are PBIR (`definition/pages/<PageId>/visuals/<VisualId>/visual.json`).

- Page ids are `ReportSection<20 hex chars>`; visual ids are 20 hex chars.
  `scripts/new_page.py` generates conforming ids.
- Register every new page in `definition/pages/pages.json` `pageOrder`.
- Keep `$schema` on the version the sibling files already use — do not upgrade
  a single file's schema in isolation.
- Validate with `powerbi-report-author validate` before opening Desktop, and
  reload with `powerbi-desktop reload` rather than reopening.
- **Never save from Desktop while you have pending file edits** — Desktop's
  save can clobber them silently.

### Serialization traps

Each of these produces a file Desktop may still open while the validator or
the service rejects it. Details and counts in
[evidence.md](references/evidence.md#pbir-serialization-facts).

- `drillFilterOtherVisuals` goes **inside** `visual`, not at the top level.
- Whole numbers serialize as `12D`, never `12.0D` — `general.orientation`
  rejects the decimal spelling.
- Integers take an `L` suffix (`0L`, `5L`); doubles take `D`.
- A `Dropdown` slicer under **48px** tall clips its selector and fails
  validation.
- The Semibold font string has a doubled apostrophe (`Segoe UI Semibold''`).
  Reproduce it exactly or the font silently falls back.

### Theme registration

Custom themes fail **silently** in the service when registered wrongly.
`scripts/install_theme.py` handles all three requirements; if you do it by
hand: `customTheme.type` must be `RegisteredResources` (not
`SharedResources`), `customTheme.name` must end in `.json` and match both the
theme file's own internal `name` and the `resourcePackages` item's `name` and
`path`, and `reportVersionAtImport` is required — preserve the existing value
when there is one. Theme files use **plain JSON**, not PBIR `expr` wrappers.

## Checking your work

Run `scripts/check_style.py <Report.Report dir>` — it reports deviations from
the blueprint (missing header band, non-house colors, wrong nav geometry,
un-hidden value axes, stray fonts) with file paths. Aim for zero findings on
new work; on legacy pages, treat it as a to-do list, not a mandate.

Then screenshot to confirm:

```bash
powerbi-desktop open "<UNC path to .pbip>"   # WSL: \\wsl.localhost\Ubuntu\home\...
powerbi-desktop screenshot-all --output-dir <dir> --scale 2 --settle 4000
```

From WSL the CLI is OS-blind — drive it through `powershell.exe` with `PATH`
re-injected from the registry, and pass the **UNC path**, or Desktop silently
loads a stale Windows-side copy.
