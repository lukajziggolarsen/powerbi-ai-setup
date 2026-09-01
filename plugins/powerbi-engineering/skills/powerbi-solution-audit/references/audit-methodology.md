# Comprehensive Power BI Audit Methodology

## Contents

- Audit principles
- Evidence hierarchy
- Coverage levels
- Correctness method
- Dependency and cleanup method
- Performance method
- Security method
- Severity, priority, and confidence
- Health scoring
- Live-test discipline

## Audit principles

1. Establish business correctness before performance or style.
2. Trace end to end: source contract → SQL → M → model → DAX → PBIR → user.
3. Separate observed facts, measured results, documented contracts, and
   hypotheses.
4. Assess every checklist area; record unavailable evidence explicitly.
5. Recommend the best governed owner for each rule, not a fixed layer order.
6. Preserve functionality, security, refresh, and deployment behavior.
7. Optimize root causes and avoid cosmetic rewrites.
8. Make every material recommendation reproducible and testable.

## Evidence hierarchy

Use the strongest available evidence:

1. approved business/metric/security contract and expected result;
2. reconciled source-to-report test with representative data;
3. empirical runtime evidence: plans, traces, diagnostics, timings, statistics;
4. live object metadata and dependency results;
5. checked-in PBIP/PBIR/TMDL/M/SQL source;
6. static pattern or design heuristic;
7. inference from names, titles, or descriptions.

Never promote lower-level evidence to a stronger claim. A suspicious pattern
is not a defect until its context and effect are established.

Classify evidence:

- `proven`: reproduced through reconciliation, invariant, boundary test, or
  deterministic contract violation;
- `measured`: supported by a representative trace, plan, timing, or statistic;
- `strong-static`: directly established by parsed source or metadata;
- `suspected`: plausible risk requiring a targeted test;
- `unverified`: required evidence is unavailable.

## Coverage levels

| Coverage | Conclusions supported |
|---|---|
| Static source | definitions, bindings, declared modes, dependencies, static patterns, maintainability |
| Connected Desktop/model | current metadata, row counts, DAX results, model stats, bounded query/refresh tests |
| Fabric/service | deployed definition, refresh history, dependent workspace items, service behavior |
| Source-connected | reconciliation, folding/native queries, execution plans, reads/CPU/duration, data quality |
| Rendered report | visual output, accessibility, interactions, navigation, page/query/render timings |
| Identity-tested | RLS/OLS results for representative principals |

State coverage per audit area, not only once for the whole report.

## Correctness method

Create a metric contract for every critical exposed metric:

- business definition and owner;
- fact grain and aggregation grain;
- date role, fiscal/calendar basis, and time zone;
- required and excluded rows;
- currency, units, conversions, and rounding;
- relationship and filter behavior;
- blank, zero, null, unknown, and error behavior;
- totals/subtotals behavior;
- expected source/control total;
- representative edge cases.

Trace each metric through source SQL, M, model relationships, base measures,
calculation groups, exposed measures, visual filters, and report interactions.

Test:

- overall and grouped totals;
- duplicate keys and join fan-out;
- unmatched facts/dimensions and unknown members;
- blank/null/zero distinctions;
- type and locale conversion;
- inclusive/exclusive date boundaries and daylight-saving/time-zone behavior;
- fiscal boundaries and incomplete periods;
- inactive and role-playing relationships;
- single/multi/no selections;
- subtotals and grand totals;
- negative values, returns, cancellations, and late-arriving data;
- representative security identities where in scope.

Wrong user-visible numbers are critical by default. Downgrade only with a
documented reason such as an unused experimental object with no consumers.

## Dependency and cleanup method

Trace:

- report visual/query/filter/slicer/format/tooltip/drillthrough consumers;
- bookmarks, field parameters, conditional formatting, and interactions;
- measure and calculated-object dependencies;
- relationships, hierarchies, sort-by, calculation groups, perspectives,
  cultures, roles/RLS/OLS, partitions, refresh policies, and annotations;
- thin reports, Excel, XMLA clients, APIs, notebooks, deployment pipelines,
  and other workspace items when access is available.

Classify cleanup candidates:

