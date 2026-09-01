# DAX and Semantic-Model Engineering Standard

## Contents

- Metric contracts and correctness
- Model prerequisites
- DAX structure
- Context and filter design
- Performance analysis
- Calculated objects and layer placement
- Organization and maintainability
- Official references

## Metric contracts and correctness

For every critical measure, document:

- business definition and owner;
- base fact grain and aggregation grain;
- date role/fiscal calendar;
- filters, exclusions, and relationship behavior;
- units, currency, conversion, and rounding;
- blank/zero and total/subtotal behavior;
- source/control reconciliation.

Validate with explicit DAX queries for totals, grouped slices, boundary periods,
blanks, unknown members, single/multi/no selections, and subtotal contexts.

## Model prerequisites

Before rewriting DAX, verify:

- fact/dimension grain and unique dimension keys;
- relationship cardinality, direction, active state, ambiguity, and orphans;
- appropriate date tables and role-playing relationships;
- storage mode and DirectQuery/Direct Lake limitations;
- column data types, cardinality, visibility, sort-by, and summarization;
- calculation groups, perspectives, field parameters, and security filters.

Fixing the dimensional contract is often better than compensating with complex
DAX.

## DAX structure

- Build governed base measures for additive facts and counts.
- Branch into reusable business measures instead of duplicating expressions.
- Use variables for repeated logic, readability, and debugging, while
  respecting where the variable is evaluated relative to filter changes.
- Use explicit measure references and fully qualified column references.
- Prefer `DIVIDE` where divide-by-zero/blank handling matches the contract.
- Preserve BLANK when it carries business and visual meaning.
- Use format strings/dynamic formats instead of converting numbers to text.
- Keep measures focused; use calculation groups for genuinely reusable
  transformations when precedence and interactions are understood.

## Context and filter design

Review deliberately:

- row context vs filter context;
- context transition introduced by measure evaluation or `CALCULATE`;
- replacement vs intersection behavior and `KEEPFILTERS`;
- filter removal scope using `REMOVEFILTERS`, `ALL`, or variants;
- inactive relationship activation and role-playing dimensions;
- virtual relationships and set propagation;
- iterator input grain and whether totals require re-evaluation;
- `ALLSELECTED` and visual-total semantics;
- blank row/unknown member behavior;
- security filters and relationship propagation.

Prefer Boolean column filter arguments to table `FILTER` arguments when they
are semantically equivalent and supported. Use `FILTER` when the logic truly
requires a table expression; it is not inherently wrong.

## Performance analysis

Capture representative visual/query DAX with Server Timings and query plans.
Assess:

- Formula Engine vs Storage Engine duration;
- number and shape of Storage Engine queries;
- callbacks and row-by-row evaluation;
- materialized virtual-table size;
- repeated scans and repeated subexpressions;
- iterator grain and cardinality;
- broad filters over expanded tables;
- context transitions inside large iterators;
- virtual relationships and set sizes;
- DirectQuery native query count/shape;
- report page fan-out and concurrent measures.

Optimize the material bottleneck, then rerun identical result and timing tests.
Do not rewrite from static pattern matching alone.

## Calculated objects and layer placement

Calculated columns/tables consume processing and storage in Import models and
can produce inefficient source queries in DirectQuery. Evaluate stable
row-level logic for source SQL or foldable M when the move is governable and
semantically identical.

Retain DAX calculated objects when they depend on model-only semantics,
calculated-table behavior, deployment constraints, or a clearer governed
implementation. Keep dynamic filter-context results as measures.

Pre-aggregation can support measures but must preserve all required slicing and
detail behavior.

## Organization and maintainability

- Use consistent business-facing measure names.
- Group measures in stable display folders by subject, not developer.
- Add descriptions containing definition, grain/date basis, units, and
  non-obvious filters.
- Apply format strings and data categories consistently.
- Remove or deprecate duplicates only after dependency and report usage checks.
- Keep a DAX query suite for critical metrics and edge cases.
- Document calculation-group precedence, inactive relationships, and security
  assumptions.

## Official references

- [Use variables in DAX](https://learn.microsoft.com/en-us/dax/best-practices/dax-variables)
- [Power BI guidance index and DAX guidance](https://learn.microsoft.com/en-us/power-bi/guidance/)
- [Star schema guidance](https://learn.microsoft.com/en-us/power-bi/guidance/star-schema)
- [Data reduction](https://learn.microsoft.com/en-us/power-bi/guidance/import-modeling-data-reduction)
- [DirectQuery model guidance](https://learn.microsoft.com/en-us/power-bi/guidance/directquery-model-guidance)
- [Performance Analyzer](https://learn.microsoft.com/en-us/power-bi/create-reports/desktop-performance-analyzer)
