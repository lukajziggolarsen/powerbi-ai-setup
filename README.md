# Power BI AI development blueprint

This is a portable, opinionated setup for developing source-controlled Power
BI projects with both Codex and Claude Code. It keeps Microsoft's authoring
plugin as the general-purpose layer, adds a small local plugin for specialized
engineering, and exposes exactly one modeling MCP to each agent.

The blueprint targets **Windows 11 + Power BI Desktop + WSL 2**. It is safe to
inspect or run with `--dry-run`; it does not change the current machine merely
by existing in this repository.

## Architecture

| Layer | Selected component | Purpose |
|---|---|---|
| Report/model skills | `powerbi-authoring@fabric-collection` | Microsoft's PBIR, design, planning, semantic-model, and optional Fabric workflows |
| Deep engineering | `powerbi-engineering@powerbi-ai-blueprint` | Difficult DAX, M, SQL, full audits, approved remediation, and Scapp-only design |
| PBIR CLI | `powerbi-report-author` | Deterministic report editing and validation |
| Desktop bridge | `powerbi-desktop` | Open/reload/screenshot validation in Power BI Desktop |
| Modeling MCP | one Windows-side `powerbi-modeling` server | Live Desktop and offline PBIP/TMDL model operations without 21 duplicate tools |
| Source MCPs | optional project profiles | Read-only PostgreSQL or SQL Server evidence when a project needs it |
| Agent policy | `AGENTS.md` and `CLAUDE.md` | The same routing, security, and definition-of-done contract for both agents |

Power BI Desktop is the only mandatory GUI component. The Microsoft modeling
MCP is still preview software, so versions are pinned in `versions.env` and
upgrades should be deliberate.

## Fresh-machine setup

Prerequisites:

- Power BI Desktop on Windows. In Desktop, enable the external-tool/Desktop
  bridge preview feature and restart Desktop.
- WSL 2 with Node.js 20+ (`node`, `npm`, and `npx`) and Git.
- Node.js LTS on Windows. The installer can install this through `winget` if it
  is missing.

Copy or clone this directory onto the new machine, then preview the work:

```bash
cd powerbi-ai-blueprint
./setup.sh --workspace /path/to/powerbi-workspace --dry-run
```

Run it for real:

```bash
./setup.sh --workspace /path/to/powerbi-workspace
./doctor.sh --workspace /path/to/powerbi-workspace
```

The installer:

- installs missing Codex and Claude Code CLIs and the pinned Power BI CLIs;
- registers Microsoft's Fabric marketplace and this local marketplace;
- installs both plugins at project scope for Claude and enables them for the
  Codex project;
- installs shared MCP launchers under `~/.local/bin`;
- writes minimal project configs, disabling the bundled duplicate modeling MCP;
- creates backups under `~/.local/state/powerbi-ai-blueprint/backups` before
  changing an existing config;
- preserves pre-existing `AGENTS.md` and `CLAUDE.md` files.

Use `--help` to see skip flags and alternative paths. Run the installer again
after changing a pinned version; configuration writes are idempotent.

### Optional database MCPs

Database tools are omitted by default. A single environment file declares any
number of connections. The installer derives MCP registrations directly from
the variable names, so no connection names are hardcoded in scripts or JSON.

```bash
cp config/connections.env.example /tmp/my-powerbi-connections.env
# Replace the example profiles and values. Do not commit this populated file.

./setup.sh \
  --workspace /path/to/powerbi-workspace \
  --env-file /tmp/my-powerbi-connections.env
./doctor.sh \
  --workspace /path/to/powerbi-workspace \
  --env-file ~/.config/powerbi-ai/connections.env
```

Use the contract `<KIND>_<CONNECTION_NAME>_<FIELD>`. Connection names are
chosen by you and must use uppercase letters, numbers, and underscores:

```dotenv
PSQL_WAREHOUSE_URL=replace_with_postgresql_url

MSSQL_OPERATIONS_HOST='host'
MSSQL_OPERATIONS_PORT='1433'
MSSQL_OPERATIONS_DATABASE='database'
MSSQL_OPERATIONS_SCHEMA='dbo'
MSSQL_OPERATIONS_USER='read_only_user'
MSSQL_OPERATIONS_PASSWORD=replace_me
MSSQL_OPERATIONS_ENCRYPT='true'
```

Repeat either block with another connection name to add another database. For
example, `PSQL_ARCHIVE_*` and `MSSQL_FINANCE_*` create two additional MCP
servers. PostgreSQL requires only `PSQL_<NAME>_URL`. SQL Server requires
`HOST`, `DATABASE`, `SCHEMA`, `USER`, and `PASSWORD`; its port defaults to
`1433`.

Put PostgreSQL database, schema/search path, TLS, and other libpq options in the
URL. `MSSQL_<NAME>_ENCRYPT` is optional. Either kind can override its generated
MCP server name with `<KIND>_<NAME>_MCP_NAME`.

The installer safely parses assignments without executing the environment file,
validates every declared connection, and copies it to
`~/.config/powerbi-ai/connections.env` with mode `0600`.

For SQL Server, Toolbox has no connection-level schema setting, so `SCHEMA` is
supplied to the MCP as the preferred qualification hint; database permissions
remain the actual security boundary.

PostgreSQL connections require `uvx`. SQL Server connections use the pinned Toolbox
package through `npx`. All database accounts must enforce read-only access at
the database; the MCP configuration cannot substitute for database grants.

## Migrating this machine

This machine already has a local engineering plugin under different
marketplace names. The installer intentionally stops instead of silently
replacing it. After reviewing the vendored plugin, remove the old registrations
and rerun setup:

```bash
codex plugin remove powerbi-engineering@personal
claude plugin uninstall powerbi-authoring@fabric-collection --scope user
claude plugin uninstall powerbi-engineering@local-plugins --scope user
./setup.sh --workspace /home/ziggo/powerbi
```

Do not copy the existing `.claude/settings.local.json` to another machine. It
contains stale cache paths and an overly broad historical permission list.

## Security and maintenance

- Never put connection URIs, passwords, PATs, or tokens in `.codex/config.toml`,
  `.mcp.json`, Claude settings, or a repository.
- Run `node scripts/secret-audit.mjs <config-files...>` before committing agent
  configuration. The scanner reports only file and line, never the matched
  value.
- Keep plugins project-scoped. Global Power BI plugins add instruction context
  to unrelated sessions.
- Run `doctor.sh --live` when Desktop is open to add a bridge connectivity
  check.
- Review [REVIEW.md](REVIEW.md) before removing anything from an existing
  installation.

## Primary references

- [Microsoft skills for Fabric](https://github.com/microsoft/skills-for-fabric/blob/main/README.md)
- [Microsoft Power BI modeling MCP](https://github.com/microsoft/powerbi-modeling-mcp)
- [Power BI Desktop bridge](https://learn.microsoft.com/en-us/power-bi/developer/agentic/power-bi-desktop-bridge-overview)
- [Claude Code MCP configuration](https://code.claude.com/docs/en/mcp)
- [Codex MCP configuration](https://learn.chatgpt.com/docs/extend/mcp)
- [Codex plugins](https://learn.chatgpt.com/docs/plugins)