- `used-direct`;
- `used-transitive`;
- `used-structural`;
- `used-security`;
- `used-external`;
- `unobserved-in-scope`;
- `deprecated-candidate`;
- `safe-to-remove-in-confirmed-scope`;
- `requires-manual-review`.

Absence from one PBIR is never enough for safe deletion. Prefer deprecation,
hiding, or documentation when external scope is incomplete.

## Performance method

Keep performance layers separate:

1. source/database execution;
2. gateway/network and connector behavior;
3. Power Query evaluation/folding;
4. model processing/refresh and VertiPaq storage;
5. DAX Formula Engine and Storage Engine execution;
6. visual query fan-out and rendering;
7. capacity concurrency and throttling.

Define a representative workload before measuring. Record:

- environment, data state, filters, parameters, identity, and concurrency;
- cold/warm cache;
- elapsed time, CPU, reads, rows, memory/spills, and plan where available;
- Power Query diagnostics and folding boundary;
- processing/refresh scope and duration;
- DAX Server Timings/query plan;
- visual/page timing and query count.

Do not compare different filters, data states, cache states, or result grains
as if they were the same test.

## Security method

Inventory roles, table filters, OLS metadata, relationship propagation,
dynamic identity functions, default/blank identity behavior, role overlap, and
objects that can bypass intended filters.

Static review can identify risky expressions and paths but cannot prove user
access. When authorized, test representative allowed, denied, multi-role,
unknown, and blank identities. Do not alter role membership or workspace
permissions during an audit.

Treat potential data exposure as critical until disproven. Clearly separate
model-definition findings from service membership/permission findings.

## Severity, priority, and confidence

Severity describes impact:

- `critical`: wrong business result, broken production contract, material data
  exposure, refresh failure, or unusable critical report;
- `high`: major performance, reliability, security, or maintainability issue
  with broad/high-value impact;
- `medium`: material but contained issue or risk;
- `low`: localized improvement, debt, or cleanup;
- `informational`: observation or future consideration.

Priority describes implementation order and includes impact, likelihood,
dependency order, effort, and urgency. Use P0–P3.

Confidence is independent of severity:

- `confirmed`;
- `high`;
- `medium`;
- `low`;
- `blocked`.

Never lower severity merely because confidence is low. Instead identify the
test needed to resolve confidence.

## Health scoring

Score only assessed areas. Use 0–100 per dimension:

- correctness and data quality: 25%;
- security and governance: 15%;
- source/SQL and ingestion: 10%;
- Power Query and refresh: 10%;
- semantic model and storage: 15%;
- DAX: 10%;
- report experience and performance: 10%;
- maintainability and deployment: 5%.

Show the formula, assessed coverage, and score deductions. Do not present a
single score without the dimension breakdown. A critical correctness or
security finding caps the overall score at 59 until resolved.

## Live-test discipline

Connection setup and the full refresh-timing rules are in
[live-connection.md](live-connection.md); the discipline in brief:

- Prefer existing telemetry, recorded row counts, and documented prior
  durations before generating load. Never re-measure what a project doc
  already records.
- Define target, scope, expected duration, stop condition, and rollback.
- Use a bounded representative query or single partition before a full
  refresh. State the time budget out loud before starting: 3–5 minutes for a
  spot check, up to 10 minutes when the refresh test is itself the point.
- Local Desktop refresh is blocking — the budget bounds the tool call itself.
  `RefreshWithAPI` (poll + cancel on budget) applies only to published
  Fabric/Service datasets, never a local Desktop session.
- Wrap the refresh window with `trace_operations` Start/Fetch/Stop so a slow
  or timed-out test still yields duration and rows-processed evidence.
- Obtain explicit approval for a potentially costly source query, full model
  refresh, refresh of a table already suspected slow/large, production trace,
  or security identity test.
- Cancel or stop when the stated budget expires and report the test as
  inconclusive. Record measured durations for reuse by later audits.
- Never use production DDL/DML to prove an audit finding.

This document is the single canonical home of the audit methodology for both
Claude Code and Codex — there is no separate per-repo or per-host copy to keep
in sync. A project may still record its own measured durations, row counts, and
metric contracts in its own docs; prefer those as evidence (see rule 1 of
live-test discipline), but do not treat them as competing policy.
