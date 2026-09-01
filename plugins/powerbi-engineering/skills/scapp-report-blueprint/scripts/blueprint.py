"""Scapp Power BI report blueprint: tokens, PBIR expression helpers, visual builders.

Import from the sibling scripts, or use directly:

    from blueprint import TOKENS, card, matrix, header_band, page_json

Every default here is measured from the seven production reports. See
../references/design-tokens.md for provenance.
"""

from __future__ import annotations

import json
import secrets

# --------------------------------------------------------------------------
# Tokens
# --------------------------------------------------------------------------

TOKENS = {
    "ink.primary": "#094780",     # the house navy — values, labels, row headers
    "ink.indigo": "#243782",      # chart-side ink
    "ink.deepNavy": "#063968",    # slicer / table ink
    "accent.crimson": "#E43E4C",  # headers, totals, bar fills
    "band.red": "#EA3F3F",        # the header band, and nothing else
    "band.redAlt": "#DA2215",
    "surface.white": "#FFFFFF",
    "canvas.grey": "#E6E6E6",
    "line.grid": "#D3D3D3",
    "shadow.grey": "#B3B3B3",
    "good": "#119E39",
    "bad": "#DA2215",
    "warn": "#F5C842",
    "plan": "#12239E",
}

FONT_REGULAR = "wf_standard-font, helvetica, arial, sans-serif"
# The doubled apostrophe is how Power BI serializes these — reproduce exactly.
FONT_SEMIBOLD = "Segoe UI Semibold'', wf_segoe-ui_semibold, helvetica, arial, sans-serif"
FONT_BOLD = "Segoe UI Bold'', wf_segoe-ui_bold, helvetica, arial, sans-serif"
# Appears 11 times; equivalent to FONT_REGULAR under the base theme. Tolerated
# in legacy pages, not used for new work.
FONT_SEGOE_REGULAR = "Segoe UI'', wf_segoe-ui_normal, helvetica, arial, sans-serif"

FONTS_PREFERRED = {FONT_REGULAR, FONT_SEMIBOLD, FONT_BOLD}
FONTS_TOLERATED = FONTS_PREFERRED | {FONT_SEGOE_REGULAR}

HOUSE_COLORS = {
    v.upper()
    for k, v in TOKENS.items()
} | {"#12239E", "#118DFF", "#2476C0", "#54914C", "#22993C", "#13A72E", "#17CC46"}

SCHEMA_VISUAL = (
    "https://developer.microsoft.com/json-schemas/fabric/item/report/"
    "definition/visualContainer/2.7.0/schema.json"
)
SCHEMA_PAGE = (
    "https://developer.microsoft.com/json-schemas/fabric/item/report/"
    "definition/page/2.1.0/schema.json"
)
SCHEMA_PAGES = (
    "https://developer.microsoft.com/json-schemas/fabric/item/report/"
    "definition/pagesMetadata/1.1.0/schema.json"
)

# Band height by canvas width, measured across 37 header bands.
BAND_HEIGHT_NARROW = 47   # canvases up to 1500
BAND_HEIGHT_WIDE = 70     # 1700+

# Navigator geometry by canvas width.
NAV_GEOMETRY = {
    1250: (463, 707, 41),
    1280: (508, 400, 46),
    1330: (464, 689, 46),
    1400: (475, 785, 41),
    1500: (550, 400, 46),
    1700: (592, 561, 46),
    1800: (620, 561, 46),
}


# --------------------------------------------------------------------------
# PBIR expression helpers
# --------------------------------------------------------------------------

def L(value: str) -> dict:
    """String literal."""
    return {"expr": {"Literal": {"Value": f"'{value}'"}}}


def N(value: float) -> dict:
    """Numeric (double) literal — PBIR writes these with a D suffix.

    Whole numbers are written without a decimal point (``12D``, not ``12.0D``):
    production files use that form throughout, and some enum-backed properties
    (``general.orientation``) reject the decimal spelling.
    """
    if float(value).is_integer():
        return {"expr": {"Literal": {"Value": f"{int(value)}D"}}}
    return {"expr": {"Literal": {"Value": f"{value}D"}}}


