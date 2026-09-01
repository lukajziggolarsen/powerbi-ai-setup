# SQL Engineering Standard for Power BI

## Contents

- Correctness contract
- Architecture and ownership
- Query design
- Plans, indexes, and statistics
- Power BI workload patterns
- Maintainability
- Anti-pattern decision guide
- Official references

## Correctness contract

Before tuning, declare:

- output grain and candidate/primary key;
- source-of-truth tables and effective-date rules;
- join cardinality and required unmatched-row behavior;
- duplicate, null, unknown-member, and late-arriving-row behavior;
- date/time zone, fiscal calendar, units, currency, and rounding;
- incremental watermark, delete, and reprocessing behavior;
- expected control totals and representative parameters.

Add assertions or diagnostic queries for uniqueness, row counts, unmatched
keys, duplicate amplification, null rates, date boundaries, and control totals.

## Architecture and ownership

Prefer stable version-controlled views, functions, procedures, or warehouse
transformations over long SQL text embedded in M. Keep one authoritative owner
for reusable business rules.

Structure complex logic into named stages:

1. extract the required source columns/rows;
2. standardize types and keys;
3. conform dimensions and business identities;
4. enrich with optional/required joins whose semantics are explicit;
5. aggregate at a documented grain;
6. publish a stable contract.

Use CTEs for readable single-use stages. Use temp/materialized stages when
measured reuse, statistics, indexing, isolation, or troubleshooting justify
them. Do not force either form as a universal rule.

## Query design

- Use explicit schema names and column lists.
- Match parameter and join data types to avoid implicit conversions.
- Keep predicates sargable when a useful access path exists.
- Push selective predicates and projections early without changing outer-join
  semantics.
- Use deterministic joins and documented tie-breaking for `ROW_NUMBER`,
  `TOP`, deduplication, and latest-record logic.
- Validate every many-to-many or non-unique join for fan-out.
- Keep optional enrichment row-preserving with outer joins or equivalent logic.
- Prefer set-based logic; investigate row-by-row scalar work when material.
- Pre-aggregate only when the grain still supports required report filters.
- Parameterize values; never build unsafe concatenated SQL.
- Review sort, hash, spool, exchange, spill, and repeated-scan behavior with
  actual plans.

## Plans, indexes, and statistics

Capture actual execution plans when permitted. Compare:

- estimated vs actual rows at important operators;
- join algorithm and order chosen;
- scans/seeks and residual predicates;
- implicit conversions and non-sargable expressions;
- key/RID lookups and repeated access;
- sorts, hashes, memory grants, and spills;
- parallelism, skew, and exchange cost;
- scalar UDFs, callbacks, and serial zones;
- tempdb/materialization behavior;
- compile/recompile and parameter sensitivity.

Design indexes from the workload and write cost:

- align leading keys with selective equality/range and join patterns;
- add included columns only when they materially reduce lookups;
- avoid redundant/overlapping indexes;
- confirm the optimizer uses the candidate under representative parameters;
- include insert/update/storage/maintenance cost;
- use columnstore/partitioning only when the engine and workload justify it.

Check statistics freshness, sampling, correlation, ascending keys, filtered
statistics, and parameter-sensitive plans before forcing hints. Use hints as a
last resort with a documented exit plan.

## Power BI workload patterns

### Import

Optimize end-to-end refresh, not only isolated query duration. Reduce
unnecessary rows/columns, preserve incremental filters, and test gateway and
concurrency behavior. A slightly slower source query can still improve overall
refresh if it sharply reduces mashup/model work.

### DirectQuery

Assume visuals generate repeated grouped/filter queries under concurrency.
Provide unique dimension keys, valid fact foreign keys, source-side
materialized transformations, useful indexes, and predictable parameter
behavior. Avoid source constructs that prevent the connector from composing
valid queries.

### Incremental refresh

Ensure RangeStart/RangeEnd predicates reach a partition-prunable source
column. Validate inclusive/exclusive boundaries, late-arriving updates,
historical corrections, change detection, and deletion strategy.

### Native queries in M

Check connector support, parameterization, least-privilege credentials,
subquery composability, subsequent folding, DirectQuery restrictions, and
incremental-refresh compatibility. Do not assume `Value.NativeQuery` preserves
folding without verification.

## Maintainability

- Use intention-revealing object, CTE, temp-table, alias, and column names.
- Keep comments focused on grain, invariants, non-obvious decisions, and
  optimizer workarounds.
- Separate business semantics from physical performance tuning where practical.
- Include a test harness with representative and boundary parameters.
- Provide deployment order, permissions, dependencies, and rollback.
- Record baseline plans/timings and why each index/materialization exists.
- Avoid unexplained magic constants and environment-specific literals.

## Anti-pattern decision guide

Do not flag a token alone. Investigate context:

| Pattern | Questions |
|---|---|
| `SELECT *` | Does it expand refresh width, destabilize schema, or prevent covering access? |
| CTE | Is it readable single-use logic, or repeatedly expanded expensive work? |
| Temp table | Does materialization provide reuse, estimates, indexing, or isolation? |
| `CROSS APPLY` | Is it row-preserving where required, and does it execute per row? |
| Scalar function | Is it inlined by the engine; what do actual plans show? |
| `DISTINCT` | Is it masking an incorrect join or intentionally enforcing grain? |
| Hint | What measured optimizer problem requires it, and how is it retired? |
| Pre-aggregation | Which report filters/details are lost or preserved? |

## Official references

- [Power BI DirectQuery model guidance](https://learn.microsoft.com/en-us/power-bi/guidance/directquery-model-guidance)
- [Power BI query folding guidance](https://learn.microsoft.com/en-us/power-bi/guidance/power-query-folding)
- [Execution plans](https://learn.microsoft.com/en-us/sql/relational-databases/performance/execution-plans)
- [SQL Server index design](https://learn.microsoft.com/en-us/sql/relational-databases/sql-server-index-design-guide)
- [Query processing architecture](https://learn.microsoft.com/en-us/sql/relational-databases/query-processing-architecture-guide)

For non-SQL Server sources, use the official optimizer, indexing/clustering,
partitioning, statistics, and plan documentation for that engine.
