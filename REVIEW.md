# Power BI AI tooling review

Inventory date: **2026-09-01**. Scope: the installed Codex and Claude Code
tooling, plugins, skills, MCP servers, project guidance, and related CLIs on
this workstation. “Remove” means remove or disable from the active Power BI
agent configuration; it does not mean delete user projects or Power BI files.

## Executive decision

Keep a four-part core:

1. Microsoft's `powerbi-authoring` plugin.
2. `powerbi-report-author` and `powerbi-desktop` CLIs.
3. One Windows-side Microsoft modeling MCP shared conceptually by both agents.
4. The local engineering plugin, with narrowed triggers and project scope.

Make Fabric publishing and source-database MCPs opt-in per project. Remove
duplicate modeling servers, stale permission entries, global Power BI plugin
scope, duplicated database tool definitions, caches, and all inline secrets.

## Installed inventory and disposition

| Item found | Evidence | Decision | Reason |
|---|---:|---|---|
| Codex CLI | 0.152.0 | Keep | Primary agent runtime |
| Claude Code | 2.1.247 | Keep | Second supported agent runtime |
| `powerbi-report-author` | 0.1.4 | Keep, pinned | Core deterministic PBIR editing/validation |
| `powerbi-desktop` | 0.1.2 | Keep, pinned | Core Desktop open/reload/screenshot loop |
| Codex `powerbi-authoring` | 0.3.14 | Keep | Best general Microsoft skill bundle |
| Claude `powerbi-authoring` | 0.3.9 | Update and project-scope | Older than the Codex install; user scope adds unrelated context |
| Local `powerbi-engineering` | 0.4.0 | Keep as 0.4.1, project-scope | Valuable specialist workflows; triggers needed deconfliction |
| Standalone Windows modeling MCP | 21 tools | Keep | Successfully covered Desktop and PBIP folder workflows in this WSL topology |
| Plugin-bundled modeling MCP | same 21 tools | Disable | Exact duplicate surface and wrong process boundary risk in WSL |
| PostgreSQL `rep` and `f1` MCPs | 9 tools each | Optional | Different databases, so not duplicates; only relevant in some projects |
| SQL Server `bi` and `qisa` MCPs | 2 tools each | Optional | Different databases; keep only where their evidence is needed |
| Two MSSQL Toolbox YAML files | equivalent role | Consolidate | One parameterized config plus profiles is simpler |
| GitHub MCP in Claude project | non-Power-BI | Exclude | Useful generally, but irrelevant to this blueprint |
| Azure CLI / `jq` | not installed | Conditional | Needed only for Fabric report-management workflows |
| Fabric CLI, `pbi-tools`, `sqlcmd` | not installed | Do not add by default | No demonstrated gap in the chosen workflow |
| `scapp-report-blueprint.zip` | duplicate archive | Remove from package | Unpacked skill is canonical |
| Python `__pycache__` | generated files | Remove/ignore | No runtime value in a portable plugin |

The source MCPs failed to start inside the restricted Codex inspection sandbox
because its UV cache and WSL networking were blocked. That is not evidence that
they fail in a normal terminal, so the review classifies them by architectural
value rather than treating the sandbox result as a product failure.

## Skill overlap analysis

### Microsoft authoring plugin

| Skill | Decision | Boundary |
|---|---|---|
| `powerbi-report-authoring` | Keep | PBIR pages, visuals, filters, themes, validation, Desktop rendering |
| `semantic-model-authoring` | Keep | Routine table, column, relationship, measure, partition, and TMDL work |
| `powerbi-report-design` | Keep | Generic design direction before PBIR implementation |
| `powerbi-report-planning` | Conditional | Greenfield requirements/approval workflow only; overhead for bounded edits |
| `powerbi-report-management` | Conditional | Fabric publish/download/update only; inert locally without Azure CLI/auth |
| `check-updates` in older Claude bundle | Remove as a workflow dependency | Package managers and `doctor.sh` own version checks |

### Local engineering plugin

These are not duplicates when their triggers stay narrow:

| Skill | Keep for | Must not intercept |
|---|---|---|
| `powerbi-dax-optimization` | wrong totals, hard filter context, slow/complex measures, timings/plans | routine measure CRUD |
| `powerbi-power-query-optimization` | folding, slow refresh, architecture, complex M | routine partition/expression edits |
| `powerbi-sql-optimization` | source correctness/performance, plans, indexes, pushdown | ordinary database lookup |
| `powerbi-solution-audit` | explicit end-to-end read-only audits | casual “review this visual” requests |
| `powerbi-remediate` | explicitly approved audit finding IDs | open-ended changes |
| `scapp-report-blueprint` | Scapp/house-style projects only | generic dashboard design |