def I(value: int) -> dict:  # noqa: E743 - matches the PBIR docs' naming
    """Integer literal — PBIR writes these with an L suffix."""
    return {"expr": {"Literal": {"Value": f"{int(value)}L"}}}


def B(value: bool) -> dict:
    """Boolean literal — PBIR writes these as bare true/false strings."""
    return {"expr": {"Literal": {"Value": "true" if value else "false"}}}


def C(hex_color: str) -> dict:
    """Solid color from a hex literal."""
    return {"solid": {"color": {"expr": {"Literal": {"Value": f"'{hex_color}'"}}}}}


def T(color_id: int, percent: float = 0) -> dict:
    """Solid color from the base theme, shaded by ``percent``."""
    return {
        "solid": {
            "color": {
                "expr": {"ThemeDataColor": {"ColorId": color_id, "Percent": percent}}
            }
        }
    }


SHADOW = T(0, -0.2)


def obj(**properties) -> list:
    """A single formatting-object entry with no selector."""
    return [{"properties": properties}]


def obj_sel(selector: dict, **properties) -> list:
    """A single formatting-object entry with a selector."""
    return [{"properties": properties, "selector": selector}]


def new_id() -> str:
    """A 20-hex-char id, the shape PBIR uses for visuals."""
    return secrets.token_hex(10)


def new_page_id() -> str:
    return "ReportSection" + secrets.token_hex(10)


def position(x, y, w, h, z=0, tab=None) -> dict:
    return {
        "x": float(x),
        "y": float(y),
        "z": float(z),
        "height": float(h),
        "width": float(w),
        "tabOrder": float(z if tab is None else tab),
    }


def container(visual_type: str, pos: dict, objects=None, vc_objects=None) -> dict:
    """Wrap a visual definition in its PBIR container.

    ``drillFilterOtherVisuals`` belongs *inside* ``visual`` — that is where all
    530 production instances put it, and the container schema rejects it at the
    top level.
    """
    visual = {"visualType": visual_type}
    if objects:
        visual["objects"] = objects
    if vc_objects:
        visual["visualContainerObjects"] = vc_objects
    visual["drillFilterOtherVisuals"] = True
    return {
        "$schema": SCHEMA_VISUAL,
        "name": new_id(),
        "position": pos,
        "visual": visual,
    }


# --------------------------------------------------------------------------
# Shared container-object fragments
# --------------------------------------------------------------------------

def title_vc(text, color=None, size=12, bold=False, align="center",
             background=None, space_below=None, family=None):
    props = {
        "show": B(True),
        "text": L(text),
        "fontColor": C(color or TOKENS["ink.primary"]),
        "fontSize": N(size),
        "alignment": L(align),
        "bold": B(bold),
        "titleWrap": B(True),
    }
    if background:
        props["background"] = C(background)
    if family:
        props["fontFamily"] = L(family)
    out = {"title": [{"properties": props}]}
    if space_below is not None:
        out["spacing"] = obj(customizeSpacing=B(True), spaceBelowTitle=N(space_below))
    return out


def frame(background=True, transparency=0, shadow=True, border=None,
          radius=None, padding=None):
    """The standard card/matrix frame: white fill, drop shadow, no border."""
    vc = {}
    if background:
        vc["background"] = obj(show=B(True), transparency=N(transparency))
    else:
        vc["background"] = obj(show=B(False), transparency=N(transparency))
    if shadow:
        vc["dropShadow"] = obj(show=B(True), color=SHADOW)
    if border:
        props = {"show": B(True), "color": C(border)}
        if radius is not None:
            props["radius"] = N(radius)
        vc["border"] = [{"properties": props}]
    if padding is not None:
        t, r, b, l = padding if isinstance(padding, (list, tuple)) else (padding,) * 4
        vc["padding"] = obj(top=N(t), right=N(r), bottom=N(b), left=N(l))
    return vc


