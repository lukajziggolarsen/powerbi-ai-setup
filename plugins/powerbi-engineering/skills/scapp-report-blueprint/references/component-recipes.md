# Component recipes

Exact formatting for each visual type, measured from the seven reports. JSON is
abbreviated with the helpers below; `scripts/make_visual.py` emits the full
form.

```jsonc
// shorthand used in this file
L("x")        →  { "expr": { "Literal": { "Value": "'x'" }}}          // string
N(12)         →  { "expr": { "Literal": { "Value": "12D" }}}          // number
I(5)          →  { "expr": { "Literal": { "Value": "5L" }}}           // integer
B(true)       →  { "expr": { "Literal": { "Value": "true" }}}         // bool
C("#094780")  →  { "solid": { "color": { "expr": { "Literal": { "Value": "'#094780'" }}}}}
T(0, -0.2)    →  { "solid": { "color": { "expr": { "ThemeDataColor": { "ColorId": 0, "Percent": -0.2 }}}}}
```

`objects` = the visual's own formatting. `visualContainerObjects` = the frame
around it (title, background, border, shadow, padding). Both are
`{ name: [{ properties: {...}, selector?: {...} }] }`.

---

## card — the KPI card

The workhorse: 148 instances. **The container title is the label; the built-in
category label is always off.**

```jsonc
"objects": {
  "labels": [{ "properties": {
    "color":             C("#094780"),
    "fontSize":          N(18),
    "fontFamily":        L("wf_standard-font, helvetica, arial, sans-serif"),
    "bold":              B(false),
    "labelDisplayUnits": N(1)          // Auto — omit for small counts
  }}],
  "categoryLabels": [{ "properties": { "show": B(false) }}]
},
"visualContainerObjects": {
  "title": [{ "properties": {
    "show":      B(true),
    "text":      L("Total Issue Loans Quantity"),
    "fontColor": C("#094780"),
    "fontSize":  N(12),
    "alignment": L("center"),
    "titleWrap": B(true),
    "bold":      B(false)
  }}],
  "background": [{ "properties": { "show": B(true), "transparency": N(0) }}],
  "padding":    [{ "properties": { "top": N(5), "bottom": N(0), "left": N(0), "right": N(0) }}],
  "spacing":    [{ "properties": { "customizeSpacing": B(false), "spaceBelowTitle": N(0), "verticalSpacing": N(0) }}],
  "dropShadow": [{ "properties": { "show": B(true), "color": T(0, -0.2) }}]
}
```

Variants that are all in-house:

- **Header "Last Update" card** — value 16pt, title 11pt,
  `preserveWhitespace: true`, `wordWrap.show: true`, `customizeSpacing: true`
  with `spaceBelowTitle: 2`, drop shadow on.
- **Ghost card** (sits inside a chart or panel) — `background.show: false`,
  transparency 4, title 8pt. Used for donut-center totals.
- **Translucent card** — `background.transparency: 33` so the grey canvas
  shows through. 18 instances; fine on a KPI row over a section panel.
- **Bordered card** — `border.show: true`, radius **10**, color
  `ThemeDataColor{0,0}` or `#094780`. Only 66 of 148 have a border at all;
  the default is shadow-only.

Rules: value never bold. Title centered — **all 134 titled cards are
centered**. Display units `1` (Auto) on 109 of 117.

---

## slicer

115 instances, three modes.

| Mode | `data.mode` | Look | Use for |
| --- | --- | --- | --- |
| Tile row | `"Basic"` + `general.orientation: 1` | Horizontal chips | Categorical filter strips (55 uses) |
| Dropdown | `"Dropdown"` + `orientation: 0` | Combo box | Header period pickers (44 uses) |
| Between | `"Between"` | Numeric/date range | Amount and date ranges (16 uses) |

