# Comprehensive Audit Checklist

Mark every line `assessed`, `not applicable`, or `blocked`, and link evidence
for material conclusions.

## 1. Business purpose and contracts

- Audience, decisions, owners, critical pages, and service-level expectations.
- Metric definitions, grain, date basis, filters, exclusions, units, blanks,
  rounding, and reconciliation sources.
- Data freshness, latency, availability, and historical retention.
- Known defects, technical constraints, and deployment environments.

## 2. Repository and PBIP structure

- Valid `.pbip`, `.Report`, `.SemanticModel`, PBIR, and TMDL structure.
- Source-control hygiene, generated/local files, and stable identities.
- Environment parameters, secrets handling, deployment assets, and rollback.
- Naming, descriptions, comments, documentation, tests, and ownership.
- Schema validation and opening/rendering in supported Power BI tooling.

## 3. Source data and SQL

- Source systems, ownership, supported dialects, and extraction boundaries.
- Declared grain, keys, uniqueness, nulls, orphans, duplicates, and control
  totals.
- Join semantics, fan-out, row loss, filters, conversions, time zones, and
  deterministic results.
- Explicit projections, data types, sargability, parameterization, and schema
  stability.
- Views/procedures/native queries, business-rule placement, reuse, and
  deployment/versioning.
- Actual plans, estimates vs actuals, indexes, statistics, scans/seeks, spills,
  sorts, parallelism, repeated work, and parameter sensitivity.
- Incremental extraction, watermark logic, late data, deletes, idempotency,
  partition pruning, and refresh concurrency.
- DirectQuery source integrity, materialized transformations, indexes,
  concurrency, and query shape.
- Readability, named stages, diagnostics, test harness, and rollback.

## 4. Power Query

- Query/function/parameter/group inventory and dependency graph.
- Staging/reference architecture and load-enabled status.
- Source credentials/privacy boundaries and combination behavior.
- Folding state for material steps, native query behavior, and connector
  limitations.
- Early row/column reduction, explicit types, stable schema expansion, and
  step order.
- Joins, grouping, sorting, custom functions, repeated branches, enumeration,
  buffering, and local materialization.
- Error handling, missing fields, nulls, locale, date/time zone, and type
  conversions.
- Parameters, environment portability, RangeStart/RangeEnd, and incremental
  refresh folding.
- Query Diagnostics, source traces, refresh duration, and peak resource use.
- Query/step naming, comments, reusable functions, and testability.

## 5. Semantic-model architecture

- Fact, dimension, bridge, helper, parameter, calculation-group, and aggregate
  table roles.
- Grain, keys, unknown members, slowly changing dimensions, and conformed
  dimensions.
- Star-schema quality and justified snowflakes/denormalization.
- Relationships: columns, uniqueness, cardinality, direction, active state,
  ambiguity, many-to-many, referential integrity, and role-playing dates.
- Storage mode: Import, DirectQuery, Dual, Direct Lake, composite, hybrid, and
  related limitations.
- Aggregations, partitions, incremental refresh, change detection, and
  refresh policies.
- Tables/columns: types, precision, encoding/cardinality, sort-by, visibility,
  data categories, default summarization, descriptions, and folders.
- Calculated tables/columns and alternative layer placement.
- Hierarchies, field parameters, perspectives, cultures/translations,
  calculation groups/items, dynamic formats, annotations, and AI metadata.
- Model dependencies, circularity, missing references, and external contracts.

## 6. DAX correctness and quality

- Complete measure/calculated-object inventory and dependency graph.
- Metric contract alignment and source reconciliation.
- Aggregation grain, double-counting, blanks/zeros, totals/subtotals, and
  conversion/rounding.
- Filter context, row context, context transition, relationship selection, and
  filter removal/retention.
- Time intelligence, marked date tables, fiscal calendars, incomplete periods,
  and role-playing dates.
