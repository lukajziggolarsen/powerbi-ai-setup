# Audit Deliverable Contract

Create the following under `.powerbi-audit/`. If a file already exists for the
same source fingerprint, update it rather than creating competing reports.

## Required files

### `scope.md`

Record target, source fingerprint, included/excluded systems, business
contracts, environments, connections, evidence classes, limitations, and test
budgets.

### `executive-summary.md`

Include:

1. solution purpose and architecture;
2. assessed coverage;
3. correctness and security status;
4. most important confirmed findings;
5. measured performance baseline;
6. overall and dimension health scores;
7. prioritized next actions.

Keep this decision-oriented. Do not hide limitations.

### `audit-report.md`

Use this order:

1. Executive Summary
2. Scope, Method, Evidence, and Limitations
3. Architecture and Data Flow
4. Business Logic / Correctness Findings
5. Security and Governance Findings
6. Source and SQL Findings
7. Power Query and Refresh Findings
8. Semantic Model, Relationships, and VertiPaq Findings
9. DAX Findings
10. PBIR Report, Performance, Usability, and Accessibility Findings
11. Usage, Dependencies, and Cleanup Classification
12. Maintainability and Deployment Findings
13. Health Score
14. Prioritized Remediation Roadmap
15. Validation Plan
16. Appendices and Official References

### `findings.jsonl`

One object per finding:

```json
{
  "id": "PBI-COR-001",
  "title": "Net revenue drops unmatched return rows",
  "layer": "sql",
  "category": "correctness",
  "severity": "critical",
  "priority": "P0",
  "confidence": "confirmed",
  "evidenceClass": "proven",
  "affectedObjects": ["sql.vw_FactRevenue", "Measures[Net Revenue]"],
  "consumers": ["Executive Summary/V12"],
  "currentBehavior": "Returns without a matching sale are removed.",
  "expectedBehavior": "All posted returns reduce net revenue.",
  "impact": "Net revenue is overstated.",
  "rootCause": "An inner join is used for optional enrichment.",
  "evidence": ["source-tests/revenue-reconciliation.sql"],
  "recommendation": "Preserve the return fact row and left join enrichment.",
  "targetLayer": "sql",
  "alternativesRejected": ["DAX compensation duplicates source rules."],
  "validation": ["Reconcile daily net revenue including orphan return cases."],
  "rollback": "Restore the prior view definition.",
  "effort": "medium",
  "risk": "medium",
  "references": ["https://learn.microsoft.com/..."]
}
```

Stable IDs must remain stable across reruns when the root cause and principal
object are unchanged.

### `coverage-matrix.md`

For every section in `audit-checklist.md`, record status, evidence, limitations,
and follow-up needed.

### `object-inventory.csv`

Include object ID, layer, kind, qualified name, source file, visibility/load
state, storage mode, direct consumers, transitive consumers, security
dependencies, and cleanup classification.

### `dependency-map.md`

Document the critical paths from source objects to SQL/M/model/DAX/report
consumers. Include cleanup blockers and cross-layer ownership.

### `performance-baseline.md`

Record test workload, environment, data/cache state, source plans/timings,
folding/diagnostics, refresh/processing, DAX Server Timings, and report
Performance Analyzer results. Mark absent evidence.

### `validation-plan.md`

Provide the exact reconciliations, boundary cases, DAX queries, refresh tests,
report smoke tests, and security identity tests required for remediation.

### `roadmap.md`

Group finding IDs into dependency-safe phases:

1. correctness and security;
2. broken contracts and reliability;
3. architectural foundations;
4. measured performance;
5. maintainability and documentation;
6. deprecation and cleanup.

For each phase include prerequisites, expected benefit, effort, risk,
validation, rollback, and change owner.

## Chat handoff

Summarize purpose, coverage, correctness/security status, top confirmed
findings, measured bottlenecks, score, and next recommended phase. Link the
detailed artifacts. Do not paste the full inventory into chat.