# --------------------------------------------------------------------------
# Component builders
# --------------------------------------------------------------------------

def header_band(page_width: float, page_height: float = 720, color=None) -> dict:
    """The full-width red band. Always z=0, always first."""
    height = BAND_HEIGHT_WIDE if page_width >= 1700 else BAND_HEIGHT_NARROW
    return container(
        "shape",
        position(0, 0, page_width, height, z=0, tab=-1),
        objects={
            "shape": obj(tileShape=L("rectangle")),
            "rotation": obj(shapeAngle=I(0)),
            "fill": obj_sel({"id": "default"},
                            fillColor=C(color or TOKENS["band.red"])),
        },
    )


def page_navigator(page_width: float = 1280, z=1000) -> dict:
    """Byte-identical across all 35 production instances. Do not restyle."""
    x, w, h = NAV_GEOMETRY.get(int(page_width), NAV_GEOMETRY[1280])
    return container(
        "pageNavigator",
        position(x, 0, w, h, z=z),
        objects={
            "shape": obj_sel({"id": "default"},
                             tileShape=L("rectangle"), roundEdge=I(5)),
            "text": [
                {"properties": {"fontFamily": L(FONT_REGULAR),
                                "fontSize": N(12),
                                "fontColor": T(1, 0.4)},
                 "selector": {"id": "default"}},
                {"properties": {"bold": B(False)}, "selector": {"id": "selected"}},
                {"properties": {"fontColor": T(0, 0)}, "selector": {"id": "hover"}},
            ],
            "outline": obj(show=B(False)),
            "fill": [
                {"properties": {"fillColor": C(TOKENS["ink.primary"])},
                 "selector": {"id": "selected"}},
                {"properties": {"fillColor": T(2, 0.2)},
                 "selector": {"id": "hover"}},
            ],
            "pages": obj(showHiddenPages=B(False)),
        },
    )


def card(title, x, y, w=212, h=77, z=5000, value_size=18, title_size=12,
         color=None, transparency=0, display_units=True, ghost=False,
         compact=False):
    """A KPI card. ``ghost=True`` for the transparent in-donut variant."""
    ink = color or TOKENS["ink.primary"]
    labels = {
        "color": C(ink),
        "fontSize": N(16 if compact else value_size),
        "fontFamily": L(FONT_REGULAR),
        "bold": B(False),
    }
    if display_units:
        labels["labelDisplayUnits"] = N(1)
    if compact:
        labels["preserveWhitespace"] = B(True)

    objects = {
        "labels": [{"properties": labels}],
        "categoryLabels": obj(show=B(False)),
    }
    if compact:
        objects["wordWrap"] = obj(show=B(True))

    vc = title_vc(title, color=ink, size=11 if compact else title_size,
                  bold=False, family=FONT_REGULAR if compact else None,
                  space_below=2 if compact else None)
    if ghost:
        vc.update(frame(background=False, transparency=4, shadow=False))
    else:
        vc.update(frame(transparency=transparency, shadow=True,
                        padding=(5, 0, 0, 0)))
        if not compact:
            vc["spacing"] = obj(customizeSpacing=B(False),
                                spaceBelowTitle=N(0), verticalSpacing=N(0))
    return container("card", position(x, y, w, h, z=z), objects, vc)


# A Dropdown slicer clips its selector below this height (32px selector +
# 8/8 padding), and PBIR validation rejects it.
SLICER_DROPDOWN_MIN_HEIGHT = 48


