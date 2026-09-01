#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { scan } from "./pbi-audit.mjs";

const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "pbi-audit-fixture-"));
const reportDir = path.join(fixtureRoot, "Fixture.Report");
const modelDir = path.join(fixtureRoot, "Fixture.SemanticModel");
const pageName = "ReportSectionFixture";
const visualName = "visualFixture";
const visualDir = path.join(reportDir, "definition", "pages", pageName, "visuals", visualName);
const tableDir = path.join(modelDir, "definition", "tables");
const outDir = path.join(fixtureRoot, "audit");

try {
  fs.mkdirSync(visualDir, { recursive: true });
  fs.mkdirSync(tableDir, { recursive: true });
  fs.writeFileSync(path.join(reportDir, "definition", "pages", "pages.json"), JSON.stringify({
    pageOrder: [pageName],
    activePageName: pageName,
  }));
  fs.writeFileSync(path.join(reportDir, "definition", "pages", pageName, "page.json"), JSON.stringify({
    name: pageName,
    displayName: "Summary",
    width: 1280,
    height: 720,
  }));
  fs.writeFileSync(path.join(visualDir, "visual.json"), JSON.stringify({
    name: visualName,
    position: { x: 0, y: 0, width: 300, height: 200 },
    visual: {
      visualType: "cardVisual",
      query: {
        queryState: {
          Data: {
            projections: [{
              field: {
                Measure: {
                  Expression: { SourceRef: { Entity: "Sales" } },
                  Property: "Total Sales",
                },
              },
              queryRef: "Sales.Stale Old Label",
            }],
          },
        },
      },
    },
  }));
  fs.writeFileSync(path.join(reportDir, "definition", "report.json"), "{}");
  fs.writeFileSync(path.join(modelDir, "definition", "model.tmdl"), "model Model\n\nref table Sales\n");
  fs.writeFileSync(path.join(modelDir, "definition", "relationships.tmdl"), "");
  fs.writeFileSync(path.join(tableDir, "Sales.tmdl"), `table Sales
\tcolumn Amount
\t\tdataType: decimal
\t\tsourceColumn: Amount

\tcolumn Unused
\t\tdataType: string
\t\tsourceColumn: Unused

\tcolumn AmountBand = IF(Sales[Amount] >= 100, "High", "Low")
\t\tdataType: string

\tmeasure 'Total Sales' = SUM(Sales[Amount])
\t\tformatString: #,0

\tpartition Sales = m
\t\tmode: import
\t\tsource = let Source = #table({}, {}), Added = Table.AddColumn(Source, "Band", each "High") in Added
`);

  scan(fixtureRoot, { mode: "full", out: outDir });

  const summary = JSON.parse(fs.readFileSync(path.join(outDir, "summary.json"), "utf8"));
  assert.equal(summary.counts.pages, 1);
  assert.equal(summary.counts.visuals, 1);
  assert.equal(summary.counts.measures, 1);
  assert.equal(summary.counts.missingReferences, 0);

  const usage = fs.readFileSync(path.join(outDir, "report-usage.jsonl"), "utf8")
    .trim().split("\n").map(JSON.parse);
  assert.equal(usage.length, 1);
  assert.equal(usage[0].target, "Sales[Total Sales]");
  assert.equal(usage[0].status, "resolved");

  const unused = fs.readFileSync(path.join(outDir, "unused.jsonl"), "utf8")
    .trim().split("\n").filter(Boolean).map(JSON.parse);
  assert(unused.some((item) => item.name === "Unused"));
  assert(!unused.some((item) => item.name === "Total Sales"));
  assert(!unused.some((item) => item.name === "Sales" && item.kind === "table"));

  const findings = fs.readFileSync(path.join(outDir, "findings.jsonl"), "utf8")
    .trim().split("\n").filter(Boolean).map(JSON.parse);
  assert(findings.some((item) => item.rule === "calculated-column-placement"));
  assert(findings.some((item) => item.rule === "m-add-column-placement"));

  const audit = fs.readFileSync(path.join(outDir, "audit.md"), "utf8");
  assert.match(audit, /does not fully parse or validate every RLS\/OLS/i);

  process.stdout.write("pbi-audit fixture test passed\n");
} finally {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
}
