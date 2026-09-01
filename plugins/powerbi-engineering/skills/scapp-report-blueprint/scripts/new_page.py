#!/usr/bin/env python3
"""Scaffold a house-style PBIR page: header band, navigator, Last Update card,
and the skeleton of a chosen archetype.

    python3 new_page.py --report "/path/to/My Report.Report" \
                        --name "Portfolio" --archetype A

Archetypes (see ../references/archetypes.md):
    A  matrix page              header + filter strip + one big matrix
    B  KPI row + charts + matrix
    C  dense KPI grid           4x4 wall of cards
    D  split analysis           two donuts + line, then a matrix
    E  detail table             header + slicers + one big table
    -  bare                     header furniture only

Visuals are emitted without a ``query``: open the page in Desktop and bind
fields, or add projections yourself. The chrome and styling are done.
"""

from __future__ import annotations

import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from blueprint import (  # noqa: E402
    SCHEMA_PAGES, bar_chart, card, donut, header_band, line_chart, matrix,
    new_page_id, page_json, page_navigator, section_panel, slicer, table,
    write_json,
)


def build_archetype(kind, w, h):
    """Return the body visuals for an archetype on a w x h canvas."""
    v = []
    if kind == "A":
        v.append(slicer(0, 2, 221, 48, z=3000, mode="Dropdown", horizontal=False))
        v.append(slicer(round(w * 0.05), 96, round(w * 0.90), 52, z=4000))
        v.append(matrix("Untitled matrix", round(w * 0.05), 174,
                        round(w * 0.90), h - 174 - 98, z=5000))
    elif kind == "B":
        v.append(slicer(0, 0, 261, 47, z=2000, mode="Dropdown", horizontal=False))
        v.append(line_chart("Current Month Trend", 0, 61, w, 182, z=7000, area=True))
        card_w, gap = 229, 47
        total = card_w * 4 + gap * 3
        x0 = round((w - total) / 2)
        for i, label in enumerate(["Total Quantity", "Total Amount",
                                   "Net Amount", "Average Amount"]):
            v.append(card(label, x0 + i * (card_w + gap), 262, card_w, 71,
                          z=4000 + i * 1000))
        v.append(matrix("Detail by dimension", 0, 352, round(w * 0.73), h - 352 - 12,
                        z=3000))
        v.append(matrix("Range breakdown", round(w * 0.755), 352,
                        round(w * 0.238), h - 352 - 12, z=9000))
    elif kind == "C":
        cw, ch, px, py = 247, 91, 251, 94
        x0, y0 = 17, 107
        cols = max(1, int((w - x0 * 2 + (px - cw)) // px))
        n = 0
        for row in range(4):
            for col in range(cols):
                n += 1
                v.append(card(f"KPI {n}", x0 + col * px, y0 + row * py,
                              cw, ch, z=4000 + n * 100))
    elif kind == "D":
        v.append(slicer(0, 55, round(w * 0.515), 49, z=9000))
        v.append(slicer(round(w * 0.527), 55, round(w * 0.473), 49, z=13000))
        v.append(donut("Quantity by category", 0, 118, 320, 169, z=5000))
        v.append(card("Total Quantity", 124, 199, 72, 49, z=6000,
                      ghost=True, value_size=11, title_size=8))
        v.append(donut("Amount by category", 339, 118, 320, 169, z=4000))
        v.append(card("Total Amount", 462, 198, 75, 50, z=7000,
                      ghost=True, value_size=11, title_size=8))
        v.append(line_chart("Trend over time", 675, 117, w - 675, 170, z=11000))
        v.append(matrix("Detail by dimension", 0, 314, w, h - 314 - 1, z=10000))
    elif kind == "E":
        v.append(slicer(2, 68, 180, 58, z=3000, mode="Dropdown", horizontal=False))
        v.append(slicer(194, 68, 180, 58, z=9000, mode="Dropdown", horizontal=False))
        v.append(slicer(374, 68, w - 394, 55, z=5000, title="User:"))
        v.append(table("Detail rows", 16, 163, w - 32, h - 163 - 20, z=6000))
    return v


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--report", required=True,
                    help="path to the *.Report directory")
    ap.add_argument("--name", required=True, help="page display name")
    ap.add_argument("--archetype", default="-", choices=list("ABCDE") + ["-"])
    ap.add_argument("--width", type=int, default=1280)
    ap.add_argument("--height", type=int, default=720)
    ap.add_argument("--hidden", action="store_true",
                    help="mark the page HiddenInViewMode")
    ap.add_argument("--last-update-title", default="Last Update")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    pages_dir = os.path.join(args.report, "definition", "pages")
    if not os.path.isdir(pages_dir):
        sys.exit(f"not a PBIR report directory: {args.report}")

    page_id = new_page_id()
    w, h = args.width, args.height

    visuals = [
        header_band(w, h),
        page_navigator(w, z=1000),
        card(args.last_update_title, 290 if w >= 1280 else 5, 3, 174, 38,
             z=2000, compact=True, display_units=False),
    ]
    visuals += build_archetype(args.archetype, w, h)

    page = page_json(page_id, args.name, w, h, hidden=args.hidden)

    if args.dry_run:
        print(json.dumps({"pageId": page_id, "page": page,
                          "visuals": [v["visual"]["visualType"] for v in visuals]},
                         indent=2))
        return

    page_dir = os.path.join(pages_dir, page_id)
    os.makedirs(os.path.join(page_dir, "visuals"), exist_ok=True)
    write_json(os.path.join(page_dir, "page.json"), page)
    for vis in visuals:
        vdir = os.path.join(page_dir, "visuals", vis["name"])
        os.makedirs(vdir, exist_ok=True)
        write_json(os.path.join(vdir, "visual.json"), vis)

    # Register in pages.json.
    meta_path = os.path.join(pages_dir, "pages.json")
    if os.path.exists(meta_path):
        with open(meta_path, encoding="utf-8") as fh:
            meta = json.load(fh)
    else:
        meta = {"$schema": SCHEMA_PAGES, "pageOrder": [], "activePageName": page_id}
    meta.setdefault("pageOrder", []).append(page_id)
    if not meta.get("activePageName"):
        meta["activePageName"] = meta["pageOrder"][0]
    write_json(meta_path, meta)

    missing = [f for f in (".platform", "definition.pbir",
                           "definition/version.json", "definition/report.json")
               if not os.path.exists(os.path.join(args.report, f))]
    if missing:
        print(f"  note: report skeleton is incomplete — missing {', '.join(missing)}")

    unbound = sum(1 for v in visuals
                  if v["visual"]["visualType"] not in
                  ("shape", "pageNavigator", "textbox", "actionButton", "image"))
    print(f"created page {page_id!r} ({args.name}) with {len(visuals)} visuals")
    print(f"  {page_dir}")
    print(f"  {unbound} visual(s) have no field binding yet — until you bind "
          "them,\n  `powerbi-report-author validate` will report exactly that "
          "many\n  PBIR_QUERY_STATE_MISSING errors. That is expected.")
    print("  next: `powerbi-desktop reload`, bind fields in Desktop, "
          "then re-validate")


if __name__ == "__main__":
    main()
