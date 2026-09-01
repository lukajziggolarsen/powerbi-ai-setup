# DAX Validation Contract

## Before-state

Record:

- measure/calculated-object definition and dependencies;
- metric contract and known report consumers;
- representative DAX query suite and results;
- Server Timings/query plan under declared filters and cache state;
- model stats/refresh impact for stored calculations;
- role context where security affects results;
- rollback definition.

## Result tests

Compare old and new:

1. overall total;
2. grouped dimension slices;
3. grand totals and subtotals;
4. single, multiple, and no selection;
5. blank, zero, missing dimension, and empty period;
6. inactive/alternate date role;
7. first/last fiscal or calendar boundary;
8. negative, return, cancellation, and duplicate cases;
9. authorized representative security roles;
10. report visual output and formatting.

Use tolerant numeric comparison only when the contract permits rounding or
floating-point differences.

## Performance tests

Run equivalent DAX with the same model state, filters, and cold/warm policy.
Capture:

- total duration;
- Formula Engine and Storage Engine duration;
- Storage Engine query count;
- materialization/callback indicators;
- DirectQuery native queries where applicable;
- page/visual timing for consuming visuals.

Require repeated runs when variance is significant. A shorter expression is
not evidence of a faster measure.

## Apply and rollback

- Change one dependency group at a time.
- Create/update base measures before dependents.
- Validate every downstream measure and known report consumer.
- Preserve display folders, descriptions, format strings, lineage, and
  calculation-group behavior.
- Restore the before definitions immediately on a contract failure.
- Re-run static validation and the focused audit after success.
