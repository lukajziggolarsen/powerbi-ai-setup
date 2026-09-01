# Power Query Engineering Standard

## Contents

- Query contract
- Architecture
- Correctness
- Folding and evaluation
- Performance patterns
- Incremental refresh
- Maintainability
- Official references

## Query contract

For every loaded query, declare:

- source and credential/privacy boundary;
- input and output grain;
- key/uniqueness expectations;
- required schema and types;
- null, error, missing-field, locale, and time-zone behavior;
- load destination, storage mode, and downstream consumers;
- refresh frequency, parameters, and incremental policy.

## Architecture

Use an intentional organization:

- parameters and configuration;
- reusable functions;
- source/staging queries, usually load disabled;
- conformed dimension queries;
- fact queries;
- aggregate/helper queries;
- final loaded tables.

Reference shared staging logic when reuse is intended. Verify whether
references cause repeated source evaluation in the actual connector and
refresh topology; they are not a guaranteed materialized cache.

Keep environment-specific values in parameters. Use dataflows/warehouse/source
objects when transformations must be shared across many models and can be
governed there.

## Correctness

Check:

- join kind, key uniqueness, duplicate amplification, and unmatched rows;
- type conversions before joins/filters and locale-dependent parsing;
- null vs empty vs zero behavior;
- error replacement/removal and whether it silently drops business rows;
- expansion of nested tables and schema drift;
- date/time/datetimezone conversions and daylight-saving boundaries;
- grouping grain and aggregation semantics;
- sorting assumptions before index/rank/fill operations;
- file/folder ingestion, hidden/temp files, and column-union behavior;
- deterministic custom functions and retry/error behavior.

## Folding and evaluation

Determine folding per material step using connector-supported evidence:

- folding indicators or View Native Query;
- Power Query query plan;
- Query Diagnostics;
- source-side traces/plans;
- generated native query inspection.

The last folding step is not assumed from M syntax. Connectors can fold,
partially fold, reorder, or evaluate operators differently.

For relational sources:

- apply selective foldable filters and projection early;
- preserve type-compatible, foldable join keys;
- prefer foldable grouping/sorting when it reduces transferred data;
- place non-folding work after maximal safe reduction;
- use `Value.NativeQuery` only with safe parameterization and verified
  downstream folding support;
- respect DirectQuery and incremental-refresh restrictions.

## Performance patterns

Investigate:

- repeated evaluation of expensive branches;
- multiple independent source connections;
- privacy firewall partitions and local data movement;
- per-row custom function/database calls;
- wide expansion before filtering;
- unnecessary sorting, grouping, buffering, and type churn;
- schema inference over many files;
- binary/file reads repeated across transformations;
- non-folding joins over large tables;
- background preview/parallel loading effects during diagnosis.

`Table.Buffer` can stabilize enumeration or prevent repeated evaluation, but it
can also consume memory and stop folding. Require measured evidence and place
it deliberately.

Use `Table.StopFolding` when the intent is to prevent downstream folding
without forcing full materialization, subject to connector/version behavior.

## Incremental refresh

- Define case-sensitive `RangeStart` and `RangeEnd` parameters with correct
  datetime types.
- Apply a single non-overlapping boundary convention, typically
  `>= RangeStart` and `< RangeEnd`.
- Verify the partition filter folds to the source.
- Keep unsupported native-query patterns from defeating partition pruning.
- Validate change-detection semantics and note that hard deletes may require a
  separate strategy.
- Test late-arriving changes, historical corrections, time zones, and
  complete-day options.

## Maintainability

- Name queries and steps by business intent.
- Keep steps focused; combine only when it improves clarity and does not hide
  important diagnostics.
- Add explicit types near the source contract and after schema-changing
  operations as needed.
- Use small pure functions with declared arguments and return shapes.
- Avoid copied M with diverging business rules.
- Comment non-obvious folding, privacy, connector, and error decisions.
- Preserve a readable `let` flow and avoid environment literals or credentials.
- Document load state, owner, downstream table, last verified folding step,
  and expected refresh volume.

## Official references

- [Power Query best practices](https://learn.microsoft.com/en-us/power-query/best-practices)
- [Query folding guidance](https://learn.microsoft.com/en-us/power-bi/guidance/power-query-folding)
- [Query folding basics](https://learn.microsoft.com/en-us/power-query/query-folding-basics)
- [Query plan](https://learn.microsoft.com/en-us/power-query/query-plan)
- [Native query folding](https://learn.microsoft.com/en-us/power-query/native-query-folding)
- [Incremental refresh](https://learn.microsoft.com/en-us/power-bi/connect-data/incremental-refresh-configure)
