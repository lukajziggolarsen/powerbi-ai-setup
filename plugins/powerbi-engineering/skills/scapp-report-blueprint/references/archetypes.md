# Page archetypes

Five layouts cover 36 of the 39 production pages. Pick one and fill it in
rather than inventing a composition. Coordinates are real, taken from the named
source page, on a 1280 × 720 canvas unless stated.

---

## A. Matrix page

The commonest shape — a header, a filter strip, and one large matrix. Used by
RPC (5 pages), Core Auto (2), Daily Collection (1).

```
┌────────────────────────────────────────────────────────┐
│ [Last Update]      [ navigator ]        [date slicer]  │  band h=47
├────────────────────────────────────────────────────────┤
│         [ ── full-width tile slicer ── ]               │  y=96 h=52
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Total Portfolio by RPC classification           │  │  y=174
│  │  ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔    │  │  h=448
│  │  crimson headers / navy rows                     │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

*Source: RPC / "Portfolio MABL"*

| Visual | x | y | w | h | z |
| --- | --- | --- | --- | --- | --- |
| shape (band) | 0 | 0 | 1280 | 47 | 0 |
| pageNavigator | 508 | 0 | 400 | 46 | 1000 |
| card "Last Update" | 290 | 3 | 174 | 38 | 2000 |
| slicer (dropdown) | 0 | 2 | 221 | 48 | 3000 |
| slicer (tile strip) | 62 | 96 | 1156 | 52 | 4000 |
| pivotTable | 62 | 174 | 1156 | 448 | 5000 |

Inset the matrix by ~60px each side when it has few columns; run it to
`x=0 w=1280` when it has many.

---

## B. KPI row + charts + matrix

The analytical workhorse. Used by F1 Loans (4 pages), Daily Sale, Call Sales.

```
┌────────────────────────────────────────────────────────┐
│ [slicer] [Last Update]  [ navigator ]      [period]    │  band h=47
├────────────────────────────────────────────────────────┤
│  ╭──── trend line chart, full width ─────────────────╮ │  y=61 h=182
│  ╰───────────────────────────────────────────────────╯ │
│   ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐               │  y=262 h=71
│   │ KPI  │  │ KPI  │  │ KPI  │  │ KPI  │               │  w=229
│   └──────┘  └──────┘  └──────┘  └──────┘               │
│  ┌────────────────────────────┐  ┌──────────────────┐  │  y=352 h=356
│  │  matrix                    │  │  matrix          │  │
│  └────────────────────────────┘  └──────────────────┘  │
└────────────────────────────────────────────────────────┘
```

*Source: F1 Loans / "Sales Report"*

| Visual | x | y | w | h |
| --- | --- | --- | --- | --- |
| shape (band) | 0 | 0 | 1279 | 47 |
| slicer | 0 | 0 | 261 | 47 |
| card "Last Update" | 290 | 2 | 174 | 45 |
| pageNavigator | 508 | 0 | 400 | 46 |
| slicer (period) | 960 | 3 | 320 | 43 |
| lineChart | 0 | 61 | 1280 | 182 |
| card ×4 | 84 / 360 / 636 / 912 | 262 | 229 | 71 |
| pivotTable | 0 | 352 | 934 | 356 |
| pivotTable | 967 | 352 | 305 | 356 |

The KPI cards are pitched **276 apart** (229 wide + 47 gap) and start at x=84,
which centers the row of four on the canvas.

---

## C. Dense KPI grid

A wall of cards, no charts. Used by Core Marketing / "Duplicate of Monday" and
the KPI page.

```
┌────────────────────────────────────────────────────────┐
│ [Last Update] [slicer]   [ navigator ]                 │  band h=63
├────────────────────────────────────────────────────────┤
│ ┌────────┐ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐     │
│ │ matrix │ │  KPI  │ │  KPI  │ │  KPI  │ │  KPI  │     │  y=107
│ │        │ └───────┘ └───────┘ └───────┘ └───────┘     │
│ │        │ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐     │  y=207
│ └────────┘ └───────┘ └───────┘ └───────┘ └───────┘     │
│ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐                │  y=302
│ └───────┘ └───────┘ └───────┘ └───────┘                │
│ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐                │  y=396
│ └───────┘ └───────┘ └───────┘ └───────┘                │
└────────────────────────────────────────────────────────┘
```

*Source: Core Marketing / "Duplicate of Monday"*

Card grid: `w=247 h=91`, columns at `x = 17, 268, 519, 771, 1023`,
rows at `y = 107, 207, 301, 395`. Pitch 251 × 94.

---

## D. Split analysis

Two charts side by side over a full-width matrix. Used by F1 Loans / "RPC",
Call Sales / "Call Sales".

```
┌────────────────────────────────────────────────────────┐
│ [slicer] [Last Update]  [ navigator ]      [period]    │  band
├────────────────────────────────────────────────────────┤
│ [ ── slicer ── ]        [ ── slicer ─────────────── ]  │  y=55 h=49
│ ┌──────────┐ ┌──────────┐ ┌──────────────────────────┐ │  y=118
│ │  donut   │ │  donut   │ │   line chart             │ │  h=170
│ │  ( 000 ) │ │  ( 000 ) │ │                          │ │
│ └──────────┘ └──────────┘ └──────────────────────────┘ │
│ ┌────────────────────────────────────────────────────┐ │  y=314
│ │  matrix, full width                                │ │  h=405
│ └────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────┘
```

*Source: F1 Loans / "RPC"*

| Visual | x | y | w | h |
| --- | --- | --- | --- | --- |
| slicer (left strip) | 0 | 55 | 659 | 49 |
| slicer (right strip) | 674 | 55 | 606 | 49 |
| donutChart | 0 | 118 | 320 | 169 |
| donutChart | 339 | 118 | 320 | 169 |
| lineChart | 675 | 117 | 605 | 170 |
| card (donut centre) | 124 / 462 | 199 | 72 | 49 |
| pivotTable | 0 | 314 | 1280 | 405 |

The small cards at `y≈199` sit **in the donut holes** — transparent
background, 8pt title, 11pt value.

---

## E. Detail table page

A drill-through style page: header, a couple of slicers, one big table.
Used by Call Sales (3 pages), Core Auto / "Letters Details", Daily Sale / "Detail".

```
┌────────────────────────────────────────────────────────┐
│ [Last Update]      [ navigator ]      [type slicer]    │  band h=50
├────────────────────────────────────────────────────────┤
│  [slicer] [slicer] [ ────── user slicer ────────── ]   │  y=68 h=58
│  ┌───────────────────────────────────────────────────┐ │  y=163
│  │  tableEx — navy headers, crimson divider          │ │  h=274
│  └───────────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────────┐ │  y=462
│  │  tableEx                                          │ │  h=260
│  └───────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────┘
```

*Source: Call Sales / "Details" (1500 × 720)*

For a single table, run it `x=16 y=233 w=1253 h=480` (Call Sales / "CP Loans").

---

## Executive scroll page (rare)

Core Marketing's "Auto Monthly Report" is 1800 × 1100 with 36 visuals: a taller
band (h=69), section panels behind KPI clusters, and combo/area charts. Only
build one of these when the audience explicitly wants a single scrolling
monthly review. Keep the same tokens; only the canvas and density change.

---

## Choosing

| The page mainly answers… | Archetype |
| --- | --- |
| "what are the numbers by category?" | **A. Matrix** |
| "how are we doing, and why?" | **B. KPI + charts + matrix** |
| "give me every headline metric at once" | **C. Dense KPI grid** |
| "compare two breakdowns over time" | **D. Split analysis** |
| "show me the underlying rows" | **E. Detail table** |