- Iterators, virtual tables, broad filters, repeated expressions, callbacks,
  virtual relationships, branching, and calculation groups.
- Variables, measure references, naming, folders, descriptions, format
  strings, and duplicated/near-duplicated measures.
- Representative DAX queries, Server Timings, Formula/Storage Engine work, and
  query plans.

## 7. VertiPaq and processing

- Row counts, cardinality, dictionary/data/hierarchy size, encoding, and
  segment distribution.
- High-cardinality text/GUID/datetime/decimal columns and reducible precision.
- Unused loaded columns/rows, pre-aggregation opportunities, and model growth.
- Processing dependencies, partition balance, memory pressure, and refresh
  parallelism.
- Incremental refresh coverage, historical/current partition correctness, and
  policy behavior.
- Capacity/model-size constraints and eviction/reload behavior when evidence
  is available.

## 8. Security and governance

- Role and RLS filter inventory, dynamic identity logic, and relationship
  propagation.
- Allowed/denied/unknown/blank identity behavior and role overlap.
- OLS definitions and metadata exposure.
- Perspectives and external tools as non-security features.
- Service role membership, item permissions, Build/Reshare access, and
  workspace boundaries when authorized and in scope.
- Sensitivity labels, endorsements, ownership, and lineage when available.
- Security test coverage and unresolved exposure risks.

## 9. PBIR report structure and correctness

- Page inventory, purpose, active/hidden state, size, navigation, tooltips, and
  drillthrough.
- Visual inventory, type, bindings, titles, filters, sorting, interactions,
  conditional formatting, field parameters, and calculations.
- Report/page/visual filters and slicers, sync groups, default state, and reset
  behavior.
- Bookmarks, selections, buttons, navigation, personal bookmarks assumptions,
  and hidden objects.
- Broken/stale bindings, duplicated visuals, overlapping/off-canvas objects,
  and hidden dependencies.
- Visual output reconciliation with measure/query results.
- Theme, layout consistency, number/date formats, titles, legends, labels, and
  responsive behavior.

## 10. Report performance and usability

- Performance Analyzer evidence per important page and interaction.
- Visual query count/fan-out, page density, custom visuals, and expensive
  cross-highlighting.
- DirectQuery reduction options, slicer apply behavior, and initial filters.
- Query/render time separation, cold/warm behavior, and representative user
  paths.
- Appropriate visual types, information density, discoverability, and error
  states.
- Mobile layout and screen-size behavior when relevant.

## 11. Accessibility

- Color contrast and non-color encoding.
- Alt text and meaningful visual/page titles.
- Tab/focus order and keyboard navigation.
- Slicer/filter labeling and usable target sizes.
- Screen-reader reading order and avoidance of inaccessible custom visuals.

## 12. Refresh, service, and operations

- Refresh history, duration, failures, retries, timeouts, and schedule overlap.
- Gateway/data-source mapping, capacity/network constraints, and credentials.
- Incremental refresh, partition management, change detection, and deleted-row
  behavior.
- Deployment pipelines, parameter rules, endorsements, lineage, and dependent
  items.
- Monitoring, alerts, ownership, support runbook, rollback, and disaster
  recovery.

## 13. Usage and cleanup

- Direct report, transitive model, structural, security, and external usage.
- Thin reports, Excel/XMLA, APIs, notebooks, subscriptions, and workspace
  dependencies.
- Duplicate, deprecated, hidden, disconnected, and unobserved objects.
- Consumer migration and deprecation plan.
- Confirmed-scope deletion candidates vs manual-review candidates.

## 14. Maintainability

- One authoritative owner per business rule.
- Clear source/M/model/report boundaries.
- Intention-revealing naming and organization.
- Descriptions, display folders, query groups, comments, and metric contracts.
- Automated/static validation, DAX tests, source reconciliations, refresh
  baselines, report smoke tests, and security tests.
- Small reviewable changes, stable public contracts, deployment scripts, and
  reversible migrations.
