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
3. Installs the Codex and Claude Code CLIs, or updates them the way they were
   installed (npm, or their own `update` command for standalone installs), and
   installs the latest Power BI `powerbi-report-author` and `powerbi-desktop`
   CLIs.
4. Validates the database profile file, if there is one, and installs or
   updates `uv` when a PostgreSQL profile needs it.
5. Checks that Windows interop works and that Windows `npx.cmd` exists
   (installing Windows Node.js LTS with `winget` if not).
6. Installs the MCP launchers into `~/.local/bin` and their config into
   `~/.config/powerbi-ai/`.
7. Registers Microsoft's `fabric-collection` marketplace (updating it to the
   upstream HEAD when it is already registered) and this checkout as the local
   `powerbi-ai-setup` marketplace with both agents, removing a registration
   under the old `powerbi-ai-blueprint` name or one pointing at a moved checkout.
8. Installs or updates both plugins to the marketplaces' current versions:
   Claude at project scope for `--workspace` (every `claude plugin` call runs
   inside the workspace, because Claude resolves the project from the working
   directory), Codex globally.
9. Runs `scripts/configure.mjs` to write the workspace configs and the Claude
   credential guard (see [Security](#security)). It disables the plugin's
   duplicate modeling server, marks the workspace as trusted for Codex (see
   below), backs up every file it changes under
   `~/.local/state/powerbi-ai-setup/backups/`, and never overwrites an existing
   `AGENTS.md` or `CLAUDE.md`.
10. Starts every configured MCP server once through its launcher. That installs
    the latest server package now, rather than inside an agent's MCP startup
    timeout, and reports a server that cannot start. A failure here is a
    warning, since a database may simply be unreachable at the moment.

Every step is idempotent: rerunning changes nothing that is already right.

### Codex folder trust

Codex applies a workspace's `.codex/config.toml` only in a folder you have
trusted. That file carries the Windows `powerbi-modeling` server, the database
MCPs, and the switch that turns off the plugin's own WSL-side modeling server.
Untrusted, Codex silently runs only that plugin server, which cannot see Power
BI Desktop. So setup records the same entry Codex's first-run prompt would, in
`~/.codex/config.toml`:

```toml
[projects."/home/<you>/powerbi"]
trust_level = "trusted"
```

Trust also covers every folder below the workspace, so a `.codex/config.toml`
inside one of your project repositories there would be applied as well. Use
`--no-codex-trust` to decide in Codex's own prompt instead. Either way,
`doctor.sh` asks Codex (`codex mcp list`) what it really loads in the workspace
and fails if the workspace servers are missing or the plugin's duplicate is on.

### What stays at "latest"

Everything this repository does not maintain itself follows its upstream
latest release, and every rerun of `setup.sh` brings it up to date:

| Component | How it tracks latest |
|---|---|
| Codex and Claude Code CLIs | installed or updated on every run |
| `powerbi-report-author`, `powerbi-desktop` | `npm install -g …@latest` on every run |
| `powerbi-authoring` plugin and its skills | marketplace refreshed to upstream HEAD, plugin updated in both agents |
| Power BI modeling MCP, MCP Toolbox | launcher runs `npx …@latest` on each start; setup's warm-up installs it |
| `postgres-mcp` | launcher runs `uvx --upgrade-package postgres-mcp` on each start |
| `uv` | reinstalled from the latest release when behind |

Only the `powerbi-engineering` plugin (this repository) is versioned by hand,
and Node.js is installed once and left alone while it satisfies the minimum.
To hold an upstream component back temporarily, replace `latest` with a version
in `versions.env`.

| Option | Effect |
|---|---|
| `--workspace PATH` | Required. Workspace to configure; created if missing. |
| `--env-file FILE` | Database profiles (see below). Defaults to the installed `~/.config/powerbi-ai/connections.env` on reruns. |
| `--claude-scope SCOPE` | `project` (default), `local` or `user` for the Claude plugins. |
| `--bin-dir PATH` | Launcher directory (default `~/.local/bin`). |
| `--dry-run` | Print what would change. |
| `--skip-agent-clis` | Do not install or update the Codex or Claude CLIs. |
| `--skip-npm-packages` | Do not install or update the Power BI CLIs. |
| `--skip-mcp-warmup` | Do not start each MCP server once after configuring (for offline runs). |
| `--no-codex-trust` | Do not mark the workspace as trusted for Codex; accept Codex's trust prompt yourself instead. |
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

- **Toolchain.** Rerun `setup.sh --workspace ~/powerbi`; it updates everything
  in the table above. To isolate an upstream regression, temporarily replace
  `latest` in `versions.env` with an exact version.
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
| Claude says `Blocked by powerbi-secret-guard` | Working as intended: the command named the credentials or an environment dump. Test connections with `doctor.sh --live`, search code with Claude's Grep tool, and open the profile file yourself if you need to edit it. |
| Codex has no `powerbi-modeling` or database MCPs, only the plugin's `powerbi-modeling-mcp` (which cannot see Desktop); doctor reports "Codex in … not loaded" | The workspace is not trusted for Codex, so Codex ignores `.codex/config.toml`. Rerun `setup.sh` without `--no-codex-trust`, or answer yes when `codex` asks to trust the folder. |
| Claude plugins read "not enabled" | Run `claude` and `doctor.sh` from, or with, the same `--workspace` that setup used. |

## Repository layout

```text
setup.sh, doctor.sh        installer and read-only checker
versions.env               upstream version channels (installed to ~/.config/powerbi-ai)
bin/                       MCP launchers, the env-file reader and powerbi-secret-guard
                           (installed to ~/.local/bin)
config/                    database profile example and the SQL Server Toolbox config
scripts/configure.mjs      writes the workspace and agent configs
scripts/mcp-probe.mjs      MCP initialize handshake (setup warm-up, doctor --live)
scripts/mcp-servers.mjs    lists the managed MCP servers in a workspace .mcp.json
scripts/secret-audit.mjs   credential-literal scanner used by doctor
templates/                 AGENTS.md and CLAUDE.md for new workspaces
plugins/powerbi-engineering/   the vendored Claude/Codex plugin
.claude-plugin/, .agents/plugins/   marketplace manifests for Claude and Codex
```

## Security

### Where the database credentials go

Setup never sends a credential anywhere. It keeps one copy in
`~/.config/powerbi-ai/connections.env` (mode 600), and each launcher reads its
own profile at start-up and hands it to the local MCP server through that
process's environment, never through command-line arguments or an agent config.

Everything an agent reads, though, becomes conversation content sent to its
model provider (Anthropic for Claude, OpenAI for Codex). The credentials would
leak that way only if an agent read the profile file, ran a command that printed
it, or read an MCP server's environment. So setup installs a guard in Claude's
**user** settings (`~/.claude/settings.json`, covering Claude started in any
folder):

| Layer | Covers | Mechanism |
|---|---|---|
| `permissions.deny` | Claude's file tools (Read, Grep, Glob, Edit) | `Read`/`Edit(~/.config/powerbi-ai/**)`, `Read(~/**/*connections.env)`, `Read(//proc/*/environ)` |
| `powerbi-secret-guard` | Claude's Bash tool | `PreToolUse` hook that refuses commands naming the credential directory or a `connections.env` file, `powerbi-env get`/`psql-url`, `/proc/*/environ`, `ps e`, or a bare `env`/`printenv`/`export -p` |
| `AGENTS.md` / `CLAUDE.md` | both agents | an explicit rule never to read or print credentials, and to use `doctor.sh --live` to test connections |

Deny rules reach shell commands only when Claude's Bash sandbox is enabled
(it needs `bubblewrap` and `socat`, and confines every command's network and
writes), which is why Bash has its own hook. The hook matches command text, so
it stops accidental and routine reads but not a command that builds the path
indirectly; it also refuses harmless commands that merely mention these names,
so search code for them with Claude's Grep tool instead of `grep`. Codex has no
equivalent per-file control, so for Codex the `AGENTS.md` rule is the only
layer. `doctor.sh` checks that the guard is installed and refuses a sample
credential read.

What no configuration here can prevent:

- **Query results.** Rows returned by a database MCP are sent to the provider.
- **The network path.** `MSSQL_<NAME>_ENCRYPT='disable'` sends the SQL Server
  password merely obfuscated, and a PostgreSQL URL without `sslmode` may connect
  without TLS. Prefer `true`/`strict` and `sslmode=verify-full` wherever the
  servers support TLS.
- **The MCP packages.** MCP Toolbox and `postgres-mcp` hold the credentials in
  memory and follow their latest releases.

Least-privilege, read-only database logins therefore remain the real boundary.

### Practices

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
