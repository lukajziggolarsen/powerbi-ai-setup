# Cross-Layer Implementation Playbook

## Contents

- Select the target layer
- Implement SQL
- Implement Power Query
- Implement DAX
- Validate and hand off

## Select the target layer

Evaluate every plausible owner:

1. Choose SQL for stable reusable source logic when the result can be
   deployed, reviewed, tested, governed, and versioned cleanly.
2. Choose Power Query when transformation is model-specific, connector-aware,
   portable, or has no safe SQL deployment path.
3. Choose DAX when evaluation must change with semantic filter context.
4. Choose PBIR when the behavior is strictly presentation or interaction.

Select the clearest authoritative owner. Reject any move that creates opaque
logic, duplicates a governed rule, couples unrelated consumers, changes
semantics, or makes testing/deployment materially harder.

## Implement SQL

Prefer a version-controlled database object or SQL file over embedded native
SQL in M. Preserve a stable output contract and split complex work into named,
testable stages.

Use:

- Explicit schemas, columns, types, aliases, and parameters.
- Set-based operations, sargable predicates, deterministic joins, and window
  functions.
- CTEs for readable single-use logic.
- Temp tables for measured reuse, statistics, indexing, or phase isolation.
- Indexes selected from actual plans and filter/join patterns.
- Early filters and projections without changing business grain.
- Stage assertions for uniqueness, row counts, nulls, unmatched rows,
  duplicate amplification, and control totals.
- Representative parameter tests plus elapsed time, CPU, logical reads, query
  plan, returned row count, and refresh timing.

For a temp-table pipeline:

1. State each stage's input grain and output grain.
2. Name stages by business purpose, not sequence number.
3. Create only indexes justified by downstream access.
4. Keep diagnostics runnable separately or behind an optional debug path.
5. Isolate business rules from physical tuning where practical.
6. Test each stage before comparing end-to-end refresh.

Never preserve a speedup that fails reconciliation or cannot be maintained
safely.

## Implement Power Query

Keep M thin and foldable:

- Use staging queries with load disabled.
- Filter rows and select columns early.
- Use explicit types and intention-revealing step names.
- Reference shared staging logic instead of copying it.
- Keep joins foldable and validate join cardinality.
- Parameterize native queries; enable downstream folding only when supported
  and verified.
- Use Query Diagnostics and source plans together.

Avoid unmeasured `Table.Buffer`, repeated expensive branches, late filters,
wide intermediates, and row-wise custom functions over large tables.

## Implement DAX

Keep dynamic semantic logic in measures:

- Compose small base measures.
- Use variables and explicit formatting.
- Prefer native aggregators and narrow column filters where equivalent.
- Minimize iteration grain and repeated context transition.
- Localize relationship changes and virtual relationships.
- Preserve blank behavior, totals, inactive-date semantics, and arbitrary
  slicer behavior.
- Compare Server Timings and query plans with representative report queries.

Move a calculated column to SQL only when its value is stable at refresh,
source grain is available, model storage or processing benefits, and the SQL
maintainability gate passes.

## Validate and hand off

Validate one finding at a time:

1. Reconcile results at total, grouped, boundary, blank, and duplicate cases.
2. Compare source, M, processing, DAX, and refresh evidence at matching scope.
3. Record model-size impact where relevant.
4. Review readability, test coverage, deployment path, and rollback.
5. Restore the before-state if any required check fails.
6. Regenerate the audit and report the selected layer plus rejected
   alternatives.
