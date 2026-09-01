# Page layout

## Canvas

| Setting | Value | Evidence |
| --- | --- | --- |
| Size | **1280 × 720** | 23 of 39 pages |
| `displayOption` | `FitToPage` | 38 of 39 |
| Background | `#E6E6E6` @ transparency 30 | 35 of 39 have a background |
| Wallpaper | none | 34 of 39 |

Wider canvases, and when to use them:

| Size | Pages | Use for |
| --- | --- | --- |
| 1280 × 720 | 23 | **Default.** Everything unless you have a reason |
| 1400 × 720 | 4 | A matrix with many columns |
| 1500 × 720, 1500 × 1000 | 2 | Side-by-side detail tables |
| 1280 × 1000, 1400 × 850 | 2 | KPI grid plus a full-width matrix |
| 1700 × 1080, 1800 × 1100, 1400 × 1200 | 3 | Executive/marketing scroll pages |

Do not invent a size. Pick from this list.

## The vertical bands

A 1280 × 720 page divides into four bands. Coordinates are the measured medians.

```
┌──────────────────────────────────────────────────────────────┐  y=0
│  HEADER BAND            h = 47   z = 0   fill #EA3F3F        │
│  [Last Update]      [ Page Navigator ]        [period slicer]│
├──────────────────────────────────────────────────────────────┤  y=47
│  FILTER STRIP  (optional)   y ≈ 55–67   h ≈ 46–55            │
│  full-width or grouped slicers                               │
├──────────────────────────────────────────────────────────────┤  y≈105
│  KPI ROW  (optional)        y ≈ 124–285   h ≈ 60–100         │
│  [card] [card] [card] [card]        w ≈ 212–247, gap ≈ 13    │
├──────────────────────────────────────────────────────────────┤
│  CHART BAND  (optional)     y ≈ 118–375                      │
├──────────────────────────────────────────────────────────────┤
│  MATRIX / TABLE             y ≈ 180–350 → bottom             │
│  full width, x ≈ 0                                           │
└──────────────────────────────────────────────────────────────┘  y=720
```

Not every page has every band. The two commonest real shapes are
**header + filter strip + matrix** (RPC, Core Auto) and
**header + KPI row + charts + matrix** (F1 Loans, Daily Sale).

## Header band anatomy

This is the single most recognizable element. Build it in this order.

### 1. The band shape — always first, always `z = 0`

```jsonc
{
  "position": { "x": 0, "y": 0, "z": 0, "height": 47, "width": 1280, "tabOrder": -1 },
  "visual": {
    "visualType": "shape",
    "objects": {
      "shape":    [{ "properties": { "tileShape": { "expr": { "Literal": { "Value": "'rectangle'" }}}}}],
      "rotation": [{ "properties": { "shapeAngle": { "expr": { "Literal": { "Value": "0L" }}}}}],
      "fill":     [{ "properties": { "fillColor": { "solid": { "color": { "expr": {
                       "Literal": { "Value": "'#EA3F3F'" }}}}}},
                     "selector": { "id": "default" }}]
    }
  }
}
```

Band height by canvas width:

| Canvas width | Band height |
| --- | --- |
| 1250–1500 | **47** (46–50 all appear; use 47) |
| 1700–1800 | **70** (69–70) |

The band's `width` matches the page width. Several existing pages have a band
slightly wider than the canvas (e.g. 1500 on a 1400 page) — harmless overhang,
but do not copy it; match the width exactly.

### 2. "Last Update" card — left

Sits **on top of** the band with its own white background, so it reads as a
white notch cut out of the red.

| Property | Value |
| --- | --- |
| Position | `x ≈ 0–14` (or `290` when a slicer takes the left slot), `y = 3`, `w = 174`, `h = 38` |
| Title | `"Last Update"` / `"Last Refresh"` / `"Report Date"`, `#094780`, 11pt, centered |
| Value | `#094780`, 16pt, not bold, `preserveWhitespace: true`, `wordWrap.show: true` |
| Category labels | `show: false` |
| Background | on, transparency 0 |
| Drop shadow | on, `ThemeDataColor{0,-0.2}` |
| `spaceBelowTitle` | 2, with `customizeSpacing: true` |

