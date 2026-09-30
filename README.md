# Power BI AI development setup

One script that turns a fresh WSL distro into a working environment for
developing source-controlled Power BI projects (PBIP/PBIR/TMDL) with both
**Claude Code** and **Codex**. It installs the toolchain, registers the same
plugins with both agents, wires exactly one Power BI modeling MCP (plus optional
read-only database MCPs), and writes the shared agent guidance.

Target platform: **Windows 11 + WSL 2 + Power BI Desktop**. Verified from
scratch on fresh Ubuntu 24.04 and 26.04 WSL distros, as a user without sudo.

## What you get

| Layer | Component | Purpose |
|---|---|---|
| Report/model skills | `powerbi-authoring@fabric-collection` | Microsoft's `powerbi-report-cli` (planning, design, PBIR authoring, Fabric management modes) and `semantic-model-authoring` skills |
| Deep engineering | `powerbi-engineering@powerbi-ai-setup` (vendored in `plugins/`) | Difficult DAX, M and SQL, full audits, approved remediation, Scapp house-style design |
| PBIR CLI | `powerbi-report-author` | Deterministic report editing and `validate` |
| Desktop bridge | `powerbi-desktop` | Open, reload and screenshot reports in Power BI Desktop |
| Modeling MCP | one Windows-side `powerbi-modeling` server | Live Desktop and offline PBIP/TMDL model operations, without the plugin's duplicate WSL-side server |
| Source MCPs | optional, one per database profile | Read-only PostgreSQL or SQL Server evidence |
| Agent policy | `AGENTS.md` and `CLAUDE.md` in the workspace | One routing, security and definition-of-done contract for both agents |

## Requirements

- **Windows 11 with WSL 2** and any Ubuntu distro (`wsl --install` is enough).
  Ubuntu already ships `git`, `curl`, `tar` and `sha256sum`; nothing else needs
  to be installed first, and no sudo is required.
- **Power BI Desktop** on Windows, with the Desktop bridge (external tools)
  preview feature enabled, then Desktop restarted.
- **Internet access** to nodejs.org, github.com, registry.npmjs.org and pypi.org.
- A Claude and an OpenAI account to sign in to the two agents afterwards.

`setup.sh` bootstraps the rest: Node.js LTS and `uv` into `~/.local` (official
builds, checksum-verified), and Node.js LTS on Windows through `winget` if it is
missing (accept the UAC prompt).

## Quick start on a new machine

```bash
mkdir -p ~/powerbi && cd ~/powerbi
git clone https://github.com/lukajziggolarsen/powerbi-ai-setup.git
cd powerbi-ai-setup

./setup.sh --workspace ~/powerbi --dry-run   # preview; changes nothing
./setup.sh --workspace ~/powerbi             # add --env-file FILE for database MCPs
```

`--workspace` is the folder the agents are started in: it receives `.mcp.json`,
`.codex/config.toml`, `.claude/settings.json`, `AGENTS.md` and `CLAUDE.md`. The
layout above (this checkout inside the workspace) is a convention, not a
requirement. Clone over HTTPS on a new machine; it has no SSH key yet.

Then **open a new terminal**, so `~/.local/bin` is on `PATH`, and finish:

```bash
~/powerbi/powerbi-ai-setup/doctor.sh --workspace ~/powerbi          # static checks
~/powerbi/powerbi-ai-setup/doctor.sh --workspace ~/powerbi --live   # with Desktop open
cd ~/powerbi
claude   # sign in, trust the folder, approve the project MCP servers
codex    # sign in
```

A dry run on a machine without Node.js stops after announcing the Node.js
install, because the rest of the preview needs Node.js.

## What setup.sh does

1. Checks for `curl`, `tar`, `sha256sum` and `git`, and puts `~/.local/bin` on
   `PATH` for the run.
