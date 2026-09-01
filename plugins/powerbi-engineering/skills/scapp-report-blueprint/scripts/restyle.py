#!/usr/bin/env python3
"""Normalize an existing PBIR report toward the Scapp blueprint.

    python3 restyle.py "/path/to/My Report.Report"            # dry run, default
    python3 restyle.py "/path/to/My Report.Report" --apply
    python3 restyle.py "/path/to/My Report.Report" --apply --only colors,fonts

Only touches formatting. It never edits ``query``, ``filters``, field bindings,
positions, or page structure, so data behavior cannot change.

Rule groups (``--only`` / ``--skip``):
    colors    remap near-miss house colors onto the canonical token
    fonts     remap the legacy Segoe UI regular string to wf_standard-font
    cards     hide built-in category labels, center titles, un-bold values
    charts    hide the value axis and axis titles, turn data labels on
    matrix    crimson column headers, navy row headers, Condensed preset
    page      page background to #E6E6E6 @30, displayOption FitToPage
    nav       navigator selected fill to #094780

**Back up or commit first.** ``--apply`` rewrites files in place.
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
    B, C, FONT_REGULAR, FONT_SEGOE_REGULAR, N, TOKENS, obj,
)

ALL_GROUPS = ["colors", "fonts", "cards", "charts", "matrix", "page", "nav"]

# Near-miss reds/navies seen in the estate that should collapse to a token.
COLOR_REMAP = {
    "#EA3F3F": None,          # band red — only valid on the band shape
    "#E43E4C": "#E43E4C",
    "#12239E": "#243782",     # theme default indigo -> house indigo
    "#000000": "#094780",     # black ink -> house navy
    "#14191E": "#094780",
    "#143461": "#094780",
    "#EEEEEE": "#E6E6E6",
    "#CCCCCC": "#D3D3D3",
    "#B3B3B3": "#D3D3D3",
}

CHART_TYPES = {"lineChart", "barChart", "clusteredBarChart", "columnChart",
               "clusteredColumnChart", "areaChart", "stackedAreaChart"}


def hex_literals(node, path=()):
    """Yield (parent_dict, key, hexvalue) for every hex color literal."""
    if isinstance(node, dict):
        for k, v in list(node.items()):
            if k == "Value" and isinstance(v, str):
                s = v.strip("'")
                if re.fullmatch(r"#[0-9A-Fa-f]{6}", s):
                    yield node, k, s.upper(), path
            else:
                yield from hex_literals(v, path + (k,))
    elif isinstance(node, list):
        for i, v in enumerate(node):
            yield from hex_literals(v, path + (i,))


def font_literals(node):
    if isinstance(node, dict):
        for k, v in list(node.items()):
            if k in ("fontFamily", "fontFace") and isinstance(v, dict):
                lit = v.get("expr", {}).get("Literal", {})
                if isinstance(lit.get("Value"), str):
                    yield lit
            else:
                yield from font_literals(v)
    elif isinstance(node, list):
        for v in node:
            yield from font_literals(v)


def ensure(objects, obj_name, properties, /):
    """Set ``properties`` on the unselected entry of ``objects[obj_name]``,
    creating it if needed. Returns the property names that actually changed.

    Positional-only so a property literally named ``name`` (stylePreset) cannot
    collide with the parameter.
    """
    entries = objects.setdefault(obj_name, [])
    entry = next((e for e in entries if not e.get("selector")), None)
    if entry is None:
        entry = {"properties": {}}
        entries.insert(0, entry)
    props = entry.setdefault("properties", {})
    changed = []
    for k, v in properties.items():
        if json.dumps(props.get(k), sort_keys=True) != json.dumps(v, sort_keys=True):
            props[k] = v
            changed.append(f"{obj_name}.{k}")
    return changed


def restyle_visual(vis, groups, is_band):
    """Mutate a visual dict in place. Returns a list of change descriptions."""
    changes = []
    v = vis.get("visual")
    if not v:
        return changes
    vt = v.get("visualType")

    if "colors" in groups and not is_band:
        for parent, key, val, _ in hex_literals(vis):
            tgt = COLOR_REMAP.get(val)
            if tgt and tgt != val:
                parent[key] = f"'{tgt}'"
                changes.append(f"color {val} -> {tgt}")

    if "fonts" in groups:
        for lit in font_literals(vis):
            if lit["Value"].strip("'") == FONT_SEGOE_REGULAR:
                lit["Value"] = f"'{FONT_REGULAR}'"
                changes.append("font Segoe UI -> wf_standard-font")

    if "cards" in groups and vt == "card":
        o = v.setdefault("objects", {})
        changes += ensure(o, "categoryLabels", {"show": B(False)})
        changes += ensure(o, "labels", {"bold": B(False)})
        centered = {"expr": {"Literal": {"Value": "'center'"}}}
        for e in (v.get("visualContainerObjects") or {}).get("title") or []:
            p = e.get("properties", {})
            if ("show" in p or "text" in p) and \
                    json.dumps(p.get("alignment")) != json.dumps(centered):
                p["alignment"] = centered
                changes.append("title.alignment -> center")

    if "charts" in groups and vt in CHART_TYPES:
        o = v.setdefault("objects", {})
        changes += ensure(o, "valueAxis", {"show": B(False),
                                           "showAxisTitle": B(False)})
        changes += ensure(o, "categoryAxis", {"showAxisTitle": B(False)})
        changes += ensure(o, "labels", {"show": B(True)})

    if "matrix" in groups and vt == "pivotTable":
        o = v.setdefault("objects", {})
        changes += ensure(o, "columnHeaders",
                          {"backColor": C(TOKENS["accent.crimson"]),
                           "fontColor": C(TOKENS["surface.white"])})
        changes += ensure(o, "rowHeaders",
                          {"fontColor": C(TOKENS["ink.primary"])})
        changes += ensure(o, "grid",
                          {"gridHorizontalColor": C(TOKENS["line.grid"]),
                           "gridVerticalColor": C(TOKENS["line.grid"])})
        vco = v.setdefault("visualContainerObjects", {})
        changes += ensure(vco, "stylePreset",
                          {"name": {"expr": {"Literal": {"Value": "'Condensed'"}}}})

    if "nav" in groups and vt == "pageNavigator":
        o = v.setdefault("objects", {})
        fills = o.setdefault("fill", [])
        found = False
        for e in fills:
            if (e.get("selector") or {}).get("id") == "selected":
                found = True
                if json.dumps(e["properties"].get("fillColor")) != json.dumps(
                        C(TOKENS["ink.primary"])):
                    e["properties"]["fillColor"] = C(TOKENS["ink.primary"])
                    changes.append("nav selected fill -> #094780")
        if not found:
            fills.append({"properties": {"fillColor": C(TOKENS["ink.primary"])},
                          "selector": {"id": "selected"}})
            changes.append("nav selected fill added")

    return changes


def restyle_page(page, groups):
    changes = []
    if "page" not in groups:
        return changes
    if page.get("displayOption") != "FitToPage":
        page["displayOption"] = "FitToPage"
        changes.append("displayOption -> FitToPage")
    objects = page.setdefault("objects", {})
    want = obj(color=C(TOKENS["canvas.grey"]), transparency=N(30))
    cur = objects.get("background")
    if json.dumps(cur, sort_keys=True) != json.dumps(want, sort_keys=True):
        # Preserve a themed background; only fix a missing or odd one.
        cur_color = json.dumps(cur or "")
        if not cur or "ThemeDataColor" not in cur_color:
            objects["background"] = want
            changes.append("page background -> #E6E6E6 @30")
    return changes


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("report")
    ap.add_argument("--apply", action="store_true",
                    help="write changes (default is a dry run)")
    ap.add_argument("--only", help="comma-separated rule groups to run")
    ap.add_argument("--skip", help="comma-separated rule groups to skip")
    ap.add_argument("--page", help="only pages whose name contains this")
    args = ap.parse_args()

    groups = set(args.only.split(",")) if args.only else set(ALL_GROUPS)
    if args.skip:
        groups -= set(args.skip.split(","))
    unknown = groups - set(ALL_GROUPS)
    if unknown:
        sys.exit(f"unknown rule group(s): {', '.join(sorted(unknown))}")

    pages_dir = os.path.join(args.report, "definition", "pages")
    if not os.path.isdir(pages_dir):
        sys.exit(f"not a PBIR report directory: {args.report}")

    total = 0
    for pj in sorted(glob.glob(os.path.join(pages_dir, "*", "page.json"))):
        with open(pj, encoding="utf-8") as fh:
            page = json.load(fh)
        pname = page.get("displayName") or page.get("name")
        if args.page and args.page.lower() not in str(pname).lower():
            continue
        pw = page.get("width") or 0
        page_changes = restyle_page(page, groups)
        if page_changes:
            total += len(page_changes)
            print(f"{pname}: page.json")
            for c in page_changes:
                print(f"    {c}")
            if args.apply:
                with open(pj, "w", encoding="utf-8") as fh:
                    json.dump(page, fh, indent=2, ensure_ascii=False)
                    fh.write("\n")

        for vf in sorted(glob.glob(os.path.join(os.path.dirname(pj),
                                                "visuals", "*", "visual.json"))):
            with open(vf, encoding="utf-8") as fh:
                vis = json.load(fh)
            pos = vis.get("position") or {}
            vtype = (vis.get("visual") or {}).get("visualType")
            is_band = (vtype == "shape" and pos.get("y", 1) < 5
                       and pos.get("width", 0) >= 0.9 * (pw or 1))
            changes = restyle_visual(vis, groups, is_band)
            if changes:
                total += len(changes)
                print(f"{pname}: {vtype} {vis.get('name','')[:8]}")
                for c in sorted(set(changes)):
                    print(f"    {c}")
                if args.apply:
                    with open(vf, "w", encoding="utf-8") as fh:
                        json.dump(vis, fh, indent=2, ensure_ascii=False)
                        fh.write("\n")

    if not total:
        print("nothing to change")
    elif args.apply:
        print(f"\napplied {total} change(s) — validate, then reload Desktop")
    else:
        print(f"\n{total} change(s) proposed — re-run with --apply to write")


if __name__ == "__main__":
    main()
