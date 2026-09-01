# Live Connection and Refresh Discipline

How to obtain live model evidence (DAX results, model stats, traces, bounded
refresh tests) from this WSL environment, and how to time refresh tests so
they never become open-ended waits. Read this before any workflow step that
claims live evidence.

## The modeling MCP server must run as a Windows process

Power BI Desktop runs on Windows. A Linux/WSL-side modeling MCP server —
including a Linux `npx @microsoft/powerbi-modeling-mcp` — cannot enumerate or
connect to local Desktop instances: `ListLocalInstances` returns 0 even though
the server itself responds, and no ADOMD/XMLA connection to a local Desktop
port is reachable from WSL's network namespace at all. This skill always uses
the Windows-side executable.

### The one server to use

| Host | Server name | Tool prefix |
| --- | --- | --- |
| Claude Code | `powerbi-modeling` (user scope) | `mcp__powerbi-modeling__*` |
| Codex | `powerbi-modeling` (`~/.codex/config.toml`) | `powerbi-modeling.*` |

Both hosts launch the identical wrapper, `/home/ziggo/.local/bin/powerbi-modeling-mcp-windows`:

```bash
# Windows .NET applications can hang when started with a WSL/UNC working directory.
cd /mnt/c
exec /mnt/c/MCPServers/PowerBIModelingMCP/powerbi-modeling-mcp.exe --start --readwrite
```

Registered in Claude Code at **user scope**, so it is available in every
directory, not only one project:

```bash
claude mcp add -s user powerbi-modeling /home/ziggo/.local/bin/powerbi-modeling-mcp-windows
```

### Never use any other modeling server

Do not call a modeling tool under any other prefix, even when one is present
in the session and its `Help` output looks richer. In particular, the
`powerbi-authoring` plugin may register
`mcp__plugin_powerbi-authoring_powerbi-modeling-mcp__*`, which runs as a
**WSL/Linux process** and is blind to local Desktop. If any prefix other than
`mcp__powerbi-modeling__*` is the only modeling server available, stop and
report that the Windows-side server is missing rather than falling back to it.

The one legitimate exception is a **published** Fabric/Power BI Service
dataset, where the work is a pure REST call and WSL execution is fine — see
the refresh-API section below.

### Preflight before any live step

1. Confirm the tool prefix `mcp__powerbi-modeling__*` (Codex:
   `powerbi-modeling.*`) actually exists in the session's tool registry. A
   server can be registered and report healthy while its tools are absent from
   the session — `claude mcp list` shows ✔ Connected but the tools are
   uncallable. The fix is to restart the session; do not substitute another
   server.
2. Call `connection_operations.ListLocalInstances`. It must return the open
   `PBIDesktop.exe` instance. If it returns 0 while Desktop has the file open,
   suspect a Linux-side server registration before anything else, and verify
   with `claude mcp get powerbi-modeling` that the command is the wrapper
   above.
3. Only then `Connect` and proceed.

## Connection modes

- **Offline** — `connection_operations.ConnectFolder` on a `.SemanticModel`
  directory edits/reads TMDL on disk. No data: refresh and DAX queries fail
  with "disconnected object is read only". Sufficient for structural static
  checks only.
- **Live** — `ListLocalInstances` to find the local Analysis Services port of
  a running Desktop instance, then `Connect`. Required for DAX result checks,
  `model_operations.GetStats`, traces, and refresh tests.

The server is a Windows process, so every path passed to it must be a Windows
path. Convert with `wslpath -w <linux-path>` →
`\\wsl.localhost\<distro>\...`. Never pass a Linux path.

To open a project in Desktop from WSL:

```bash
powershell.exe -Command "Start-Process -FilePath '<windows-unc-path-to-.pbip>'"
```

Then poll `powershell.exe -Command "Get-Process -Name PBIDesktop ..."` for the
window title to confirm the right file finished loading before connecting.

## Refresh tests are timed, bounded, and scoped — always

A refresh triggered for validation must never become an open-ended blocking
wait. Large or slow tables can time out the tool call or Desktop itself.

1. **Check existing signal first.** `table_operations.Get`/`GetSchema`,
   `model_operations.GetStats`, and any project doc
   (`<project>/docs/*refresh*.md`) may already record row counts, sizes, or a
   recent duration. Never re-measure what is already documented.
2. **Scope to the smallest reproducer.** Refresh a single partition via
   `partition_operations.Refresh`, not the table or model, unless whole-model
   behavior is specifically under test.
3. **State the time budget before starting, then enforce it.** Suggested
   budgets: 3–5 minutes for a spot check confirming a claim; up to 10 minutes
   for a before/after validation where the refresh test is the point. Local
   Desktop refresh is blocking, so the budget bounds the tool call itself —
   set the call timeout to the budget. If it expires, report the test as
   inconclusive; do not retry with a longer wait by default.
4. **Wrap the refresh window with traces.** `trace_operations.Start` before
   kicking off, `Fetch`/`Stop` after (or after a timeout). A timed-out refresh
   then still yields rows processed and the slow stage instead of nothing.
5. **Record the measured duration** in the remediation log or a project doc so
   the next audit can skip the measurement (rule 1).
6. **Never start a blocking full refresh of a table already suspected of being
   large or slow without asking the user first** — offer static analysis as
   the alternative.

### Local Desktop vs published dataset — different refresh APIs

- **Locally-open `.pbip`/Desktop model**: only blocking
  `table_operations.Refresh` / `partition_operations.Refresh` work. The
  `RefreshWithAPI` family cannot target a local Desktop session at all.
- **Published Fabric/Power BI Service dataset**: use
  `connection_operations.ConnectFabric` (workspace + semantic model name),
  then `table_operations.RefreshWithAPI` → poll
  `CheckStatusOfRefreshWithAPI` on an interval → `CancelRefreshWithAPI` the
  moment the budget is exceeded. This is the Enhanced Refresh REST API and
  needs a workspace/dataset, never a local file.

## Known gotchas

- `Refresh`/`Update` operations can silently no-op — verify the effect
  (row counts, definition read-back) instead of trusting a success result.
- Desktop **Save** can clobber model edits made through the MCP server with no
  error. After MCP edits, close Desktop without saving and reopen before
  trusting Save again.
- Offline `ConnectFolder` edits and a concurrently open Desktop instance on
  the same files conflict; pick one at a time.
- `dax_query_operations.Execute` caps results at 100 rows regardless of
  `maxRows`. Aggregate server-side in DAX, or add `ORDER BY <size> DESC` to
  DMV queries so the top-N that matter are the ones returned. The full result
  arrives as an MCP `resource` pointing at a Windows temp CSV
  (`%LOCALAPPDATA%\Temp\PowerBIModelingMCP\QueryResults\*.csv`), readable from
  WSL under `/mnt/c/...`; the inline text is only a preview.
- `getExecutionMetrics: true` **replaces** the row data with metrics. Run
  timing and data as two separate calls.