def slicer(x, y, w, h, z=3000, title=None, mode="Basic", horizontal=True,
           item_size=13, ink=None, title_color=None, radius=None):
    """Tile row (Basic+horizontal), Dropdown, or Between."""
    ink = ink or TOKENS["ink.deepNavy"]
    if mode == "Dropdown":
        h = max(h, SLICER_DROPDOWN_MIN_HEIGHT)
    objects = {
        "data": obj(mode=L(mode)),
        "general": obj(orientation=N(1 if horizontal else 0),
                       outlineColor=C(ink), outlineWeight=N(1)),
        "header": obj(show=B(False), text=L(""), fontColor=C(TOKENS["ink.indigo"]),
                      textSize=N(15), bold=B(True), outlineStyle=N(0),
                      fontFamily=L(FONT_REGULAR), showRestatement=B(False)),
        "items": obj(fontColor=C(ink), background=T(0, 0), textSize=N(item_size),
                     bold=B(False), padding=N(0), outlineStyle=N(0),
                     fontFamily=L(FONT_REGULAR)),
        "selection": obj(selectAllCheckboxEnabled=B(True),
                         strictSingleSelect=B(False), singleSelect=B(False)),
        "pendingChangesIcon": obj(show=B(True), position=L("left")),
    }
    vc = {
        "background": obj(show=B(True), color=C(TOKENS["surface.white"]),
                          transparency=N(0)),
        "padding": obj(top=N(0), bottom=N(0), left=N(0), right=N(0)),
        "border": obj(show=B(False)) if radius is None
                  else obj(show=B(True), radius=N(radius), color=C(ink)),
        "dropShadow": obj(show=B(True), color=SHADOW),
        "spacing": obj(verticalSpacing=N(0)),
    }
    if title:
        vc.update(title_vc(title, color=title_color or TOKENS["ink.deepNavy"],
                           size=11, bold=False, space_below=0))
    else:
        vc["title"] = obj(show=B(False), titleWrap=B(True))
    return container("slicer", position(x, y, w, h, z=z), objects, vc)


def matrix(title, x, y, w, h, z=5000, value_ink=None):
    """The signature matrix: crimson column headers, navy rows, crimson totals."""
    navy = TOKENS["ink.primary"]
    crimson = TOKENS["accent.crimson"]
    objects = {
        "columnHeaders": obj(
            backColor=C(crimson), fontColor=C(TOKENS["surface.white"]),
            fontSize=N(12), bold=B(False), fontFamily=L(FONT_REGULAR),
            alignment=L("Center"), titleAlignment=L("Center"), wordWrap=B(True),
            outlineStyle=N(4), outlineColor=C(navy), outlineWeight=N(2),
            urlIcon=B(False)),
        "rowHeaders": obj(
            backColor=T(0, 0), fontColor=C(navy), fontSize=N(11), bold=B(False),
            fontFamily=L(FONT_REGULAR), alignment=L("Auto"),
            outlineStyle=N(2), outlineColor=C(navy), outlineWeight=N(2),
            showExpandCollapseButtons=B(True),
            expandCollapseButtonsColor=C(navy),
            expandCollapseButtonsSize=N(11), urlIcon=B(False)),
        "values": obj(
            fontColorPrimary=value_ink and C(value_ink) or T(2, -0.5),
            fontColorSecondary=value_ink and C(value_ink) or T(2, -0.5),
            fontSize=N(12), bold=B(False), fontFamily=L(FONT_REGULAR),
            outlineStyle=N(0), outlineColor=C(navy), outlineWeight=N(1),
            urlIcon=B(False)),
        "grid": obj(
            gridVertical=B(False), gridVerticalColor=C(TOKENS["line.grid"]),
            gridVerticalWeight=N(1), gridHorizontal=B(True),
            gridHorizontalColor=C(TOKENS["line.grid"]),
            rowPadding=N(0), textSize=N(9)),
        "subTotals": [
            {"properties": {"fontColor": C(navy), "fontSize": N(10),
                            "backColor": T(0, -0.1), "applyToHeaders": B(True)},
             "selector": {"id": "Row"}},
            {"properties": {"fontColor": C(navy), "applyToHeaders": B(False)},
             "selector": {"id": "Column"}},
        ],
        "rowTotal": obj(backColor=C(crimson), fontColor=T(0, 0),
                        fontSize=N(11), applyToHeaders=B(True)),
        "columnTotal": obj(backColor=T(0, 0), fontColor=C(navy),
                           applyToHeaders=B(False)),
        "total": obj(backColor=C(crimson), fontSize=N(13)),
    }
    vc = title_vc(title, color=crimson, size=14, bold=True,
                  background=TOKENS["surface.white"], space_below=5)
    vc.update(frame(shadow=True))
    vc["border"] = obj(show=B(False), color=C(navy))
    vc["divider"] = obj(show=B(False), color=C(navy), width=N(2))
    vc["stylePreset"] = obj(name=L("Condensed"))
    vc["visualHeader"] = obj(show=B(True), border=C(TOKENS["line.grid"]))
    return container("pivotTable", position(x, y, w, h, z=z), objects, vc)