```jsonc
"objects": {
  "data":    [{ "properties": { "mode": L("Basic") }}],
  "general": [{ "properties": {
    "orientation":   N(1),
    "outlineColor":  C("#063968"),   // or #243782
    "outlineWeight": N(1)
  }}],
  "header":  [{ "properties": {
    "show":            B(false),     // 66 of 86 hide it — the container title is used instead
    "text":            L(""),
    "fontColor":       C("#243782"),
    "textSize":        N(15),
    "bold":            B(true),
    "outlineStyle":    N(0),
    "fontFamily":      L("wf_standard-font, helvetica, arial, sans-serif"),
    "showRestatement": B(false)
  }}],
  "items":   [{ "properties": {
    "fontColor":    C("#063968"),
    "background":   T(0, 0),
    "textSize":     N(13),
    "bold":         B(false),
    "padding":      N(0),
    "outlineStyle": N(0),
    "fontFamily":   L("wf_standard-font, helvetica, arial, sans-serif")
  }}],
  "selection": [{ "properties": {
    "selectAllCheckboxEnabled": B(true),
    "strictSingleSelect":       B(false),
    "singleSelect":             B(false)
  }}],
  "pendingChangesIcon": [{ "properties": { "show": B(true), "position": L("left") }}]
},
"visualContainerObjects": {
  "background": [{ "properties": { "show": B(true), "color": C("#FFFFFF"), "transparency": N(0) }}],
  "padding":    [{ "properties": { "top": N(0), "bottom": N(0), "left": N(0), "right": N(0) }}],
  "border":     [{ "properties": { "show": B(false) }}],
  "dropShadow": [{ "properties": { "show": B(true), "color": T(0, -0.2) }}],
  "spacing":    [{ "properties": { "verticalSpacing": N(0) }}]
}
```

When the slicer needs a visible label, put it on the **container title**, not
the slicer header: `#063968` or `#E43E4C`, 11–14pt, centered,
`spaceBelowTitle: 0`. Border radius when used: **8**.

---

## pivotTable — the matrix

33 instances. **This is the most distinctive component**: crimson column
headers with white text, navy row headers, navy outlines, crimson totals.

```jsonc
"objects": {
  "columnHeaders": [{ "properties": {
    "backColor":      C("#E43E4C"),
    "fontColor":      C("#FFFFFF"),
    "fontSize":       N(12),
    "bold":           B(false),
    "fontFamily":     L("wf_standard-font, helvetica, arial, sans-serif"),
    "alignment":      L("Center"),
    "titleAlignment": L("Center"),
    "wordWrap":       B(true),
    "outlineStyle":   N(4),
    "outlineColor":   C("#094780"),
    "outlineWeight":  N(2),
    "urlIcon":        B(false)
  }}],
  "rowHeaders": [{ "properties": {
    "backColor":                  T(0, 0),
    "fontColor":                  C("#094780"),
    "fontSize":                   N(11),
    "bold":                       B(false),
    "fontFamily":                 L("wf_standard-font, helvetica, arial, sans-serif"),
    "alignment":                  L("Auto"),
    "outlineStyle":               N(2),
    "outlineColor":               C("#094780"),
    "outlineWeight":              N(2),
    "showExpandCollapseButtons":  B(true),
    "expandCollapseButtonsColor": C("#094780"),
    "expandCollapseButtonsSize":  N(11),
    "urlIcon":                    B(false)
  }}],
  "values": [{ "properties": {
    "fontColorPrimary":   T(2, -0.5),
    "fontColorSecondary": T(2, -0.5),
    "fontSize":           N(12),
    "bold":               B(false),
    "fontFamily":         L("wf_standard-font, helvetica, arial, sans-serif"),
    "outlineStyle":       N(0),
    "outlineColor":       C("#094780"),
    "outlineWeight":      N(1),
    "urlIcon":            B(false)
  }}],
  "grid": [{ "properties": {
    "gridVertical":        B(false),
    "gridVerticalColor":   C("#D3D3D3"),
    "gridVerticalWeight":  N(1),
    "gridHorizontal":      B(true),
    "gridHorizontalColor": C("#D3D3D3"),
    "rowPadding":          N(0),
    "textSize":            N(9)
  }}],
  "subTotals": [
    { "properties": { "fontColor": C("#094780"), "fontSize": N(10),
                      "backColor": T(0, -0.1), "applyToHeaders": B(true) },
      "selector": { "id": "Row" }},
    { "properties": { "fontColor": C("#094780"), "applyToHeaders": B(false) },
      "selector": { "id": "Column" }}
  ],
  "rowTotal":    [{ "properties": { "backColor": C("#E43E4C"), "fontColor": T(0, 0),
                                    "fontSize": N(11), "applyToHeaders": B(true) }}],
  "columnTotal": [{ "properties": { "backColor": T(0, 0), "fontColor": C("#094780"),
                                    "applyToHeaders": B(false) }}],
  "total":       [{ "properties": { "backColor": C("#E43E4C"), "fontSize": N(13) }}]
},
"visualContainerObjects": {
  "title": [{ "properties": {
    "show":       B(true),
    "text":       L("Total Portfolio by RPC classification"),
    "fontColor":  C("#E43E4C"),
    "background": C("#FFFFFF"),
    "fontSize":   N(14),
    "bold":       B(true),
    "alignment":  L("center"),
    "heading":    L("Normal"),
    "titleWrap":  B(true)
  }}],
  "background":   [{ "properties": { "show": B(true), "transparency": N(0) }}],
  "border":       [{ "properties": { "show": B(false), "color": C("#094780") }}],
  "dropShadow":   [{ "properties": { "show": B(true), "color": T(0, -0.2) }}],
  "divider":      [{ "properties": { "show": B(false), "color": C("#094780"), "width": N(2) }}],
  "spacing":      [{ "properties": { "customizeSpacing": B(true), "spaceBelowTitle": N(5) }}],
  "stylePreset":  [{ "properties": { "name": L("Condensed") }}],
  "visualHeader": [{ "properties": { "show": B(true), "border": C("#D3D3D3") }}]
}
```

