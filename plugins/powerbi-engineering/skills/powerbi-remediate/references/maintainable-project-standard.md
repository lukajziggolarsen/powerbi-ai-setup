# Maintainable Power BI Project Standard

## Contents

- Ownership and calculation placement
- Project organization
- SQL
- Power Query
- Semantic model and DAX
- PBIR reports
- Tests and documentation
- Definition of done

## Ownership and calculation placement

Assign each business rule one authoritative owner. Avoid independently
reimplementing the same rule in SQL, M, and DAX.

Choose the layer by semantics and governance:

| Need | Usual owner |
|---|---|
| Reusable source cleansing, conformance, joins, stable row logic, durable aggregation | SQL/warehouse |
| Model-specific shaping, connector adaptation, parameterized ingestion | Power Query |
| Dynamic results that respond to model filter context | DAX measure |
| Presentation, navigation, and interaction behavior | PBIR report |

Require semantic equivalence, a supported deployment path, testability,
ownership, and rollback before moving logic.

## Project organization

- Keep PBIP, report, semantic model, source SQL, tests, and deployment assets
  version-controlled.
- Use intention-revealing names; avoid `Final`, `New`, `v2`, `Test`, and
  unexplained abbreviations.
- Keep generated/local cache files out of source control.
- Parameterize environment-specific servers, databases, paths, and workspace
  identifiers.
- Preserve stable public object names or include a consumer migration.
- Keep one responsibility per change set and make diffs reviewable.

## SQL

- Separate source extraction, conformance, enrichment, aggregation, and
  publishing contracts.
- Use explicit schemas, column lists, types, keys, grain comments, and
  deterministic joins.
- Keep business rules readable and physical tuning evidence-backed.
- Include deployment and rollback scripts plus representative test parameters.

## Power Query

- Group queries by parameters/functions, staging, dimensions, facts, and
  helpers.
- Disable load for staging/helper queries unless a model table is intended.
- Use meaningful step names, explicit types, narrow schemas, and shared
  references.
- Document the last verified folding step for important relational queries.
- Keep RangeStart/RangeEnd and environment parameters centralized.

## Semantic model and DAX

- Use a clear dimensional design with declared fact/dimension grain.
- Hide technical keys and non-user-facing columns where appropriate.
- Organize measures in stable display folders; add descriptions, format
  strings, and units.
- Prefer small base measures and deliberate branching over duplicated
  expressions.
- Document inactive relationships, role-playing dimensions, calculation
  groups, non-obvious filter behavior, and security assumptions.
- Preserve lineage tags and stable identities when authoring tools support it.

## PBIR reports

- Use stable page/visual names and consistent navigation.
- Make page purpose, filters, interactions, tooltips, drillthrough, and
  bookmarks intentional.
- Apply a consistent theme, accessible contrast, alt text, focus/tab order,
  and descriptive titles.
- Avoid unexplained hidden pages, overlapping visuals, stale bindings, and
  excessive query fan-out.

## Tests and documentation

Maintain:

- metric contracts for critical KPIs;
- DAX reconciliation and boundary queries;
- source-stage row-count, uniqueness, null, orphan, and control-total checks;
- refresh/folding baselines for critical tables;
- representative report-performance baselines;
- role/security test cases where applicable;
- a remediation log and deployment/rollback instructions.

## Definition of done

A change is complete only when:

1. approved scope is implemented;
2. syntax and model/report validation pass;
3. business results reconcile;
4. refresh, query, report, and security behavior are preserved or improved;
5. consumers and deployment assets are updated;
6. names, descriptions, organization, and tests meet this standard;
7. rollback is available;
8. the follow-up audit shows no introduced regression.