def table(title, x, y, w, h, z=5000, divider=True):
    """Flat table: navy headers on white, crimson divider under the title."""
    navy = TOKENS["ink.primary"]
    deep = TOKENS["ink.deepNavy"]
    objects = {
        "columnHeaders": obj(fontColor=C(navy), fontSize=N(11), bold=B(True),
                             alignment=L("Center"), fontFamily=L(FONT_REGULAR)),
        "values": obj(fontColorPrimary=C(deep), fontColorSecondary=C(deep),
                      backColorSecondary=T(0, 0), fontSize=N(11), bold=B(False),
                      fontFamily=L(FONT_REGULAR)),
        "total": obj(fontColor=C(navy), fontSize=N(11)),
        "grid": obj(rowPadding=N(0), textSize=N(10),
                    gridHorizontalColor=C(TOKENS["line.grid"]),
                    gridVerticalColor=C(TOKENS["line.grid"]),
                    gridVerticalWeight=N(1)),
    }
    vc = title_vc(title, color=deep, size=14, bold=True,
                  background=TOKENS["surface.white"], space_below=5)
    vc.update(frame(shadow=True, padding=5))
    vc["divider"] = obj(show=B(divider), color=C(TOKENS["accent.crimson"]),
                        width=N(2))
    vc["spacing"] = obj(customizeSpacing=B(True), spaceBelowTitle=N(5),
                        verticalSpacing=N(3))
    vc["subTitle"] = obj(show=B(False))
    vc["stylePreset"] = obj(name=L("Condensed"))
    return container("tableEx", position(x, y, w, h, z=z), objects, vc)


def donut(title, x, y, w, h, z=5000, inner_radius=60, start_angle=14):
    objects = {
        "legend": obj(show=B(False), position=L("BottomCenter"),
                      labelColor=C(TOKENS["ink.indigo"]), fontSize=N(9),
                      bold=B(False), fontFamily=L(FONT_REGULAR)),
        "labels": obj(show=B(True),
                      labelStyle=L("Category, data value, percent of total"),
                      color=C(TOKENS["ink.indigo"]), fontSize=N(9), bold=B(False),
                      labelDisplayUnits=N(1), position=L("preferOutside"),
                      fontFamily=L(FONT_REGULAR)),
        "slices": obj(innerRadiusRatio=I(inner_radius), startAngle=I(start_angle)),
        "dataPoint": obj(fill=C(TOKENS["accent.crimson"])),
    }
    vc = title_vc(title, color=TOKENS["ink.primary"], size=13, bold=True,
                  space_below=6)
    vc.update(frame(shadow=True))
    return container("donutChart", position(x, y, w, h, z=z), objects, vc)


