#!/usr/bin/env python3
"""Audit a PBIR report against the Scapp blueprint and print deviations.

    python3 check_style.py "/path/to/My Report.Report"
    python3 check_style.py "/path/to/My Report.Report" --json
    python3 check_style.py "/path/to/My Report.Report" --page "Portfolio"

Findings are advisory. On legacy pages treat the output as a to-do list; on new
work aim for zero. Exit code is 1 when any ERROR-severity finding is present.
"""

from __future__ import annotations

import argparse
import glob
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from blueprint import (  # noqa: E402
    FONTS_PREFERRED, FONTS_TOLERATED, HOUSE_COLORS, NAV_GEOMETRY, TOKENS,
)

HEX = re.compile(r"^#[0-9A-Fa-f]{6}$")
CORE_VISUALS = {
    "card", "slicer", "pivotTable", "tableEx", "donutChart", "lineChart",
    "barChart", "clusteredBarChart", "columnChart", "clusteredColumnChart",
    "shape", "pageNavigator", "textbox", "group", "areaChart",
    "stackedAreaChart", "hundredPercentStackedAreaChart",
    "hundredPercentStackedBarChart", "hundredPercentStackedColumnChart",
    "lineClusteredColumnComboChart", "lineStackedColumnComboChart",
    "actionButton", "image",
}

# Band heights actually observed across the estate, by canvas width. Core
# Marketing uses a taller 63px band on 1280 canvases when the header carries
# labelled slicers, so a single expected value would be wrong.
BAND_HEIGHTS_NARROW = {46, 47, 48, 50, 52, 63}
BAND_HEIGHTS_WIDE = {69, 70}


def lit(node):
    """Resolve a PBIR property value to a scalar."""
    if not isinstance(node, dict):
        return node
    expr = node.get("expr", node)
    if isinstance(expr, dict):
        if "Literal" in expr:
            val = expr["Literal"].get("Value")
            if isinstance(val, str):
                val = val.strip("'")
                if re.fullmatch(r"-?[\d.]+D", val):
                    return float(val[:-1])
                if re.fullmatch(r"-?\d+L", val):
                    return int(val[:-1])
                if val in ("true", "false"):
                    return val == "true"
            return val
        if "ThemeDataColor" in expr:
            t = expr["ThemeDataColor"]
            return f"THEME[{t.get('ColorId')}@{t.get('Percent')}]"
        if "solid" in expr:
            return lit(expr["solid"].get("color", {}))
    if "solid" in node:
        return lit(node["solid"].get("color", {}))
    return None


def props(group):
    """Flatten objects/visualContainerObjects to {obj.prop: value}."""
    out = {}
    for oname, entries in (group or {}).items():
        if not isinstance(entries, list):
            continue
        for ent in entries:
            for pname, pval in (ent.get("properties") or {}).items():
                out.setdefault(f"{oname}.{pname}", lit(pval))
    return out


def walk_colors(node):
    """Yield every hex color literal anywhere in a visual."""
    if isinstance(node, dict):
        for k, v in node.items():
            if k == "Value" and isinstance(v, str):
                s = v.strip("'")
                if HEX.fullmatch(s):
                    yield s.upper()
            else:
                yield from walk_colors(v)
    elif isinstance(node, list):
        for v in node:
            yield from walk_colors(v)


def walk_fonts(node):
    if isinstance(node, dict):
        for k, v in node.items():
            if k in ("fontFamily", "fontFace") and isinstance(v, dict):
                f = lit(v)
                if isinstance(f, str):
                    yield f
            else:
                yield from walk_fonts(v)
    elif isinstance(node, list):
        for v in node:
            yield from walk_fonts(v)


