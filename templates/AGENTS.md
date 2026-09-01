# Power BI AI development contract

Use PBIP/PBIR/TMDL as the source-controlled format. Treat Power BI Desktop and
Fabric as validation/deployment targets, not as the only copy of the solution.

## Route work deliberately

- PBIR pages, visuals, filters, themes, validation, reloads, and screenshots:
  use the Microsoft `powerbi-report-authoring` skill.
- Open-ended report design: use `powerbi-report-design`. If the user asks for
  the Scapp/house style or the project is one of the established Scapp reports,
  use `scapp-report-blueprint` as the visual contract and the Microsoft skill
  for PBIR mechanics.
- Greenfield requirements and an approval gate: use
  `powerbi-report-planning`. Do not invoke it for a bounded existing-report
  edit.
- Routine table, column, relationship, measure, partition, or TMDL authoring:
  use `semantic-model-authoring`.
- Wrong totals, slow or complex DAX, Server Timings, or calculation-group
  refactoring: use `powerbi-dax-optimization`.
- Folding, refresh, staging, or complex M: use
  `powerbi-power-query-optimization`.
- Source SQL correctness, plans, indexes, or pushdown: use
  `powerbi-sql-optimization`.
- Full audits and cross-layer remediation are explicit workflows:
  `powerbi-solution-audit` then `powerbi-remediate`.
- Fabric report upload/download/publish is optional and uses
  `powerbi-report-management` only after the user explicitly requests a
  service-side change.

## Modeling MCP

Use the single server named `powerbi-modeling`. The bundled
`powerbi-modeling-mcp` server is disabled to avoid 21 duplicate tool
definitions and the wrong WSL process boundary.

In WSL, the configured launcher runs the Windows MCP process so it can see
Power BI Desktop. Convert WSL paths with `wslpath -w` before
`ConnectFolder`; UNC paths under `\\wsl.localhost\<distro>\...` are valid.

Choose one source of truth per operation:

- For a connected live model, inspect and modify through the MCP, then serialize
  deliberately if the PBIP files must change.
- For an offline PBIP/TMDL change, edit the source-controlled files and validate
  them; do not also mutate a stale live connection.
- Never use `--skipconfirmation`. Keep backups and review diffs before
  destructive model operations.

## Source systems

Database MCPs are project-specific and optional. Use only configured read-only
profiles. Database permissions—not a prompt or MCP label—must enforce read-only
access. DDL, DML, permission changes, or production deployment require explicit
authorization for the exact environment and objects.

## Definition of done

- Report changes: `powerbi-report-author validate`, then Desktop reload and
  screenshot review when Desktop is available.
- Model changes: validate object existence and representative DAX results;
  persist the intended TMDL/PBIP state.
- SQL/M/DAX optimization: reconcile before/after results before claiming a
  performance improvement.
- Review `git diff` and keep generated caches, credentials, local settings,
  and temporary screenshots out of source control.
- Publishing is never implied by a local edit.

## Security

Never place passwords, connection URIs, access tokens, or PATs in
`.codex/config.toml`, `.mcp.json`, Claude settings, repository files, or
command history. Launchers read secrets from
`~/.config/powerbi-ai/connections.env` (mode `0600`) or an approved credential
store. Rotate a credential immediately if it is exposed in plaintext.
