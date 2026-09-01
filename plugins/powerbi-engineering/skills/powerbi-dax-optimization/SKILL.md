---
name: powerbi-dax-optimization
description: Deeply review, test, optimize, or refactor difficult DAX and its supporting model design. Use for wrong totals, slow visuals or measures, complex filter context, iterators, virtual tables, calculation groups, time-intelligence bugs, duplicate measures, relationship issues, Server Timings, query plans, VertiPaq-aware design, or approved audit remediation. Route routine measure, column, relationship, and TMDL CRUD to semantic-model-authoring. Supports read-only Review Mode, exact Suggest Mode, and Apply Mode when explicitly requested.
---

# Power BI DAX Optimization

Engineer semantic calculations for correct filter behavior first, measured
performance second, and readable maintenance throughout.

Read [dax-model-standard.md](references/dax-model-standard.md) and
[dax-validation.md](references/dax-validation.md) before making
recommendations or changes. Before connecting to a live model, running DAX
result checks, capturing Server Timings, or timing a refresh, read
`../powerbi-solution-audit/references/live-connection.md` — use the
Windows-side modeling server only (`mcp__powerbi-modeling__*` in Claude Code,
`powerbi-modeling.*` in Codex), never a Linux/WSL one, run its preflight
first, and give every refresh test a stated time budget.

## Determine mode

- Use **Review Mode** for diagnosis, audit, or explanation.
- Use **Suggest Mode** for exact proposed DAX/TMDL and test queries.
- Use **Apply Mode** only when the user explicitly requests implementation.

## Workflow

1. Establish the metric contract: business meaning, grain, date basis,
   filters/exclusions, blank behavior, totals, units, and reconciliation.
2. Map dependencies from report visuals through exposed measures to base
   measures, columns, relationships, calculation groups, and source tables.
3. Validate correctness with representative DAX queries: totals, grouped
   slices, blanks, missing dimension members, inactive dates, fiscal
   boundaries, multiple selections, subtotals, and role context where
   authorized.
4. Inspect dimensional design and filter propagation before rewriting the
   measure. A DAX symptom can originate in grain, keys, relationships, or data
   quality.
5. Capture representative Server Timings and query plans. Separate Formula
   Engine work, Storage Engine work, callback behavior, scans, materialization,
   and report query fan-out.
6. Refactor toward small governed base measures, clear variables, deliberate
   context transitions, narrow filter inputs, appropriate iterator grain, and
   reusable calculation groups where justified.
7. Preserve blanks, totals, filter semantics, relationship choice, formatting,
   and arbitrary slicer behavior. Compare output tables before and after.
8. Evaluate calculated columns and tables against SQL and Power Query
   alternatives, including model-size and processing impact. Retain them when
   semantic or deployment constraints justify them.
9. Apply naming, display folders, descriptions, format strings or dynamic
   formats, and test queries so the measure layer is navigable and maintainable.
10. In Apply Mode, change one dependency group at a time, validate downstream
    measures and report consumers, and roll back on any contract failure.

## Performance rules

Treat `SUMX`, `FILTER`, `CALCULATE`, virtual relationships, and other patterns
as context-dependent tools, not automatic defects. Rewrite only after
correctness analysis and measured evidence identify a material problem.
