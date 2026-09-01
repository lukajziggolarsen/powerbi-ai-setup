#!/usr/bin/env python3
"""Install the house theme into a PBIR report and register it correctly.

    python3 install_theme.py "/path/to/My Report.Report"

Theme registration has three requirements that are easy to get wrong and fail
*silently* in the Power BI service:

1. ``customTheme.type`` must be ``RegisteredResources`` — ``SharedResources``
   is for Microsoft's built-in base themes and makes a custom theme no-op.
2. ``customTheme.name`` must include the ``.json`` extension and match both the
   file's own internal ``name`` field and the ``resourcePackages`` item's
   ``name`` and ``path`` exactly.
3. ``customTheme.reportVersionAtImport`` is required by the report schema. The
   host manages it; this script preserves an existing value and otherwise seeds
   one from the report's sibling base theme.

The base theme in ``themeCollection.baseTheme`` is left alone — the custom
theme layers on top of it.
"""

from __future__ import annotations

import argparse
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_THEME = os.path.join(HERE, "..", "assets", "scapp-theme.json")
DEFAULT_VERSION_AT_IMPORT = {"visual": "1.8.89", "report": "2.0.89", "page": "1.3.89"}


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("report", help="path to the *.Report directory")
    ap.add_argument("--theme", default=DEFAULT_THEME,
                    help="theme JSON to install (default: the house theme)")
    ap.add_argument("--name", default="ScappHouseStyle.json",
                    help="registered file name; must end in .json")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    if not args.name.endswith(".json"):
        sys.exit("--name must end in .json")

    report_json = os.path.join(args.report, "definition", "report.json")
    if not os.path.exists(report_json):
        sys.exit(f"not a PBIR report directory: {args.report}")

    with open(args.theme, encoding="utf-8") as fh:
        theme = json.load(fh)
    # Requirement 2: the theme's own name must match the registered file name.
    theme["name"] = args.name

    with open(report_json, encoding="utf-8") as fh:
        report = json.load(fh)

    tc = report.setdefault("themeCollection", {})
    existing = tc.get("customTheme") or {}
    # Requirement 3: preserve the host-managed version when it is already there.
    version = existing.get("reportVersionAtImport") \
        or (tc.get("baseTheme") or {}).get("reportVersionAtImport") \
        or DEFAULT_VERSION_AT_IMPORT

    tc["customTheme"] = {
        "name": args.name,
        "type": "RegisteredResources",      # requirement 1
        "reportVersionAtImport": version,
    }

    packages = [p for p in report.get("resourcePackages", [])
                if p.get("type") != "RegisteredResources"]
    packages.append({
        "name": "RegisteredResources",
        "type": "RegisteredResources",
        "items": [{"name": args.name, "path": args.name, "type": "CustomTheme"}],
    })
    report["resourcePackages"] = packages

    dest_dir = os.path.join(args.report, "StaticResources", "RegisteredResources")
    dest = os.path.join(dest_dir, args.name)

    if args.dry_run:
        print(json.dumps({"themeCollection": tc,
                          "resourcePackages": report["resourcePackages"],
                          "themeFile": dest}, indent=2))
        return

    os.makedirs(dest_dir, exist_ok=True)
    with open(dest, "w", encoding="utf-8") as fh:
        json.dump(theme, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    with open(report_json, "w", encoding="utf-8") as fh:
        json.dump(report, fh, indent=2, ensure_ascii=False)
        fh.write("\n")

    print(f"installed {args.name}")
    print(f"  {dest}")
    print(f"  registered in {report_json}")
    print("  verify: powerbi-report-author validate "
          f"{args.report!r}")


if __name__ == "__main__":
    main()
