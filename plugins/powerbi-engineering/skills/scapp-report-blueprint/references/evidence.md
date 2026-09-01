# Evidence

Where every rule in this blueprint comes from, so you can tell a hard
convention from a soft preference. Measured 2026-07-28 from the PBIR files in
`/home/ziggo/powerbi`, plus rendered screenshots of Daily Sale captured through
the Power BI Desktop bridge.

## Corpus

| Report | Pages | Visuals |
| --- | --- | --- |
| Core Marketing | 10 | 167 |
| F1 Loans | 6 | 83 |
| Daily Collection | 3 | 52 |
| Core Auto | 6 | 51 |
| RPC | 7 | 47 |
| Call Sales | 4 | 40 |
| Daily Sale | 3 | 26 |
| **Total** | **39** | **466** |

Base themes are stock Microsoft (`CY24SU02`, `CY23SU04`, `CY22SU11`,
`CY18SU07`, `CY24SU10`) — **the house style lives entirely in per-visual
overrides**, not in a shared theme file. That is why
`assets/scapp-theme.json` exists: it lifts those overrides into a theme so new
reports start correct instead of restyling every visual by hand.

## Visual mix

```
card            148     shape            38     tableEx      12
slicer          115     pivotTable       33     lineChart    12
                        pageNavigator    35     donutChart   13
                        textbox          19     group        15
```

Everything else is in single digits. Cards and slicers are 57% of all visuals —
this is a KPI-and-filter house style, not a charting one.

## Rule strength

**Universal** (all 7 reports, or ≥90% of applicable instances):

| Rule | Evidence |
| --- | --- |
| `#094780` is the primary ink | 756 uses, all 7 reports |
| `#E43E4C` is the accent | 208 uses, all 7 reports |
| Card titles are centered | 134 / 134 |
| Cards hide the category label | 139 / 146 |
| Header band is a `shape` at `y≈0`, full width | 37 pages have one |
| Band fill is `#EA3F3F` | 27 / 37 (`#DA2215` on 7 Core Marketing pages) |
| Navigator selected fill `#094780` | 35 / 35 |
| Navigator text 12pt, `roundEdge` 5, outline off | 35 / 35 |
| `displayOption: FitToPage` | 38 / 39 pages |
| Matrix column headers on `#E43E4C` | 25 / 31 |
| Matrix row headers in `#094780` | 29 / 32 |
| Matrix grid lines `#D3D3D3` | 18 / 18 that set one |
| Matrix outlines `#094780` | 18 / 18 |
| Chart value axis hidden | line 7/11, bar 3/3, clustered bar 5/5 |
| Two font families only | 528 of 539 font references |

**Strong** (clear majority, some drift):

| Rule | Evidence |
| --- | --- |
| Canvas 1280 × 720 | 23 / 39 pages |
| Navigator at `x=508 w=400` | 16 / 35 (next most common: `x=475 w=785`, 5) |
| Drop shadow `ThemeDataColor{0,-0.2}` | 30 of 50 card shadows; `{0,-0.1}` on 15 |
| Card value 18pt | 40 / 148 at 18, 33 at 17, 25 at 16 — cluster 16–18 |
| Card title 11–12pt | 84 / 132 |
| Border radius 10 | 38 / 49 (8 on the remaining 11) |
| Matrix `stylePreset: Condensed` | 26 / 31 |
| Matrix title crimson, bold, centered | 23/30 crimson, 25/30 bold, 25/30 centered |
| Page background transparency 30 | 25 pages at 30, 7 at 70 |
| Slicer header hidden | 66 / 86 |

**Soft** (real variation — use judgment):

- **Ink on charts.** Line/bar/donut labels use `#243782` about as often as
  `#094780`. Both are in-house. Pick one per page and stay with it.
- **Card background transparency.** 59 cards at 0 (opaque white), 26 at 4,
  18 at 33 (translucent over the grey canvas). All three read fine.
- **Border on/off.** Only 66 of 148 cards set a border at all; shadow-only is
  the default.
- **Table value ink.** `#063968` in Core Marketing / Call Sales, `#094780`
  elsewhere. Both are house navies.
- **KPI card gap.** Median 13px but ranges 0–47. Edges are aligned by eye, not
  to a grid.

## Known drift in the existing reports

Do not copy these — the checker flags them:

- Daily Sale / Main uses `Segoe UI'', wf_segoe-ui_normal, …` on one card
  (11 uses estate-wide). Equivalent to `wf_standard-font`; use the latter.
- F1 Loans / Rejections has one matrix with a `#EA3F3F` column header — the
  band red where the accent crimson belongs.
- Daily Sale / Main leaves the value axis on for one line chart and one
  clustered bar chart.
- Core Marketing uses `#000000` for four section-panel headings where the other
  eleven use `#094780`.
- RPC / "MABL Classifications" and "Portfolio_Loans" have no header band and no
  navigator — they are hidden working pages, not published surfaces.
- Six pages set page-background transparency 70 instead of 30.

## PBIR serialization facts

Learned by validating generated output against
`powerbi-report-author validate`. Getting these wrong produces files Desktop
loads but the service or validator rejects:

- **`drillFilterOtherVisuals` goes inside `visual`**, not at the container top
  level. 530 / 530 production instances put it there; the 2.7.0 container
  schema rejects it at the top level.
- **Whole numbers serialize as `12D`, not `12.0D`.** 1041 instances of `0D`,
  zero instances of `0.0D`. Enum-backed properties such as
  `general.orientation` reject the decimal spelling outright.
- Integers use an `L` suffix (`0L`, `5L`); doubles use `D`.
- Colors are `{"solid":{"color":{"expr":{"Literal":{"Value":"'#094780'"}}}}}`
  — the hex is quoted *inside* the literal string.
- A `Dropdown` slicer shorter than **48px** clips its selector and fails
  validation (32px selector + 8/8 padding).
- The Semibold font string contains a doubled apostrophe
  (`Segoe UI Semibold''`). It is not a typo; matching it exactly matters.

## Reproducing this analysis

The extraction scripts are not shipped with the skill — they were one-off. To
redo it, walk every `definition/pages/*/visuals/*/visual.json`, resolve each
property through the `Literal` / `ThemeDataColor` / `solid` wrappers, and
tabulate by `visualType`. `scripts/check_style.py` contains a working
`lit()` resolver you can import.
