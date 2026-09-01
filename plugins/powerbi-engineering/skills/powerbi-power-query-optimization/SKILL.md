---
name: powerbi-power-query-optimization
description: Deeply review, optimize, or refactor difficult Power Query M. Use for slow refresh, broken or partial folding, staging architecture, privacy boundaries, native queries, complex transformations, repeated evaluation, Table.Buffer questions, incremental-refresh filters, refresh diagnostics, or approved audit remediation. Route routine partition and expression CRUD to semantic-model-authoring. Supports read-only Review Mode, exact Suggest Mode, and Apply Mode when explicitly requested.
---

# Power BI Power Query Optimization

Engineer M as a readable, testable transformation layer. Preserve source and
semantic contracts while minimizing local mashup work.

Read
[power-query-engineering-standard.md](references/power-query-engineering-standard.md)
and [power-query-validation.md](references/power-query-validation.md) before
making recommendations or changes. Before any live folding check or refresh
test, read `../powerbi-solution-audit/references/live-connection.md` — use the
Windows-side modeling server only (`mcp__powerbi-modeling__*` in Claude Code,
`powerbi-modeling.*` in Codex), never a Linux/WSL one, run its preflight
first, and scope every refresh test to the smallest partition with a stated
time budget.

## Determine mode

- Use **Review Mode** for diagnosis, audit, or explanation.
- Use **Suggest Mode** for exact proposed M and migration steps.
- Use **Apply Mode** only when the user explicitly requests implementation.

## Workflow

1. Inventory every query, function, parameter, group, load setting, partition,
   source, credential/privacy boundary, and downstream table.
2. Establish each query's input/output grain, schema contract, refresh role,
   and consumers.
3. Trace query references and repeated branches. Separate source/staging,
   transformation, dimension/fact, helper, parameter, and function queries.
4. Check correctness first: joins, duplicate amplification, missing rows,
   types, locale, errors, blanks/nulls, dates/time zones, and incremental range
   boundaries.
5. Determine folding empirically for important steps using indicators, query
   plans, native-query inspection, diagnostics, and source-side traces. Do not
   infer folding from function names alone.
6. Move selective foldable filters and projections early, preserve
   foldability through joins and grouping where possible, and minimize the
   rows/columns processed locally after the folding boundary.
7. Remove accidental repeated evaluation, duplicated logic, unnecessary
   materialization, unstable schema expansion, and unmeasured buffering.
8. Refactor with meaningful query/step names, explicit types, parameters,
   small reusable functions, documented contracts, and clear load settings.
9. Validate refresh results and cost on representative partitions. Preserve
   RangeStart/RangeEnd behavior and source parameterization.
10. In Apply Mode, change one query chain at a time, validate all downstream
    tables/measures, and retain a rollback diff.

## Placement rules

Recommend SQL only when the logic is stable, reusable, source-governable, and
has a safe deployment path. Keep model-specific, connector-specific, or
portable shaping in M when it remains understandable and performs acceptably.
Do not move filter-context calculations out of DAX.