Version 0.4.1 in this blueprint narrows the DAX, M, SQL, and Scapp descriptions
to enforce those boundaries. Audit and remediation retain explicit-only trigger
language. Their prior Claude-only `disable-model-invocation` field was removed
because it makes a shared plugin invalid in Codex.

## MCP design decision

The installed standalone and bundled Microsoft modeling servers expose the same
21 tools. Carrying both adds tool-selection ambiguity, startup cost, and a
serious WSL topology trap: a Linux process cannot see Desktop's Windows-local
Analysis Services process. The retained launcher starts the pinned MCP through
Windows `npx.cmd` when running in WSL and can also open WSL PBIP folders through
their UNC path.

The blueprint therefore configures:

- Codex: standalone `mcp_servers.powerbi-modeling`; bundled plugin MCP disabled.
- Claude: project `.mcp.json` server `powerbi-modeling`; plugin server
  `plugin:powerbi-authoring:powerbi-modeling-mcp` disabled for the project.

The modeling MCP is preview software and can perform write operations. The
launcher uses read/write mode because development requires it, but deliberately
does not use `--skipconfirmation`. Review diffs and keep backups.

## Configuration cleanup recommended on this machine

1. **Rotate the database credentials currently embedded in Codex configuration.**
   They were stored as plaintext environment values. Rotation is required even
   if the files are later cleaned.
2. Replace inline database secrets with the general-purpose, mode-0600
   `connections.env` profile file or an approved OS credential store. Profile
   discovery comes from the file itself; no database names live in the scripts.
3. Replace Claude's broad `.claude/settings.local.json` allowlist. It contains
   an obsolete `Skill(powerbi-expert)` permission, old `0.3.6` cache paths, an
   old plugin MCP namespace, source-server names without a project `.mcp.json`,
   and broad shell permissions unrelated to normal Power BI development.
4. Upgrade Claude's Microsoft plugin from 0.3.9 and install both Power BI
   plugins at project scope rather than user scope.
5. Remove one modeling MCP registration in each agent. For this WSL workstation,
   retain the Windows-side standalone launcher.
6. Consolidate the two MSSQL Toolbox configurations into the parameterized file
   in this blueprint.
7. Do not ship `.zip`, `__pycache__`, plugin caches, local settings, screenshots,
   or credentials to the new machine.

The blueprint itself does not perform this migration until `setup.sh` is run.
It also stops on an engineering-plugin name collision so the old installation
cannot be replaced silently.

## Expected context and maintenance impact

Claude's two globally installed Power BI plugins contributed roughly 2,122
tokens of always-on skill descriptions per session during this review (about
1,081 from authoring and 1,041 from engineering). Project scope removes that
cost from unrelated repositories. Narrow descriptions also reduce false skill
activation without losing capability.

Package versions are centralized in `versions.env`. `doctor.sh` reports drift,
missing launchers, plugin state, duplicate-routing policy, unsafe secret
literals, and optional Desktop connectivity. Preview components should be
tested before changing pins.

## Upstream facts used for the decision

- Microsoft's modeling MCP supports Desktop, Fabric, and PBIP/TMDL workflows,
  exposes broad write capabilities, and is explicitly preview software:
  [official repository](https://github.com/microsoft/powerbi-modeling-mcp).
- Microsoft's focused Fabric installation supplies the authoring plugin and
  documents its report/model responsibilities:
  [skills-for-fabric README](https://github.com/microsoft/skills-for-fabric/blob/main/README.md).
- The Desktop bridge requires Windows Power BI Desktop and its preview feature:
  [Microsoft bridge overview](https://learn.microsoft.com/en-us/power-bi/developer/agentic/power-bi-desktop-bridge-overview).
- Claude plugin MCP server names use the `plugin:<plugin>:<server>` form and can
  be disabled per project:
  [Claude MCP documentation](https://code.claude.com/docs/en/mcp).
- Codex plugin-provided MCP servers can be disabled independently:
  [Codex plugin concepts](https://developers.openai.com/plugins/concepts/plugins).
