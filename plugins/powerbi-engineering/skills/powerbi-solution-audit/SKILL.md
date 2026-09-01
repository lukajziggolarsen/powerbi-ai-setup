---
name: powerbi-solution-audit
description: Perform a comprehensive, read-only audit of an end-to-end Power BI solution across source contracts and SQL, Power Query and query folding, semantic-model architecture, DAX correctness and performance, VertiPaq/storage, refresh, relationships, RLS/OLS definitions, PBIR pages and visuals, accessibility, dependencies, deployment readiness, and maintainability. Use when the user asks to fully audit, review, explain, assess, optimize, troubleshoot, inventory, or create a remediation roadmap for a PBIP/PBIR/TMDL project, PBIX-connected model, report, or semantic model. Produces detailed evidence artifacts and exact recommendations without modifying source files.
---

# Power BI Solution Audit

Invoke this skill only when the user explicitly asks for a comprehensive or
end-to-end solution audit, or explicitly names this skill. Do not infer it from
a bounded review, diagnosis, visual critique, or ordinary optimization task.

Perform a correctness-first engineering audit. Inspect the entire available
solution, distinguish static inference from measured behavior, and produce a
detailed report that another engineer can implement without rediscovering the
system.

Do not modify PBIP, PBIR, TMDL, M, DAX, SQL, database objects, or workspace
items during this skill. Writing audit artifacts under `.powerbi-audit/` is
allowed.

## Required references

Read these before starting:

- [audit-methodology.md](references/audit-methodology.md) for evidence,
  correctness, scoring, live validation, and safety rules.
- [audit-checklist.md](references/audit-checklist.md) for every required audit
  area. Mark each item as assessed, not applicable, or blocked.
- [official-sources.md](references/official-sources.md) before making
  best-practice claims. Use primary Microsoft guidance and clearly label
  context-dependent recommendations.
- [deliverable-contract.md](references/deliverable-contract.md) before creating
  the final artifacts.
- [live-connection.md](references/live-connection.md) before any live-model
  step: connecting to Desktop, DAX result checks, traces, or refresh tests.
  Use the Windows-side modeling server only — tool prefix
  `mcp__powerbi-modeling__*` in Claude Code, `powerbi-modeling.*` in Codex.
  Never fall back to a Linux/WSL-side modeling server such as
  `mcp__plugin_powerbi-authoring_powerbi-modeling-mcp__*`; it cannot see local
  Desktop instances. Run the preflight in that reference first.

Read [evidence-schema.md](references/evidence-schema.md) when querying or
extending the scanner output.

## Workflow

### 1. Establish scope and evidence

Resolve the project root, `.pbip`, `.Report`, `.SemanticModel`, source SQL
assets, dataflow or deployment files, and any existing documentation or test
queries. State the target environment, storage modes, source systems,
refresh method, business-critical metrics, and available connections.

Create `.powerbi-audit/scope.md` with:

- included and excluded artifacts;
- business questions and metric contracts available;
- static, Desktop-live, service-live, and source-live evidence;
- limitations that prevent proof;
- the source fingerprint and audit timestamp.

If a metric definition is ambiguous, record it as an unresolved contract
question. Do not turn a guessed business meaning into a correctness defect.

### 2. Build the complete static baseline

Run the bundled scanner:

```bash
node "<skill-dir>/scripts/pbi-audit.mjs" scan "<target>" \
  --out "<project>/.powerbi-audit/static"
```

Target the project root for a full scan, or a single `.SemanticModel` /
`.Report` directory for a model-only or report-only baseline.

Use the scanner as a baseline, not as the audit itself. Inspect the underlying
files for every material conclusion and for object types the scanner cannot
fully parse.

Inventory:

- source/query assets and data contracts;
- all Power Query expressions, parameters, functions, and partitions;
- tables, columns, measures, calculation groups/items, hierarchies,
  relationships, perspectives, cultures, roles, RLS/OLS definitions,
  storage modes, refresh policies, and annotations;
- pages, visuals, filters, slicers, drillthrough, tooltips, bookmarks,
  interactions, conditional formatting, accessibility metadata, and themes;
- direct, transitive, structural, report, and external consumers.

### 3. Audit correctness before performance

