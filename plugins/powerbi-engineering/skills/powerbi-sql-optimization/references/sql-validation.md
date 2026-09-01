# SQL Validation Contract

## Before-state

Record:

- exact definition and dependencies;
- representative parameters and data timestamp;
- result schema, row count, key uniqueness, nulls, and control totals;
- actual plan and runtime evidence when available;
- Power Query folding/native query behavior;
- end-to-end refresh or DirectQuery workload impact;
- deployment and rollback path.

## Correctness tests

Compare old and new results at identical scope:

1. schema and data types;
2. row count and key uniqueness;
3. symmetric row differences or keyed hashes where feasible;
4. grouped control totals;
5. duplicate, orphan, null, and unmatched cases;
6. date/time and incremental boundaries;
7. minimum/maximum and negative/extreme values;
8. representative downstream DAX/report results.

Explain intentional differences and obtain approval before accepting them.

## Performance tests

Use equivalent data, parameters, cache state, isolation, and concurrency.
Capture multiple runs when variance matters:

- elapsed time and CPU;
- logical/physical reads;
- returned rows;
- memory grant and spills;
- tempdb/materialization;
- compile time and plan;
- gateway/refresh duration or DirectQuery concurrency.

Do not call a rewrite faster based on estimated plan cost alone.

## Apply and rollback

- Apply one database object or coherent source change at a time.
- Use a transaction where supported and safe, but do not hold a long
  production transaction merely for testing.
- Validate grants, dependencies, and deployment ordering.
- Restore the prior definition/index set immediately when a required test
  fails.
- Retain the before definition, migration, rollback, and evidence artifacts.
