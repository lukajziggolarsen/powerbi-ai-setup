# Design tokens

Every value measured from the seven production reports. The count in brackets
is how many times the literal appears across all 464 visuals; the report list
shows which reports use it. A token used by all seven reports is a hard
convention.

## Color

### Core inks — use these for ~95% of everything

| Token | Hex | Count | Reports | What it is used for |
| --- | --- | --- | --- | --- |
| `ink.primary` | `#094780` | **756** | all 7 | The house navy. Card values, card titles, matrix row headers + subtotals + column totals, table totals, slicer text, chart axis labels, expand/collapse chevrons, navigator selected fill, matrix outlines |
| `accent.crimson` | `#E43E4C` | **208** | all 7 | Matrix/table column-header fill, row-total fill, grand-total fill, bar and donut primary fill, matrix/table title text |
| `band.red` | `#EA3F3F` | 50 | 6 of 7 | **The header band fill.** Only ever used for the top band shape |
| `ink.indigo` | `#243782` | 162 | 5 of 7 | Chart-side alternative to navy: axis labels, data labels, legend text, tooltip text, slicer text |
| `ink.deepNavy` | `#063968` | 150 | 2 of 7 | Slicer item text and outlines, table value text (Core Marketing + Call Sales dialect) |
| `surface.white` | `#FFFFFF` | 148 | all 7 | Card/matrix backgrounds, matrix column-header text, title backgrounds |
| `line.grid` | `#D3D3D3` | 66 | 4 of 7 | Matrix + table gridlines, `visualHeader.border` |
| `shadow.grey` | `#B3B3B3` | 38 | 3 of 7 | Literal drop-shadow color (the themed form below is preferred) |
| `band.redAlt` | `#DA2215` | 24 | 1 of 7 | Core Marketing's darker header band |

### Themed colors — prefer these where the reports use them

Written as `ThemeDataColor{ColorId, Percent}` in JSON, not as hex, so they
track the base theme. `ColorId 0` is the theme background (white), `1` is
foreground, `2` is the first data color.

| Expression | Resolves to | Used for |
| --- | --- | --- |
| `{0, 0}` | white | Card/matrix/slicer background fill, row-header back, column-total back |
| `{0, -0.1}` | ~`#E6E6E6` | **Page background**, matrix row-subtotal back, navigator/visual-header background, tooltip background |
| `{0, -0.2}` | ~`#CCCCCC` | **The standard drop-shadow color** (used 30+ times) |
| `{0, -0.5}` | mid grey | Occasional border |
| `{1, 0.4}` | muted foreground | Navigator unselected text |
| `{2, -0.5}` | dark data-blue | Matrix value text, card category labels |
| `{2, 0.2}` | pale data-blue | Navigator hover fill |

### Semantic colors

| Meaning | Hex | Notes |
| --- | --- | --- |
| good / positive | `#13A72E`, `#22993C`, `#119E39`, `#17CC46`, `#54914C` | No single winner — pick `#119E39` for new work |
| bad / negative | `#DA2215`, `#D92329`, `#DE1221`, `#EA3F3F` | Use `#DA2215`; keep `#EA3F3F` reserved for the band |
| warning / neutral | `#F5C842`, `#D9B300`, `#FFBC04`, `#DEC405` | Use `#F5C842` |
| plan / target | `#12239E`, `#2476C0`, `#118DFF` | Blues for "plan" against crimson "actual" |

### Canvas

```
page background: #E6E6E6  (or ThemeDataColor{0,-0.1}) at transparency 30
```

17 pages use the literal `#E6E6E6`, 18 use the themed equivalent, 4 use no
background. Both render identically. Six older pages use transparency 70 —
that is drift, use **30**.

### Rules

- **Never introduce a fourth accent on one page.** Navy, crimson, white, grey.
- Categorical series (donut slices, multi-series lines) may use the base
  theme's data colors, but slice 1 should be `#E43E4C` and slice 2 `#243782`
  to stay on-brand.
- Header band is `#EA3F3F` — do not substitute `#E43E4C`. They are different
  reds and the band is the more saturated one.

## Typography

Only two families appear in the whole estate. Reproduce the strings **exactly**,
including the doubled apostrophe in the Semibold form — that is how Power BI
serializes it and a mismatch silently falls back.

```
regular   wf_standard-font, helvetica, arial, sans-serif
semibold  Segoe UI Semibold'', wf_segoe-ui_semibold, helvetica, arial, sans-serif
bold      Segoe UI Bold'', wf_segoe-ui_bold, helvetica, arial, sans-serif      (rare)
```

Regular is the default; use Semibold for card values and titles that need
weight without `bold: true`.

### Size scale

| Element | pt | Notes |
| --- | --- | --- |
| Card value (KPI) | **18** | 17 and 16 also common; 25 for a hero number |
| Card value (compact, in-header) | 16 | The "Last Update" card |
| Card title | **12** | 11 and 14 also common; 8 for tiny inline cards |
| Card category label | 10 | Usually hidden — the title replaces it |
| Matrix column header | **12** | |
| Matrix row header | **11** | |
| Matrix values | **12** | |
| Matrix row subtotal | 10 | |
| Matrix / table grand total | 13 | |
| Matrix grid text | 9 | `grid.textSize` |
| Table column header | 11 | bold `true` |
| Table values | 11 | |
| Slicer items | **13** | 12 also common; 17 on wide tile strips |
| Slicer header | 15 | bold `true`; usually hidden |
| Page navigator | **12** | never change |
| Chart title | **14** | 13 and 15 common |
| Chart data labels | 10–12 | |
| Chart axis labels | 8–10 | bold `true` on category axis |
| Chart legend | 9 | |
| Section-panel heading (textbox) | 16pt bold + italic | see below |

Titles are **not** bold on cards (40 of 71 are `bold: false`) but **are** bold
on matrices and charts (25 of 30, and 3 of 3).

## Spacing and shape

| Token | Value | Where |
| --- | --- | --- |
| Corner radius, floating panel | **10** | Textbox panels, cards with borders |
| Corner radius, slicer | **8** | |
| Corner radius, navigator button | 5 | `shape.roundEdge` |
| Drop shadow | `show: true`, color `ThemeDataColor{0,-0.2}` | Cards, matrices, tables, slicers, panels |
| Card padding | `top: 5`, others `0` | |
| Card `spaceBelowTitle` | **0** (2 on header cards) | with `customizeSpacing: true` |
| Matrix `spaceBelowTitle` | **5** | |
| Matrix `stylePreset.name` | `"Condensed"` | 26 of 31 |
| Matrix `grid.rowPadding` | **0** | |
| KPI card gap (x) | ~13 median, 0–35 range | Not a strict grid |

## The section panel

A recurring device: a **white rounded panel sitting behind a group of KPI
cards**, carrying a bold-italic heading. It is a `textbox`, not a shape.

```
paragraph: bold + italic, 16pt, color #094780
container: background #FFFFFF at transparency 30
           border show, radius 10, color #FFFFFF
           dropShadow show, color ThemeDataColor{0,-0.2}
```

Real headings used: "Marketing Efficiency", "Business KPIs", "Actual VS Plan",
"Key Monthly Results", "Issued Loans Trend". Place it at a low `z` so the cards
render on top.