For every exposed KPI and business-rule-bearing SQL, M, calculated column, or
measure, establish the intended grain, date basis, filter behavior, inclusion
rules, blank/null behavior, currency/unit conversion, and reconciliation
target. Test totals, grouped values, edge periods, blanks, duplicates,
orphans, unmatched joins, inactive relationships, and subtotal behavior.

Rank proven wrong results and broken contracts above all optimization work.
Keep suspected logic risks separate from demonstrated defects.

### 4. Audit every engineering layer

Execute the complete checklist. At minimum, assess:

1. source data contracts and SQL correctness, plans, indexes, statistics,
   cardinality, materialization, incremental extraction, and readability;
2. Power Query architecture, folding, privacy boundaries, data types,
   parameters, repeated evaluation, staging, error handling, and refresh cost;
3. dimensional design, grain, relationships, keys, storage mode,
   aggregations, partitions, incremental refresh, and VertiPaq efficiency;
4. DAX semantics, dependencies, context transition, filter behavior,
   iterators, virtual tables, time intelligence, calculation groups,
   formatting, descriptions, and measured query performance;
5. PBIR usage, broken bindings, page/visual query fan-out, filters,
   interactions, navigation, accessibility, consistency, and render behavior;
6. RLS/OLS definition quality, relationship propagation, default/empty user
   behavior, role overlap, and representative identity tests when authorized;
7. naming, folders, descriptions, source control, deployment parameters,
   validation assets, ownership boundaries, and maintainability.

For each calculation-placement opportunity, evaluate SQL, Power Query, and DAX
individually. Select the layer that preserves semantics and gives the clearest
governed implementation; do not apply a mechanical SQL-first rule.

### 5. Add empirical evidence

When a Power BI Modeling connection is available, inspect the live model and
run targeted DAX result checks, model statistics, dependency checks, and
representative server-timing traces. When source access is available, obtain
actual execution plans, reads, CPU, duration, row counts, and parameter
behavior. Use Performance Analyzer or equivalent evidence for report pages.

Time every refresh and performance test per
[live-connection.md](references/live-connection.md): check existing recorded
signal first, scope to the smallest partition, state the time budget before
starting (3–5 minutes for a spot check, 10 minutes maximum for a before/after
validation), wrap the window with `trace_operations` so a timeout still yields
rows-processed evidence, and record the measured duration for reuse. Do not
start a large full refresh without explicit approval; report a test that
exceeds its budget as inconclusive. Record cold/warm cache and representative
filter context.

### 6. Produce detailed findings and roadmap

Give every finding a stable ID and include:

- title, layer, category, severity, priority, confidence, and evidence class;
- affected objects and all known consumers;
- current behavior, expected behavior, and business/technical impact;
- exact file/object references and measured evidence;
- root cause, not just the observed symptom;
- recommended target architecture and rejected alternatives;
- exact SQL, M, DAX, TMDL, or PBIR example where useful;
- effort, risk, prerequisites, validation, and rollback;
- official guidance references that directly support the recommendation.

Deduplicate common root causes, but never omit affected objects or downstream
consumers. Separate correctness, performance, maintainability, security, and
cleanup findings.

### 7. Complete and stop

Create every artifact required by the deliverable contract, including the
coverage matrix and full findings register. Summarize the most important
results in chat and link to the detailed files.

Do not apply the roadmap. When the user approves specific finding IDs, hand off
to the `powerbi-remediate` skill for cross-layer work, or to the relevant SQL,
Power Query, or DAX optimization skill for a focused change. Invoke a sibling
skill the way the host expects — `$powerbi-remediate` in Codex,
`/powerbi-engineering:powerbi-remediate` in Claude Code. `powerbi-remediate`
is explicit-only in both hosts, so ask the user to invoke it rather than
assuming it can be triggered automatically.

## Non-negotiable audit rules

- Treat heuristics as investigation prompts, not proof of defects or slowness.
- Never classify an object as safe to delete until all in-scope and available
  external consumers are checked.
- Never claim folding, cardinality, refresh duration, DAX cost, or render cost
  without the corresponding empirical evidence.
- Preserve source grain, join behavior, filter semantics, blanks, totals,
  security behavior, and report contracts in every recommendation.
- Record inaccessible evidence as a limitation instead of silently skipping it.
