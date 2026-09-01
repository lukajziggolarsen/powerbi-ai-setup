# Power Query Validation Contract

## Before-state

Record:

- query definition, parameters, privacy/source boundaries, and dependencies;
- load state, output schema, row count, keys, and control totals;
- folding evidence at material steps;
- Query Diagnostics/source evidence;
- refresh scope, duration, and data timestamp;
- downstream model/report tests and rollback diff.

## Correctness

Test before and after with identical parameters:

1. schema, types, and column order where contract-sensitive;
2. row counts and key uniqueness;
3. grouped control totals;
4. duplicate and unmatched join cases;
5. null, blank, error, missing-field, and locale cases;
6. date/time zone and incremental boundaries;
7. file/source schema drift samples;
8. downstream measure/report reconciliations.

## Folding and refresh

- Capture the generated/native query or query plan where supported.
- Confirm RangeStart/RangeEnd filters reach the source.
- Compare transferred rows and local evaluation, not only refresh duration.
- Use representative partitions before full refresh.
- State connector/version and whether diagnostics are Desktop, online, gateway,
  or source-side.

## Apply and rollback

- Change one dependency chain at a time.
- Validate helper/staging queries before loaded dependents.
- Refresh only the smallest sufficient scope with a stated timeout.
- Restore the prior M definitions and parameters on failure.
- Recheck all dependent partitions, measures, and report bindings.
