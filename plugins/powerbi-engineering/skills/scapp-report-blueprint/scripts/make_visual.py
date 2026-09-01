#!/usr/bin/env python3
"""Emit one house-styled visual as PBIR JSON.

    # print to stdout
    python3 make_visual.py card --title "Total Amount" --x 84 --y 262

    # write straight into a page
    python3 make_visual.py matrix --title "By branch" --x 0 --y 352 \
        --w 1280 --h 360 \
        --into "/path/My.Report/definition/pages/ReportSectionabc.../"

Types: band, nav, card, slicer, matrix, table, donut, line, bar, panel

The emitted visual has no ``query``. Bind fields in Desktop afterwards, or
paste a ``query`` block in yourself.
"""

from __future__ import annotations

import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import blueprint as bp  # noqa: E402


def build(args):
    t = args.type
    if t == "band":
        return bp.header_band(args.w or 1280)
    if t == "nav":
        return bp.page_navigator(args.w or 1280, z=args.z or 1000)
    if t == "card":
        return bp.card(args.title or "Untitled", args.x, args.y,
                       args.w or 212, args.h or 77, z=args.z or 5000,
                       value_size=args.value_size, title_size=args.title_size,
                       transparency=args.transparency, ghost=args.ghost,
                       compact=args.compact)
    if t == "slicer":
        return bp.slicer(args.x, args.y, args.w or 221, args.h or 48,
                         z=args.z or 3000, title=args.title, mode=args.mode,
                         horizontal=not args.vertical)
    if t == "matrix":
        return bp.matrix(args.title or "Untitled matrix", args.x, args.y,
                         args.w or 1156, args.h or 448, z=args.z or 5000)
    if t == "table":
        return bp.table(args.title or "Untitled table", args.x, args.y,
                        args.w or 1253, args.h or 480, z=args.z or 5000)
    if t == "donut":
        return bp.donut(args.title or "Untitled", args.x, args.y,
                        args.w or 320, args.h or 169, z=args.z or 5000)
    if t == "line":
        return bp.line_chart(args.title or "Untitled", args.x, args.y,
                             args.w or 726, args.h or 159, z=args.z or 5000,
                             area=args.area)
    if t == "bar":
        return bp.bar_chart(args.title or "Untitled", args.x, args.y,
                            args.w or 446, args.h or 160, z=args.z or 5000,
                            clustered=args.clustered)
    if t == "panel":
        return bp.section_panel(args.title or "Section", args.x, args.y,
                                args.w or 234, args.h or 285, z=args.z or 1500)
    raise SystemExit(f"unknown type: {t}")


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("type", choices=["band", "nav", "card", "slicer", "matrix",
                                     "table", "donut", "line", "bar", "panel"])
    ap.add_argument("--title")
    ap.add_argument("--x", type=float, default=0)
    ap.add_argument("--y", type=float, default=0)
    ap.add_argument("--w", type=float)
    ap.add_argument("--h", type=float)
    ap.add_argument("--z", type=float)
    ap.add_argument("--value-size", type=float, default=18)
    ap.add_argument("--title-size", type=float, default=12)
    ap.add_argument("--transparency", type=float, default=0)
    ap.add_argument("--ghost", action="store_true",
                    help="card: transparent, for donut centres")
    ap.add_argument("--compact", action="store_true",
                    help="card: the header 'Last Update' variant")
    ap.add_argument("--mode", default="Basic",
                    choices=["Basic", "Dropdown", "Between"])
    ap.add_argument("--vertical", action="store_true",
                    help="slicer: stack items instead of a tile row")
    ap.add_argument("--area", action="store_true", help="line: fill under the line")
    ap.add_argument("--clustered", action="store_true")
    ap.add_argument("--into", help="page directory to write the visual into")
    args = ap.parse_args()

    vis = build(args)

    if not args.into:
        print(json.dumps(vis, indent=2, ensure_ascii=False))
        return

    vdir = os.path.join(args.into, "visuals", vis["name"])
    if not os.path.isdir(os.path.join(args.into, "visuals")) and \
            not os.path.exists(os.path.join(args.into, "page.json")):
        sys.exit(f"not a PBIR page directory: {args.into}")
    os.makedirs(vdir, exist_ok=True)
    bp.write_json(os.path.join(vdir, "visual.json"), vis)
    print(f"wrote {vis['visual']['visualType']} {vis['name']}")
    print(f"  {vdir}/visual.json")


if __name__ == "__main__":
    main()