Per-column formatting (`columnFormatting`, keyed by a `metadata` selector like
`"Measures_Portfolio.Amount"`) is used heavily to center numeric columns:

```jsonc
"columnFormatting": [{
  "properties": { "alignment": L("Center"), "styleHeader": B(true), "styleTotal": B(true) },
  "selector":   { "metadata": "Measures_Portfolio.Amount" }
}]
```

Set `labelPrecision: 0` (as `I(0)`) for whole numbers, `1` for one decimal.

---

## tableEx — the flat table

12 instances. Lighter than the matrix: navy headers on white, no crimson unless
it is a headline table.

```jsonc
"objects": {
  "columnHeaders": [{ "properties": {
    "fontColor": C("#094780"), "fontSize": N(11), "bold": B(true), "alignment": L("Center")
  }}],
  "values": [{ "properties": {
    "fontColorPrimary": C("#063968"), "fontColorSecondary": C("#063968"),
    "backColorSecondary": T(0, 0), "fontSize": N(11), "bold": B(false),
    "fontFamily": L("wf_standard-font, helvetica, arial, sans-serif")
  }}],
  "total": [{ "properties": { "fontColor": C("#094780"), "fontSize": N(11) }}],
  "grid":  [{ "properties": { "rowPadding": N(0), "textSize": N(10),
                              "gridHorizontalColor": C("#D3D3D3"),
                              "gridVerticalColor": C("#D3D3D3") }}]
},
"visualContainerObjects": {
  "title":      [{ "properties": { "show": B(true), "text": L("Call Center Loans"),
                                   "fontColor": C("#063968"), "fontSize": N(14),
                                   "bold": B(true), "alignment": L("center"),
                                   "background": C("#FFFFFF") }}],
  "background": [{ "properties": { "show": B(true), "transparency": N(0), "color": T(0, 0) }}],
  "divider":    [{ "properties": { "show": B(true), "color": C("#E43E4C"), "width": N(2) }}],
  "padding":    [{ "properties": { "top": N(5), "bottom": N(5), "left": N(5), "right": N(5) }}],
  "spacing":    [{ "properties": { "verticalSpacing": N(3) }}],
  "subTitle":   [{ "properties": { "show": B(false) }}]
}
```

The crimson **divider** under the title is the table's signature (6 of 9).
Use crimson column headers with white text only when the table is the page's
headline object.

---

## donutChart

13 instances. Labels outside carrying category + value + percent; legend off;
a ghost card in the hole showing the total.