def check(report_dir, only_page=None):
    findings = []

    def add(sev, page, visual, rule, msg, path=""):
        findings.append({"severity": sev, "page": page, "visual": visual,
                         "rule": rule, "message": msg, "path": path})

    pages_dir = os.path.join(report_dir, "definition", "pages")
    meta_path = os.path.join(pages_dir, "pages.json")
    order = []
    if os.path.exists(meta_path):
        with open(meta_path, encoding="utf-8") as fh:
            order = json.load(fh).get("pageOrder", [])

    page_files = sorted(glob.glob(os.path.join(pages_dir, "*", "page.json")))
    for pj in page_files:
        with open(pj, encoding="utf-8") as fh:
            page = json.load(fh)
        pname = page.get("displayName") or page.get("name")
        if only_page and only_page.lower() not in str(pname).lower():
            continue
        pdir = os.path.dirname(pj)
        pw = page.get("width") or 0
        ph = page.get("height") or 0
        rel = os.path.relpath(pj, report_dir)

        if page.get("name") not in order:
            add("ERROR", pname, "", "page-registered",
                "page is not listed in pages.json pageOrder", rel)
        if page.get("displayOption") != "FitToPage":
            add("WARN", pname, "", "page-fit",
                f"displayOption is {page.get('displayOption')!r}, expected 'FitToPage'", rel)

        bg = props(page.get("objects"))
        bgc = bg.get("background.color")
        if bgc is None:
            add("WARN", pname, "", "page-background",
                "page has no background; expected #E6E6E6 at transparency 30", rel)
        elif isinstance(bgc, str) and bgc.upper() not in (
                TOKENS["canvas.grey"], "THEME[0@-0.1]"):
            add("WARN", pname, "", "page-background",
                f"page background {bgc} is not #E6E6E6 / ThemeDataColor(0,-0.1)", rel)
        tr = bg.get("background.transparency")
        if tr is not None and tr != 30:
            add("INFO", pname, "", "page-background",
                f"page background transparency {tr:g}, house value is 30", rel)

        if (pw, ph) not in {(1280, 720), (1400, 720), (1500, 720), (1250, 750),
                            (1280, 1000), (1400, 850), (1500, 1000), (1400, 1166),
                            (1401, 1200), (1400, 1200), (1330, 963), (1700, 1080),
                            (1800, 1100)}:
            add("INFO", pname, "", "page-size",
                f"canvas {pw}x{ph} is not one of the established sizes", rel)

        # ---- visuals
        band = nav = None
        vfiles = sorted(glob.glob(os.path.join(pdir, "visuals", "*", "visual.json")))
        for vf in vfiles:
            with open(vf, encoding="utf-8") as fh:
                vis = json.load(fh)
            vrel = os.path.relpath(vf, report_dir)
            v = vis.get("visual", {})
            vt = v.get("visualType") or ("group" if "visualGroup" in vis else "None")
            pos = vis.get("position") or {}
            po = props(v.get("objects"))
            vc = props(v.get("visualContainerObjects"))
            vid = vis.get("name", "")[:8]

            if vt not in CORE_VISUALS and not vt.startswith(("None",)):
                add("INFO", pname, vid, "visual-type",
                    f"{vt!r} is outside the core visual set", vrel)

            for colr in set(walk_colors(vis)):
                if colr not in HOUSE_COLORS:
                    add("INFO", pname, vid, "color-off-palette",
                        f"{colr} is not a house color", vrel)
            for fnt in set(walk_fonts(vis)):
                if fnt not in FONTS_TOLERATED:
                    add("WARN", pname, vid, "font",
                        f"font {fnt!r} is not a house family", vrel)
                elif fnt not in FONTS_PREFERRED:
                    add("INFO", pname, vid, "font",
                        f"font {fnt!r} is legacy; use wf_standard-font "
                        "for new work", vrel)

            if vt == "shape" and pos.get("y", 1) < 5 and \
                    pos.get("width", 0) >= 0.9 * (pw or 1):
                band = (vis, pos, po, vrel)
            if vt == "pageNavigator":
                nav = (vis, pos, po, vrel)

            if vt == "card":
                if po.get("categoryLabels.show") is not False:
                    add("WARN", pname, vid, "card-category-label",
                        "card shows the built-in category label; use the "
                        "container title instead", vrel)
                if vc.get("title.show") is not False and \
                        vc.get("title.alignment") not in (None, "center"):
                    add("WARN", pname, vid, "card-title-align",
                        f"card title alignment {vc.get('title.alignment')!r}, "
                        "house style is centered", vrel)
                if po.get("labels.bold") is True:
                    add("INFO", pname, vid, "card-value-weight",
                        "card value is bold; house cards are not", vrel)
                lc = po.get("labels.color")
                if isinstance(lc, str) and lc.upper() not in (
                        TOKENS["ink.primary"], TOKENS["ink.deepNavy"],
                        TOKENS["ink.indigo"]) and not lc.startswith("THEME"):
                    add("INFO", pname, vid, "card-value-ink",
                        f"card value color {lc}, house ink is #094780", vrel)

            if vt == "pivotTable":
                ch = po.get("columnHeaders.backColor")
                if isinstance(ch, str) and ch.upper() != TOKENS["accent.crimson"] \
                        and not ch.startswith("THEME"):
                    add("WARN", pname, vid, "matrix-header",
                        f"matrix column-header fill {ch}, house style is #E43E4C", vrel)
                rh = po.get("rowHeaders.fontColor")
                if isinstance(rh, str) and rh.upper() != TOKENS["ink.primary"] \
                        and not rh.startswith("THEME"):
                    add("INFO", pname, vid, "matrix-rows",
                        f"matrix row-header ink {rh}, house style is #094780", vrel)
                if vc.get("stylePreset.name") not in ("Condensed", None):
                    add("INFO", pname, vid, "matrix-preset",
                        f"style preset {vc.get('stylePreset.name')!r}, "
                        "house style is 'Condensed'", vrel)

            if vt in ("lineChart", "barChart", "clusteredBarChart", "columnChart",
                      "clusteredColumnChart", "areaChart"):
                if po.get("valueAxis.show") is not False:
                    add("WARN", pname, vid, "chart-value-axis",
                        "value axis is visible; house charts hide it and show "
                        "data labels", vrel)
                if po.get("labels.show") is not True:
                    add("INFO", pname, vid, "chart-data-labels",
                        "data labels are off; house charts turn them on", vrel)
                if po.get("categoryAxis.showAxisTitle") is True or \
                        po.get("valueAxis.showAxisTitle") is True:
                    add("INFO", pname, vid, "chart-axis-title",
                        "axis title shown; house charts hide axis titles", vrel)

        if band is None:
            add("ERROR", pname, "", "header-band",
                "no full-width header band shape at the top of the page", rel)
        else:
            _, bpos, bpo, brel = band
            fill = bpo.get("fill.fillColor")
            if isinstance(fill, str) and fill.upper() not in (
                    TOKENS["band.red"], TOKENS["band.redAlt"]):
                add("WARN", pname, "band", "header-band-color",
                    f"band fill {fill}, house band is #EA3F3F", brel)
            allowed = BAND_HEIGHTS_WIDE if pw >= 1700 else BAND_HEIGHTS_NARROW
            got = round(bpos.get("height") or 0)
            if not any(abs(got - a) <= 1 for a in allowed):
                add("INFO", pname, "band", "header-band-height",
                    f"band height {got}, house values for this canvas are "
                    f"{sorted(allowed)}", brel)
            if bpos.get("z", 0) != 0:
                add("INFO", pname, "band", "header-band-z",
                    f"band z={bpos.get('z'):.0f}, expected 0 so it sits behind "
                    "the header furniture", brel)

        if nav is None:
            add("WARN", pname, "", "navigator",
                "page has no page navigator", rel)
        else:
            _, npos, npo, nrel = nav
            want = NAV_GEOMETRY.get(int(pw or 0))
            if want and (abs(npos.get("x", 0) - want[0]) > 40 or
                         abs(npos.get("width", 0) - want[1]) > 40):
                add("INFO", pname, "nav", "navigator-geometry",
                    f"navigator at x={npos.get('x'):.0f} w={npos.get('width'):.0f}, "
                    f"house value for a {pw}px canvas is x={want[0]} w={want[1]}", nrel)
            sel = None
            for ent in (nav[0]["visual"].get("objects", {}).get("fill") or []):
                if (ent.get("selector") or {}).get("id") == "selected":
                    sel = lit(ent["properties"].get("fillColor"))
            if isinstance(sel, str) and sel.upper() != TOKENS["ink.primary"]:
                add("WARN", pname, "nav", "navigator-selected",
                    f"navigator selected fill {sel}, house value is #094780", nrel)

    return findings


