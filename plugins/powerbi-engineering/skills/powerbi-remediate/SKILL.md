---
name: powerbi-remediate
description: Plan, suggest, or implement explicitly approved findings from a comprehensive Power BI audit across SQL, Power Query, semantic-model TMDL, DAX, relationships, refresh, RLS/OLS definitions, and PBIR reports. Use when the user approves finding IDs or a bounded roadmap and wants a readable, maintainable, deployment-ready PBIP project with exact code, validation, documentation, dependency-safe cleanup, and rollback. Supports Suggest Mode by default and Apply Mode only when explicitly requested; do not use for unapproved open-ended changes.
---

# Power BI Remediation

Invoke this skill only when the user explicitly names it or explicitly approves
specific audit finding IDs or a bounded remediation roadmap. Do not infer this
workflow from a general request to improve or edit a report.

Turn approved findings into a coherent, readable, testable project while
preserving business results, report behavior, refresh behavior, security, and
deployment contracts.

Default to Suggest Mode. Modify nothing unless the user explicitly requests
Apply Mode.

## Preconditions

- Require the audit directory and specific approved finding IDs or a clearly
  bounded approved roadmap.
- Read the complete finding records, evidence, affected objects, known
  consumers, prerequisites, validation, and rollback.
- Recompute the source fingerprint. If it changed, rerun the relevant audit
  areas and revalidate the dependency graph before proceeding.
- Read [safety-contract.md](references/safety-contract.md),
  [implementation-playbook.md](references/implementation-playbook.md), and
  [maintainable-project-standard.md](references/maintainable-project-standard.md).
- For implementation details, read the relevant layer standard directly from
  the sibling skill directory — `../powerbi-sql-optimization/references/`,
  `../powerbi-power-query-optimization/references/`, or
  `../powerbi-dax-optimization/references/`. Reading the reference is enough;
  those skills do not need to be separately invoked.
- Before any live-model work or refresh test, read
  `../powerbi-solution-audit/references/live-connection.md`. Every validation
  step here goes through the Windows-side modeling server only — prefix
  `mcp__powerbi-modeling__*` (Codex: `powerbi-modeling.*`), never a Linux/WSL
  one — plus its preflight, Windows path conversion, and timed refresh budget
  rules.
- For TMDL syntax, PBIP structure, or PBIR visual-JSON edits, read the
  maintained references from the installed `powerbi-authoring` plugin
  (versioned directory — resolve with a glob; Claude Code caches under
  `~/.claude/plugins/`, Codex under `~/.codex/plugins/`):
  `~/.{claude,codex}/plugins/cache/fabric-collection/powerbi-authoring/*/skills/semantic-model-authoring/references/`
  (`tmdl-guidelines.md`, `pbip.md`, `modeling-guidelines.md`,
  `naming-conventions.md`, `dax-guidelines.md`) and the sibling
  `.../skills/powerbi-report-authoring/references/` for PBIR visuals, filters,
  and formatting. If that path is absent, say so and proceed on the layer
  standards alone.

## Suggest Mode

For each approved finding:

1. State affected objects, direct/transitive consumers, deployment targets,
   prerequisites, and conflicts with other findings.
2. Group related findings into dependency-safe change sets and order them by
   correctness, contract, foundation, performance, maintainability, and cleanup.
3. Evaluate every plausible implementation layer. Select the clearest governed
   owner and explain rejected alternatives.
4. Provide exact file/object changes, SQL/M/DAX/TMDL/PBIR, migration steps,
   documentation updates, validation, and rollback.
5. Explain correctness, security, refresh, query, report, and maintainability
   risk separately.
6. Include no unrelated cleanup, renaming, or restyling.

## Apply Mode

Implement one dependency-safe change set at a time:

1. Record the before-state, source fingerprint, consumer graph, baseline
   queries, timings, and rollback procedure.
2. Add or update tests/reconciliation queries before changing logic where
   practical.
3. Apply the smallest coherent change through the appropriate authoring tool
   or source file.
4. Validate syntax, structure, business results, blanks/totals, dependencies,
   refresh/folding, security context, and rendered report behavior as relevant.
5. Run bounded, equivalent before/after performance tests when the finding
   claims a performance improvement. Time refresh tests per
   `live-connection.md`: smallest partition, stated budget up front, traces
   wrapped around the window, stop at budget and report inconclusive.
6. Roll back the change set immediately if any required contract fails.
7. Update names, descriptions, display folders, query groups, comments, and
   deployment documentation required by the maintainable-project standard.
8. Regenerate the full static audit and re-run affected live checks. Confirm no
   new missing references, behavior regressions, or security gaps.

Never batch unrelated changes. Never delete an object merely because local
PBIR usage is absent; check available thin reports, Excel, APIs, perspectives,
calculation groups, roles, and other workspace consumers.

Treat RLS/OLS definition changes as high risk. Apply them only when the user
specifically approved the security finding and representative identity tests
are available. Role membership or workspace access changes require separate
explicit authorization.

## Output

Create a remediation log containing finding IDs, change sets, affected files
and objects, before/after evidence, validation results, performance results,
documentation changes, rollback status, residual risks, and deferred work.
Return a concise completion summary linked to the detailed diffs and evidence.
