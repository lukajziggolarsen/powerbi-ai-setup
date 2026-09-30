# Official Best-Practice Source Map

Use these primary Microsoft sources to verify recommendations. Link the
specific page supporting each material best-practice claim. Treat guidance as
context-sensitive; explain justified exceptions.

## Power BI architecture and optimization

- [Power BI guidance index](https://learn.microsoft.com/en-us/power-bi/guidance/)
- [Optimization guide for Power BI](https://learn.microsoft.com/en-us/power-bi/guidance/power-bi-optimization)
- [Star schema guidance](https://learn.microsoft.com/en-us/power-bi/guidance/star-schema)
- [Data reduction for Import models](https://learn.microsoft.com/en-us/power-bi/guidance/import-modeling-data-reduction)
- [DirectQuery model guidance](https://learn.microsoft.com/en-us/power-bi/guidance/directquery-model-guidance)
- [Incremental refresh configuration](https://learn.microsoft.com/en-us/power-bi/connect-data/incremental-refresh-configure)

## Power Query

- [Power Query best practices](https://learn.microsoft.com/en-us/power-query/best-practices)
- [Query folding guidance for Power BI](https://learn.microsoft.com/en-us/power-bi/guidance/power-query-folding)
- [Query folding basics](https://learn.microsoft.com/en-us/power-query/query-folding-basics)
- [Query plan](https://learn.microsoft.com/en-us/power-query/query-plan)
- [Native query folding](https://learn.microsoft.com/en-us/power-query/native-query-folding)

## DAX and semantic models

- [DAX best practices: variables](https://learn.microsoft.com/en-us/dax/best-practices/dax-variables)
- [Power BI DAX guidance index](https://learn.microsoft.com/en-us/power-bi/guidance/)
- [Model relationships](https://learn.microsoft.com/en-us/power-bi/transform-model/desktop-relationships-understand)
- [Storage modes](https://learn.microsoft.com/en-us/power-bi/transform-model/desktop-storage-mode)
- [Performance Analyzer](https://learn.microsoft.com/en-us/power-bi/create-reports/desktop-performance-analyzer)

## SQL Server and relational sources

Use engine-specific documentation when the source is not SQL Server.

- [Execution plan overview](https://learn.microsoft.com/en-us/sql/relational-databases/performance/execution-plans)
- [SQL Server index architecture and design](https://learn.microsoft.com/en-us/sql/relational-databases/sql-server-index-design-guide)
- [Query processing architecture](https://learn.microsoft.com/en-us/sql/relational-databases/query-processing-architecture-guide)
- [Query Store best practices](https://learn.microsoft.com/en-us/sql/relational-databases/performance/manage-the-sql-server-query-store)

## Project and metadata formats

- [Power BI Desktop projects](https://learn.microsoft.com/en-us/power-bi/developer/projects/projects-overview)
- [TMDL overview](https://learn.microsoft.com/en-us/analysis-services/tmdl/tmdl-overview)

## Maintained local references

When the installed `powerbi-authoring` plugin is available, also consult its
current semantic-model-authoring references for modeling, naming, TMDL, DAX,
DAX performance, Direct Lake, and PBIP authoring. Treat them as implementation
guidance; use Microsoft Learn links above for external attribution.

They live in the Claude Code and Codex plugin caches (the version directory
changes on plugin updates, so resolve it with a glob):

```bash
find ~/.claude/plugins/cache/fabric-collection/powerbi-authoring/*/skills \
  ~/.codex/plugins/cache/fabric-collection/powerbi-authoring/*/skills \
  -path "*semantic-model-authoring/references/*" -name "*.md" 2>/dev/null
```

Key files: `modeling-guidelines.md`, `naming-conventions.md`,
`dax-guidelines.md`, `dax-perf-decision-guide.md` (routes into
`dax-perf-patterns.md`), `tmdl-guidelines.md`, `pbip.md`, and
`direct-lake-guidelines.md` (Direct Lake models only). PBIR report-side
references are the sibling `powerbi-report-cli/references/` directory
(`authoring.md` and `authoring/` for PBIR, `design.md` and `design/` for layout).
If the path is absent, state that and rely on the Microsoft Learn links above.