Bind it to a `Last_Refresh` table's timestamp column with `Min` aggregation.

### 3. Page navigator — middle

**Do not restyle this per page.** It is byte-identical across 35 instances.

| Canvas | x | width | height |
| --- | --- | --- | --- |
| 1280 | **508** | **400** | 46 |
| 1280 (4-page reports) | 398 | 400 | 46 |
| 1400–1500 | 475 | 785 | 41 |
| 1700–1800 | 592 | 561 | 46 |

`x = 508` on a 1280 canvas is not mathematically centered — it is the
established value across four reports. Use it.

Styling: rectangle, `roundEdge 5`, text 12pt regular, default text
`ThemeDataColor{1,0.4}`, hover text `ThemeDataColor{0,0}`, selected fill
`#094780`, hover fill `ThemeDataColor{2,0.2}`, outline off,
`pages.showHiddenPages: false`.

### 4. Period slicers — right

One to three slicers, right-aligned so the last one ends at the page edge.
Typical: a date/`Tim` slicer `w ≈ 250–372 h ≈ 38`, or a Year/Month/Day trio of
`w ≈ 108–126 h ≈ 70` on the taller marketing bands.

Header hidden (`header.show: false`), items `#094780` or `#243782`,
`orientation: 1` (horizontal), `selectAllCheckboxEnabled: true`.

## The filter strip

Full-width or near-full-width slicers immediately under the band.

- `y ≈ 55–67`, `h ≈ 46–55`
- `width ≥ 70%` of page width
- `data.mode: "Basic"` with `general.orientation: 1` renders as a horizontal
  tile row — this is the house look for a categorical filter
- `items.outlineStyle: 0`, `items.padding: 0`, `items.textSize: 13–17`
- Container title on, crimson `#E43E4C`, 14pt bold, centered, white background,
  `spaceBelowTitle: 5` — when the strip needs a label

## The KPI row

| Property | Value |
| --- | --- |
| Card width | **212** (212–247 typical; 128 for compact 8-across rows) |
| Card height | **77** (71–92 typical) |
| Horizontal gap | ~13 (0–35 in practice — align edges, do not obsess) |
| Row `y` | 124 under a filter strip; 262–285 under a chart |

Lay 4–5 cards across a 1280 canvas. For a dense KPI page (Core Marketing
"Duplicate of Monday"), a 4 × 4 grid of `w=247 h=91` cards at `x = 17, 268,
519, 771, 1023` works.

## Z-order and tab order

- Band shape: `z = 0`
- Navigator: `z = 1000`
- Header cards/slicers: `z = 2000–4000`
- Body visuals: `z = 5000+`, roughly in reading order
- Section panels (textbox backings): low `z`, below the cards they back

`tabOrder` generally mirrors `z`. Set `tabOrder: -1` on the band so keyboard
users skip it.

## Page-level extras

```jsonc
// page.json
{
  "displayOption": "FitToPage",
  "height": 720,
  "width": 1280,
  "objects": {
    "background": [{ "properties": {
      "color": { "solid": { "color": { "expr": { "Literal": { "Value": "'#E6E6E6'" }}}}},
      "transparency": { "expr": { "Literal": { "Value": "30D" }}}
    }}]
  }
}
```

- Set `visibility: "HiddenInViewMode"` on working/scratch pages so they stay
  out of the navigator (`showHiddenPages: false` hides them there too).
- Use `visualInteractions` with `type: "NoFilter"` to stop header slicers from
  cross-filtering cards that should stay absolute — Core Marketing's monthly
  page does this for 11 pairs.
- Report-level `report.json` keeps `useStylableVisualContainerHeader: true`,
  `defaultDrillFilterOtherVisuals: true`, and collapses the filter pane with
  `outspacePane.expanded: false`.