```jsonc
"objects": {
  "legend": [{ "properties": { "show": B(false), "position": L("BottomCenter"),
                               "labelColor": C("#243782"), "fontSize": N(9), "bold": B(false),
                               "fontFamily": L("wf_standard-font, helvetica, arial, sans-serif") }}],
  "labels": [{ "properties": {
    "show":              B(true),
    "labelStyle":        L("Category, data value, percent of total"),
    "color":             C("#243782"),
    "fontSize":          N(9),
    "bold":              B(false),
    "labelDisplayUnits": N(1),
    "position":          L("preferOutside"),
    "fontFamily":        L("wf_standard-font, helvetica, arial, sans-serif")
  }}],
  "slices":    [{ "properties": { "innerRadiusRatio": I(60), "startAngle": I(14) }}],
  "dataPoint": [{ "properties": { "fill": C("#E43E4C") }}]
},
"visualContainerObjects": {
  "title":      [{ "properties": { "show": B(true), "text": L("Total Issued Loans By Channel"),
                                   "fontColor": C("#094780"), "fontSize": N(13),
                                   "bold": B(true), "alignment": L("center") }}],
  "background": [{ "properties": { "show": B(true), "transparency": N(0) }}],
  "spacing":    [{ "properties": { "customizeSpacing": B(true), "spaceBelowTitle": N(6) }}],
  "dropShadow": [{ "properties": { "show": B(true), "color": T(0, -0.2) }}]
}
```

`innerRadiusRatio` 60 (66–74 also used). Place a transparent `card`
(`background.show: false`, title 8pt) centered in the hole for the total.
Series colors: `#E43E4C` first, `#243782` second, `#119E39` third.

---

## lineChart

12 instances. Axis-light: no value axis, no gridlines, no axis titles, markers
on, data labels on.

```jsonc
"objects": {
  "categoryAxis": [{ "properties": {
    "show": B(true), "showAxisTitle": B(false),
    "labelColor": C("#243782"), "fontSize": N(10), "bold": B(true),
    "fontFamily": L("wf_standard-font, helvetica, arial, sans-serif")
  }}],
  "valueAxis":  [{ "properties": { "show": B(false), "showAxisTitle": B(false),
                                   "labelColor": C("#243782"), "labelDisplayUnits": N(1),
                                   "gridlineShow": B(false) }}],
  "labels":     [{ "properties": { "show": B(true), "color": C("#094780"),
                                   "fontSize": N(12), "bold": B(false),
                                   "labelDisplayUnits": N(1), "labelPrecision": I(0) }}],
  "lineStyles": [{ "properties": { "strokeWidth": I(2), "showMarker": B(true),
                                   "markerShape": L("circle"), "markerSize": N(8) }}],
  "legend":     [{ "properties": { "show": B(false), "position": L("TopCenter"),
                                   "labelColor": C("#243782"), "fontSize": N(9) }}],
  "dataPoint":  [{ "properties": { "fill": C("#E43E4C") }}]
},
"visualContainerObjects": {
  "title":      [{ "properties": { "show": B(true), "text": L("Current Month Trend"),
                                   "fontColor": C("#243782"), "fontSize": N(14),
                                   "bold": B(true), "alignment": L("center"),
                                   "heading": L("Normal") }}],
  "background": [{ "properties": { "show": B(true), "transparency": N(0) }}],
  "spacing":    [{ "properties": { "verticalSpacing": N(0) }}],
  "padding":    [{ "properties": { "bottom": N(5) }}]
}
```

`lineStyles.areaShow: true` fills under the line in a pale tint of the series
color — used on trend headliners (Daily Sale "Current Month Trend").

Themed tooltips, used on several charts:

```jsonc
"visualTooltip": [{ "properties": {
  "themedBackground":      T(0, -0.1),
  "themedTitleFontColor":  C("#243782"),
  "themedValueFontColor":  C("#243782"),
  "actionFontColor":       C("#243782"),
  "transparency":          N(14),
  "fontSize":              N(8),
  "bold":                  B(true),
  "fontFamily":            L("wf_standard-font, helvetica, arial, sans-serif")
}}]
```

---

## barChart / clusteredBarChart

Crimson bars, no value axis, bold navy category labels, data labels on.