def line_chart(title, x, y, w, h, z=5000, area=False):
    objects = {
        "categoryAxis": obj(show=B(True), showAxisTitle=B(False),
                            labelColor=C(TOKENS["ink.indigo"]), fontSize=N(10),
                            bold=B(True), fontFamily=L(FONT_REGULAR)),
        "valueAxis": obj(show=B(False), showAxisTitle=B(False),
                         labelColor=C(TOKENS["ink.indigo"]),
                         labelDisplayUnits=N(1), gridlineShow=B(False)),
        "labels": obj(show=B(True), color=C(TOKENS["ink.primary"]),
                      fontSize=N(12), bold=B(False), labelDisplayUnits=N(1),
                      labelPrecision=I(0), fontFamily=L(FONT_REGULAR)),
        "lineStyles": obj(strokeWidth=I(2), showMarker=B(True),
                          markerShape=L("circle"), markerSize=N(8),
                          **({"areaShow": B(True)} if area else {})),
        "legend": obj(show=B(False), position=L("TopCenter"),
                      labelColor=C(TOKENS["ink.indigo"]), fontSize=N(9)),
        "dataPoint": obj(fill=C(TOKENS["accent.crimson"])),
    }
    vc = title_vc(title, color=TOKENS["ink.indigo"], size=14, bold=True)
    vc["title"][0]["properties"]["heading"] = L("Normal")
    vc.update(frame(shadow=True))
    vc["spacing"] = obj(verticalSpacing=N(0))
    vc["padding"] = obj(bottom=N(5))
    return container("lineChart", position(x, y, w, h, z=z), objects, vc)


def bar_chart(title, x, y, w, h, z=5000, clustered=False):
    objects = {
        "categoryAxis": obj(show=B(True), showAxisTitle=B(False),
                            labelColor=C(TOKENS["ink.indigo"]), fontSize=N(10),
                            bold=B(True), fontFamily=L(FONT_REGULAR),
                            preferredCategoryWidth=N(20), maxMarginFactor=I(50),
                            innerPadding=I(8)),
        "valueAxis": obj(show=B(False), showAxisTitle=B(False)),
        "labels": obj(show=B(True), color=C(TOKENS["ink.indigo"]), fontSize=N(10),
                      bold=B(True), labelDisplayUnits=N(1), labelOverflow=B(True),
                      fontFamily=L(FONT_REGULAR)),
        "dataPoint": obj(fill=C(TOKENS["accent.crimson"])),
        "legend": obj(labelColor=C(TOKENS["ink.indigo"]), fontSize=N(9),
                      bold=B(False)),
        "totals": obj(show=B(False)),
    }
    vc = title_vc(title, color=TOKENS["accent.crimson"], size=14, bold=True)
    vc.update(frame(shadow=True))
    vc["stylePreset"] = obj(name=L("Condensed"))
    vc["padding"] = obj(bottom=N(0), left=N(0), right=N(0))
    vc["spacing"] = obj(verticalSpacing=N(0))
    return container("clusteredBarChart" if clustered else "barChart",
                     position(x, y, w, h, z=z), objects, vc)


def section_panel(heading, x, y, w, h, z=1500, color=None):
    """The white rounded panel that sits behind a cluster of KPI cards."""
    return container(
        "textbox",
        position(x, y, w, h, z=z),
        objects={
            "general": obj(paragraphs=[{"textRuns": [{
                "value": heading,
                "textStyle": {"fontWeight": "bold", "fontStyle": "italic",
                              "fontSize": "16pt",
                              "color": color or TOKENS["ink.primary"]},
            }]}])
        },
        vc_objects={
            "background": obj(color=C("#ffffff"), transparency=N(30)),
            "border": obj(show=B(True), radius=N(10), color=C("#ffffff")),
            "dropShadow": obj(show=B(True), color=SHADOW),
        },
    )


def page_json(name, display_name, width=1280, height=720, hidden=False):
    page = {
        "$schema": SCHEMA_PAGE,
        "name": name,
        "displayName": display_name,
        "displayOption": "FitToPage",
        "height": height,
        "width": width,
        "objects": {
            "background": obj(color=C(TOKENS["canvas.grey"]), transparency=N(30))
        },
    }
    if hidden:
        page["visibility"] = "HiddenInViewMode"
    return page


def write_json(path, data):
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