SEV_ORDER = {"ERROR": 0, "WARN": 1, "INFO": 2}


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("report", help="path to the *.Report directory")
    ap.add_argument("--page", help="only check pages whose name contains this")
    ap.add_argument("--json", action="store_true", dest="as_json")
    ap.add_argument("--min-severity", default="INFO",
                    choices=["ERROR", "WARN", "INFO"])
    args = ap.parse_args()

    if not os.path.isdir(os.path.join(args.report, "definition", "pages")):
        sys.exit(f"not a PBIR report directory: {args.report}")

    findings = check(args.report, args.page)
    cutoff = SEV_ORDER[args.min_severity]
    findings = [f for f in findings if SEV_ORDER[f["severity"]] <= cutoff]
    findings.sort(key=lambda f: (SEV_ORDER[f["severity"]], f["page"], f["rule"]))

    if args.as_json:
        print(json.dumps(findings, indent=2))
    elif not findings:
        print("clean — no deviations from the blueprint")
    else:
        current = None
        for f in findings:
            if f["page"] != current:
                current = f["page"]
                print(f"\n=== {current}")
            who = f"{f['visual']:>8s} " if f["visual"] else " " * 9
            print(f"  {f['severity']:<5s} {who}{f['rule']:<24s} {f['message']}")
        counts = {}
        for f in findings:
            counts[f["severity"]] = counts.get(f["severity"], 0) + 1
        print("\n" + ", ".join(f"{v} {k}" for k, v in sorted(
            counts.items(), key=lambda kv: SEV_ORDER[kv[0]])))

    return 1 if any(f["severity"] == "ERROR" for f in findings) else 0


if __name__ == "__main__":
    sys.exit(main())
