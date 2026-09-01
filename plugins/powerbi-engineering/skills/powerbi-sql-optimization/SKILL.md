---
name: powerbi-sql-optimization
description: Deeply review, optimize, or refactor the relational source layer of a Power BI solution. Use for SQL correctness or performance, source grain, execution plans, indexes and statistics, native SQL in Power Query, source pushdown, warehouse or view design, incremental extraction, DirectQuery behavior, or approved audit remediation. Do not invoke for ordinary data lookup or routine SQL editing. Supports read-only Review Mode, exact Suggest Mode, and Apply Mode when explicitly authorized.
---

# Power BI SQL Optimization

Engineer the relational layer for correctness, predictable performance, and
long-term maintainability. Do not optimize SQL in isolation from the model
grain and refresh/report contract.

Read [sql-engineering-standard.md](references/sql-engineering-standard.md) and
[sql-validation.md](references/sql-validation.md) before making
recommendations or changes. When evidence has to come from the model side —
refresh duration, DirectQuery behavior, native-query inspection against a live
Desktop instance — read
`../powerbi-solution-audit/references/live-connection.md` first: use the
Windows-side modeling server only (`mcp__powerbi-modeling__*` in Claude Code,
`powerbi-modeling.*` in Codex), never a Linux/WSL one, and keep every refresh
test inside a stated time budget.

## Determine mode

- Use **Review Mode** for diagnosis, audit, or explanation. Make no changes.
- Use **Suggest Mode** for exact proposed SQL and deployment steps. Make no
  changes.
- Use **Apply Mode** only when the user explicitly requests implementation and
  the target files or database objects are clear.

Database DDL/DML changes require explicit authorization for the exact
environment and objects. A request to edit project SQL files does not imply
permission to deploy them to a database.

## Workflow

1. Identify the SQL dialect, engine/version, data volumes, refresh mode,
   parameter patterns, concurrency, deployment path, and available plan/runtime
   evidence.
2. Establish the output contract: grain, key, uniqueness, row-preservation,
   null/default behavior, time zone, units, and expected reconciliations.
3. Trace the SQL through Power Query, partitions, relationships, measures, and
   report consumers. Preserve the semantic contract.
4. Capture a representative baseline: returned rows, logical reads, CPU,
   elapsed time, memory/tempdb or spill indicators, execution plan, refresh
   duration, and DirectQuery concurrency where applicable.
5. Review correctness before tuning: join cardinality, fan-out, row loss,
   duplicate handling, filters, boundary dates, conversions, determinism, and
   parameter behavior.
6. Review access paths and shape: sargability, projections, predicate
   placement, join order selected by the optimizer, indexes, statistics,
   estimates, scans/seeks, sorts, spills, parallelism, and repeated work.
7. Refactor into intention-revealing stages. Separate business rules from
   physical tuning and expose a stable published contract.
8. Compare candidate implementations using identical parameters and cache
   assumptions. Reject improvements that fail reconciliation.
9. In Apply Mode, change one logical unit at a time, run the validation
   contract, and retain a rollback script or file diff.
10. Report before/after correctness, performance, maintainability, deployment,
    and rollback status.

## Layer-placement rules

Prefer SQL for stable reusable source logic when it can be versioned, tested,
deployed, and governed. Keep model-specific shaping in Power Query when a
source change would create harmful coupling or has no safe deployment path.
Keep calculations in DAX when their result must respond to semantic filter
context.

Do not replace readable foldable M or correct dynamic DAX with opaque embedded
native SQL merely to push work down.