2. Installs Node.js LTS unless a Linux Node.js 22+ (Claude Code's minimum) is
   already on `PATH`, and
   points npm's global prefix at `~/.local` when the current one is not
   writable. Windows' `npm`/`npx`/`claude` shims on the appended Windows `PATH`
   are never mistaken for the Linux tools.
3. Installs any missing Codex and Claude Code CLIs, and the latest Power BI
   `powerbi-report-author` and `powerbi-desktop` CLIs.
4. Validates the database profile file, if there is one, and installs `uv`
   when a PostgreSQL profile needs it.
5. Checks that Windows interop works and that Windows `npx.cmd` exists
   (installing Windows Node.js LTS with `winget` if not).
6. Installs the MCP launchers into `~/.local/bin` and their config into
   `~/.config/powerbi-ai/`.
7. Registers Microsoft's `fabric-collection` marketplace and this checkout as the
   local `powerbi-ai-setup` marketplace with both agents, removing a registration
   under the old `powerbi-ai-blueprint` name or one pointing at a moved checkout.
8. Installs both plugins: Claude at project scope for `--workspace` (every
   `claude plugin` call runs inside the workspace, because Claude resolves the
   project from the working directory), Codex globally.
9. Runs `scripts/configure.mjs` to write the workspace configs. It disables the
   plugin's duplicate modeling server, backs up every file it changes under
   `~/.local/state/powerbi-ai-setup/backups/`, and never overwrites an existing
   `AGENTS.md` or `CLAUDE.md`.

Every step is idempotent: rerunning changes nothing that is already right.

| Option | Effect |
|---|---|
| `--workspace PATH` | Required. Workspace to configure; created if missing. |
| `--env-file FILE` | Database profiles (see below). Defaults to the installed `~/.config/powerbi-ai/connections.env` on reruns. |
| `--claude-scope SCOPE` | `project` (default), `local` or `user` for the Claude plugins. |
| `--bin-dir PATH` | Launcher directory (default `~/.local/bin`). |
| `--dry-run` | Print what would change. |
| `--skip-agent-clis` | Do not install missing Codex or Claude CLIs. |
| `--skip-npm-packages` | Do not install or upgrade the Power BI CLIs. |
| `--skip-plugins` | Do not touch marketplaces or plugins. |
| `--no-windows-node-install` | Only check for Windows `npx.cmd`; never run `winget`. |

`doctor.sh [--workspace PATH] [--env-file FILE] [--live]` changes nothing. It
checks the toolchain, marketplace paths, plugin load errors and versions,
project configs, credential leaks, and the database profile file. With
`--live` it also asks the Desktop bridge for status and completes an MCP
`initialize` handshake with every configured server, which surfaces credential
and TLS faults that otherwise appear only as `CONNECTION_CLOSED` inside an agent
session.

## Optional database MCPs

Database tools are omitted by default. One environment file declares any number
of connections, and setup derives an MCP server for each one from the variable
names, so no connection names are hardcoded in scripts or JSON.

```bash
cp config/connections.env.example ~/my-connections.env
chmod 600 ~/my-connections.env
# Replace the example profiles and values. Never commit the populated file.
./setup.sh --workspace ~/powerbi --env-file ~/my-connections.env
rm ~/my-connections.env   # setup keeps its own copy (mode 600)
```

Use the contract `<KIND>_<CONNECTION_NAME>_<FIELD>`. You choose the connection
names: uppercase letters, numbers and underscores.

```dotenv
PSQL_WAREHOUSE_URL='postgresql://read_only_user:replace-me@host:5432/db?sslmode=require'

MSSQL_OPERATIONS_HOST='host'
MSSQL_OPERATIONS_PORT='1433'
MSSQL_OPERATIONS_DATABASE='database'
MSSQL_OPERATIONS_SCHEMA='dbo'
MSSQL_OPERATIONS_USER='read_only_user'
MSSQL_OPERATIONS_PASSWORD='replace_me'
MSSQL_OPERATIONS_ENCRYPT='true'
```

These become the MCP servers `psql-warehouse` and `mssql-operations`; override
a name with `<KIND>_<NAME>_MCP_NAME`. Repeat a block with another name for
another database.

- **PostgreSQL** needs only `PSQL_<NAME>_URL`. Put the database, search path,
  TLS and other libpq options in the URL. It runs `postgres-mcp` in restricted
  mode through `uvx` on Python `PSQL_MCP_PYTHON` from `versions.env` (3.12; `uv`
  downloads it if the distro lacks it).
- **SQL Server** needs `HOST`, `DATABASE`, `SCHEMA`, `USER` and `PASSWORD`;
  `PORT` defaults to 1433. It runs MCP Toolbox through `npx`. Toolbox has no
  connection-level schema, so `SCHEMA` is only a qualification hint.
  `ENCRYPT` accepts `true` (default), `false`, `disable` or `strict`: `false`
  still performs a TLS handshake, so a server without a usable certificate,
  typically an older SQL Server, needs `disable`.

Setup parses the file without executing it, validates every connection, and
installs it as `~/.config/powerbi-ai/connections.env` with mode 600. The
launchers read secrets from there at start-up; no credential is ever written to
an agent config. Database permissions, not the MCP, must enforce read-only
access.

## Updating

- **Toolchain.** Rerun `setup.sh --workspace ~/powerbi`. Online components
  follow their `latest` releases; to isolate an upstream regression, temporarily
  replace `latest` in `versions.env` with an exact version.
- **The vendored `powerbi-engineering` plugin.** Edit it under `plugins/`, then
  bump `version` in both `.claude-plugin/plugin.json` and `.codex-plugin/plugin.json`
  and rerun setup. Claude caches plugins by version and ignores same-version
  changes; `doctor.sh` warns when an installed copy lags the checkout.
- **Workspace guidance.** `AGENTS.md` and `CLAUDE.md` are only created, never
  updated. After changing `templates/`, copy them over yourself.

## Moving or renaming this checkout

Both agents register this directory by absolute path. After a move, Claude shows
`powerbi-engineering` as "failed to load" and Codex refuses to list any plugin.
Rerun `setup.sh` from the new location; it re-registers the marketplace there.

This repository was previously called `powerbi-ai-blueprint`, and so was its
marketplace (plugin ID `powerbi-engineering@powerbi-ai-blueprint`). A rerun of
setup removes that registration from both agents and rewrites the workspace
configs to `powerbi-engineering@powerbi-ai-setup`.

Setup stops rather than replace a `powerbi-engineering` plugin from any other
marketplace. Uninstall that one first (`codex plugin remove <id>`,
`claude plugin uninstall <id> --scope <scope>`).

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `MZ: not found` or `exec format error` for any `.exe`; doctor reports Windows interop is broken | Another distro running systemd cleared the shared `WSLInterop` binfmt entry, typically when it stopped. From a Windows terminal: `wsl -u root -e sh -c 'echo :WSLInterop:M::MZ::/init:PF > /proc/sys/fs/binfmt_misc/register'` (or `wsl --shutdown`). |
| Claude plugin "failed to load"; Codex `marketplace root does not contain a supported manifest` | The checkout moved. Rerun `setup.sh`. |
| Commands missing right after setup | `~/.local/bin` is not on `PATH` yet. Open a new terminal; Ubuntu's `~/.profile` adds it once it exists. With zsh, add `export PATH="$HOME/.local/bin:$PATH"` to `~/.zprofile`. |
| Windows `npx.cmd` is unavailable | Install Node.js LTS on Windows (or let setup use `winget`), then rerun. Setup and the launcher re-read the Windows `PATH` from the registry, so no restart is needed. |
| PostgreSQL MCP: `Failed to build pglast` | `postgres-mcp` ran on a Python without `pglast` wheels. Keep `PSQL_MCP_PYTHON` at a version with wheels (3.12 or 3.13). |
| SQL Server MCP: `TLS Handshake failed: cannot read handshake packet: EOF` | Set `MSSQL_<NAME>_ENCRYPT='disable'` for that server. |
| Claude plugins read "not enabled" | Run `claude` and `doctor.sh` from, or with, the same `--workspace` that setup used. |

## Repository layout

```text
setup.sh, doctor.sh        installer and read-only checker
versions.env               upstream version channels (installed to ~/.config/powerbi-ai)
bin/                       MCP launchers and the env-file reader (installed to ~/.local/bin)
config/                    database profile example and the SQL Server Toolbox config
scripts/configure.mjs      writes the workspace and agent configs
scripts/mcp-probe.mjs      MCP initialize handshake used by doctor --live
scripts/secret-audit.mjs   credential-literal scanner used by doctor
templates/                 AGENTS.md and CLAUDE.md for new workspaces
plugins/powerbi-engineering/   the vendored Claude/Codex plugin
.claude-plugin/, .agents/plugins/   marketplace manifests for Claude and Codex
```

## Security

- Never put connection URIs, passwords, PATs or tokens in `.codex/config.toml`,
  `.mcp.json`, Claude settings or any repository. Run
  `node scripts/secret-audit.mjs <files...>` before committing agent configs; it
  reports file and line only, never the value.
- Keep the Power BI plugins project-scoped; global plugins add their
  instructions to unrelated sessions.
- Do not copy `.claude/settings.local.json` between machines; it holds
  machine-specific paths and permissions.

## References

- [Microsoft skills for Fabric](https://github.com/microsoft/skills-for-fabric/blob/main/README.md)
- [Microsoft Power BI modeling MCP](https://github.com/microsoft/powerbi-modeling-mcp)
- [Power BI Desktop bridge](https://learn.microsoft.com/en-us/power-bi/developer/agentic/power-bi-desktop-bridge-overview)
- [Claude Code plugins](https://code.claude.com/docs/en/plugins) and [MCP configuration](https://code.claude.com/docs/en/mcp)
- [Codex plugins](https://learn.chatgpt.com/docs/plugins) and [MCP configuration](https://learn.chatgpt.com/docs/extend/mcp)
- [WSL configuration (`wsl.conf`)](https://learn.microsoft.com/en-us/windows/wsl/wsl-config)