```jsonc
"objects": {
  "categoryAxis": [{ "properties": {
    "show": B(true), "showAxisTitle": B(false), "labelColor": C("#243782"),
    "fontSize": N(10), "bold": B(true),
    "fontFamily": L("wf_standard-font, helvetica, arial, sans-serif"),
    "preferredCategoryWidth": N(20), "maxMarginFactor": I(50), "innerPadding": I(8)
  }}],
  "valueAxis": [{ "properties": { "show": B(false), "showAxisTitle": B(false) }}],
  "labels":    [{ "properties": { "show": B(true), "color": C("#243782"),
                                  "fontSize": N(10), "bold": B(true),
                                  "labelDisplayUnits": N(1), "labelOverflow": B(true),
                                  "fontFamily": L("wf_standard-font, helvetica, arial, sans-serif") }}],
  "dataPoint": [{ "properties": { "fill": C("#E43E4C") }}],
  "legend":    [{ "properties": { "labelColor": C("#243782"), "fontSize": N(9), "bold": B(false) }}],
  "totals":    [{ "properties": { "show": B(false) }}]
},
"visualContainerObjects": {
  "title":       [{ "properties": { "show": B(true), "text": L("Sales Amount by Branch"),
                                    "fontColor": C("#E43E4C"), "fontSize": N(14),
                                    "bold": B(true), "alignment": L("center") }}],
  "background":  [{ "properties": { "show": B(true), "transparency": N(0) }}],
  "stylePreset": [{ "properties": { "name": L("Condensed") }}],
  "padding":     [{ "properties": { "bottom": N(0), "left": N(0), "right": N(0) }}],
  "spacing":     [{ "properties": { "verticalSpacing": N(0) }}]
}
```

Bar chart titles are crimson (3 of 3 bar, 2 of 5 clustered); line and donut
titles are navy or indigo.

---

## pageNavigator

Never varies. See [page-layout.md](page-layout.md#3-page-navigator--middle).

```jsonc
"objects": {
  "shape":   [{ "properties": { "tileShape": L("rectangle"), "roundEdge": I(5) },
                "selector": { "id": "default" }}],
  "text":    [
    { "properties": { "fontFamily": L("wf_standard-font, helvetica, arial, sans-serif"),
                      "fontSize": N(12), "fontColor": T(1, 0.4) },
      "selector": { "id": "default" }},
    { "properties": { "bold": B(false) },      "selector": { "id": "selected" }},
    { "properties": { "fontColor": T(0, 0) },  "selector": { "id": "hover" }}
  ],
  "fill":    [
    { "properties": { "fillColor": C("#094780") }, "selector": { "id": "selected" }},
    { "properties": { "fillColor": T(2, 0.2) },    "selector": { "id": "hover" }}
  ],
  "outline": [{ "properties": { "show": B(false) }}],
  "pages":   [{ "properties": { "showHiddenPages": B(false) }}]
}
```

---

## textbox — the section panel

See [design-tokens.md](design-tokens.md#the-section-panel). Bold-italic 16pt
navy heading on a white rounded translucent panel, placed **behind** a group of
KPI cards.

```jsonc
"objects": {
  "general": [{ "properties": { "paragraphs": [{ "textRuns": [{
    "value": "Marketing Efficiency",
    "textStyle": { "fontWeight": "bold", "fontStyle": "italic",
                   "fontSize": "16pt", "color": "#094780" }
  }]}]}}]
},
"visualContainerObjects": {
  "background": [{ "properties": { "color": C("#ffffff"), "transparency": N(30) }}],
  "border":     [{ "properties": { "show": B(true), "radius": N(10), "color": C("#ffffff") }}],
  "dropShadow": [{ "properties": { "show": B(true), "color": T(0, -0.2) }}]
}
```

---

## Visuals to avoid

`gauge`, `funnel`, `multiRowCard`, and `cardVisual` each appear once or twice
and are not part of the established language. `advancedSlicerVisual` appears
twice (Daily Collection). Custom visuals in use:
`ChicletSlicer1448559807354`, `Datepicker_1687358625`,
`textSearchSlicer...` — all Core Marketing / RPC only. Prefer the core set:
`card`, `slicer`, `pivotTable`, `tableEx`, `donutChart`, `lineChart`,
`barChart`, `shape`, `pageNavigator`, `textbox`.
