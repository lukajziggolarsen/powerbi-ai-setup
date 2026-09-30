#!/usr/bin/env bash
set -Eeuo pipefail

setup_root=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck disable=SC1091
source "$setup_root/versions.env"

workspace=$(cd "$setup_root/.." && pwd)
live=0
env_file=""
failures=0
warnings=0

usage() {
  cat <<'EOF'
Usage: ./doctor.sh [--workspace PATH] [--env-file FILE] [--live]

Checks the Power BI AI toolchain without changing configuration. --live also
asks the Desktop bridge for status; Power BI Desktop must already be open.
EOF
}

while (($#)); do
  case "$1" in
    --workspace) workspace=$2; shift 2 ;;
    --env-file) env_file=$2; shift 2 ;;
    --live) live=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
done

workspace=$(realpath -m "$workspace")
# setup.sh installs Node.js, the agent CLIs and the launchers into ~/.local/bin;
# check that toolchain even from a shell opened before the directory existed.
bin_dir="${POWERBI_AI_BIN_DIR:-$HOME/.local/bin}"
case ":$PATH:" in *":$bin_dir:"*) bin_dir_on_path=1 ;; *) bin_dir_on_path=0 ;; esac
export PATH="$bin_dir:$HOME/.local/bin:$PATH"
pass() { printf 'PASS  %s\n' "$*"; }
warn() { printf 'WARN  %s\n' "$*"; warnings=$((warnings + 1)); }
fail() { printf 'FAIL  %s\n' "$*"; failures=$((failures + 1)); }
# WSL appends Windows' PATH, so a Windows npm/npx/claude shim under /mnt/ must
# not count as the Linux tool; names ending in .exe are Windows tools by design.
has() {
  local found
  found=$(command -v "$1" 2>/dev/null) || return 1
  [[ "$1" == *.exe || "$found" != /mnt/* ]]
}

check_command() {
  local command_name=$1
  if has "$command_name"; then
    pass "$command_name: $(command -v "$command_name")"
  else
    fail "$command_name is missing"
  fi
}

check_version() {
  local command_name=$1 expected=$2 actual
  if ! has "$command_name"; then fail "$command_name is missing (expected $expected)"; return; fi
  actual=$("$command_name" --version 2>/dev/null | head -n 1 | tr -d '\r' || true)
  if [[ "$expected" == "latest" ]]; then
    pass "$command_name version $actual (latest channel selected by setup)"
  elif [[ "$actual" == "$expected" || "$actual" == *"$expected"* ]]; then
    pass "$command_name version $actual"
  else
    warn "$command_name version $actual; versions.env requests $expected"
  fi
}

echo "Power BI AI doctor"
echo "workspace: $workspace"
if ((!bin_dir_on_path)); then
  warn "$bin_dir is not on this shell's PATH; open a new terminal or add it to your profile"
fi
check_command git
check_command npm
check_command npx
check_command codex
check_command claude

if has node; then
  node_major=$(node -p 'Number(process.versions.node.split(".")[0])')
  if ((node_major >= 22)); then pass "Node.js $(node --version)"; else fail "Node.js 22+ required (Claude Code); found $(node --version); rerun setup.sh"; fi
else
  fail "node is missing"
fi

check_version powerbi-report-author "$POWERBI_REPORT_AUTHORING_CLI_VERSION"
check_version powerbi-desktop "$POWERBI_DESKTOP_BRIDGE_CLI_VERSION"

if [[ -r /proc/version ]] && grep -qi microsoft /proc/version; then
  pass "WSL detected"
  if has powershell.exe && ! powershell.exe -NoProfile -NonInteractive -Command 'exit 0' >/dev/null 2>&1; then
    fail "Windows interop is broken (WSLInterop binfmt entry missing); from Windows run: wsl -u root -e sh -c 'echo :WSLInterop:M::MZ::/init:PF > /proc/sys/fs/binfmt_misc/register'"
  elif has powershell.exe && powershell.exe -NoProfile -NonInteractive -Command \
      '$env:Path=[Environment]::GetEnvironmentVariable("Path","Machine")+";"+[Environment]::GetEnvironmentVariable("Path","User"); if (Get-Command npx.cmd -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }' \
      >/dev/null 2>&1; then
    pass "Windows npx.cmd is available for Desktop-visible modeling"
  else
    fail "Windows npx.cmd is unavailable; install Windows Node.js LTS"
  fi
else
  warn "not running in WSL; the Desktop path was validated on WSL 2 + Windows"
fi

for launcher in powerbi-env powerbi-modeling-mcp powerbi-psql-mcp powerbi-mssql-mcp; do
  if has "$launcher"; then pass "$launcher launcher installed"; else warn "$launcher launcher is not on PATH"; fi
done

marketplace="powerbi-ai-setup"
engineering_id="powerbi-engineering@$marketplace"
engineering_version=$(node -p 'require(process.argv[1]).version' \
  "$setup_root/plugins/powerbi-engineering/.claude-plugin/plugin.json" 2>/dev/null || true)

if has codex; then
  # Codex refuses to list any plugin while one registered marketplace root is
  # missing, e.g. after this checkout was moved or renamed.
  codex_root=$(codex plugin marketplace list 2>/dev/null | awk -v n="$marketplace" '$1==n{print $2}' || true)
  if [[ "$codex_root" == "$setup_root" ]]; then
    pass "Codex marketplace $marketplace -> $setup_root"
  elif [[ -n "$codex_root" ]]; then
    fail "Codex marketplace $marketplace points at $codex_root, not $setup_root; rerun setup.sh"
  else
    fail "Codex marketplace $marketplace is not loadable; run 'codex plugin marketplace list', then rerun setup.sh"
  fi
  if codex_json=$(codex plugin list --json 2>/dev/null); then
    if node -e 'const x=JSON.parse(process.argv[1]);process.exit(x.installed?.some(p=>p.pluginId==="powerbi-authoring@fabric-collection"&&p.enabled)?0:1)' "$codex_json" 2>/dev/null; then
      pass "Codex powerbi-authoring plugin enabled"
    else
      fail "Codex powerbi-authoring plugin is not enabled"
    fi
    codex_engineering=$(node -e 'const x=JSON.parse(process.argv[1]);const p=x.installed?.find(p=>p.pluginId===process.argv[2]&&p.enabled);if(!p)process.exit(1);process.stdout.write(p.version||"")' "$codex_json" "$engineering_id" 2>/dev/null) || codex_engineering="-"
    if [[ "$codex_engineering" == "-" ]]; then
      warn "Codex $engineering_id plugin is not enabled"
    elif [[ "$codex_engineering" != "$engineering_version" ]]; then
      warn "Codex $engineering_id is $codex_engineering; checkout is $engineering_version (rerun setup.sh)"
    else
      pass "Codex $engineering_id $codex_engineering enabled"
    fi
  else
    fail "Codex cannot list its plugins; run 'codex plugin list' for the error"
  fi
fi

# Prints the installed version of an enabled, loadable Claude plugin, or the
# reason it is unusable (non-zero exit). A plugin whose marketplace failed to
# load is still reported as enabled, with the cause in "errors".
claude_plugin_state() {
  node -e '
    const [json, id, workspace] = process.argv.slice(1);
    // Project-scoped records for other directories do not apply here.
    const rows = JSON.parse(json || "[]").filter((p) => p.id === id && p.enabled &&
      (p.scope !== "project" || p.projectPath === workspace));
    const row = rows.find((p) => !(p.errors || []).length) || rows[0];
    if (!row) { process.stdout.write("not enabled"); process.exit(1); }
    if ((row.errors || []).length) { process.stdout.write(`failed to load: ${row.errors[0]}`); process.exit(1); }
    process.stdout.write(row.version || "");' "$claude_json" "$1" "$workspace" 2>/dev/null
}

if has claude; then
  claude_root=$(claude plugin marketplace list --json 2>/dev/null | node -e '
    let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{
      const m=JSON.parse(s || "[]").find(x=>x.name===process.argv[1]); if(m) process.stdout.write(m.path || "")
    })' "$marketplace" 2>/dev/null || true)
  if [[ "$claude_root" == "$setup_root" ]]; then
    pass "Claude marketplace $marketplace -> $setup_root"
  elif [[ -n "$claude_root" ]]; then
    fail "Claude marketplace $marketplace points at $claude_root, not $setup_root; rerun setup.sh"
  else
    fail "Claude marketplace $marketplace is not registered; rerun setup.sh"
  fi
  # Claude resolves project-scoped plugin state from the working directory, so
  # the check has to run inside the workspace rather than wherever doctor.sh
  # happens to be invoked from.
  claude_json=$( (cd "$workspace" 2>/dev/null && claude plugin list --json 2>/dev/null) || true)
  if state=$(claude_plugin_state powerbi-authoring@fabric-collection); then
    pass "Claude powerbi-authoring plugin $state enabled"
  else
    fail "Claude powerbi-authoring plugin for $workspace: $state"
  fi
  if ! state=$(claude_plugin_state "$engineering_id"); then
    if [[ "$state" == "not enabled" ]]; then warn "Claude $engineering_id is not enabled for $workspace"
    else fail "Claude $engineering_id for $workspace: $state"; fi
  elif [[ "$state" != "$engineering_version" ]]; then
    warn "Claude $engineering_id is $state; checkout is $engineering_version (rerun setup.sh)"
  else
    pass "Claude $engineering_id $state enabled"
  fi
fi

codex_config="$workspace/.codex/config.toml"
claude_mcp="$workspace/.mcp.json"
claude_settings="$workspace/.claude/settings.json"
for file in "$codex_config" "$claude_mcp" "$claude_settings"; do
  relative=${file#"$workspace"/}
  if [[ -r "$file" ]]; then pass "project config exists: $relative"; else fail "missing project config: $relative"; fi
done

if [[ -r "$codex_config" ]]; then
  if grep -Fq '[mcp_servers.powerbi-modeling]' "$codex_config" &&
     grep -Fq '[plugins."powerbi-authoring@fabric-collection".mcp_servers.powerbi-modeling-mcp]' "$codex_config"; then
    pass "Codex routes modeling through one standalone server"
  else
    warn "Codex single-modeling-server policy is not evident"
  fi
fi
if [[ -r "$claude_mcp" ]] && grep -Fq '"powerbi-modeling"' "$claude_mcp"; then
  pass "Claude project modeling server configured"
fi

# The credential guard: deny rules for Claude's file tools plus the Bash hook,
# in user settings. The self-test feeds the hook a command that reads the
# profile file (nothing is executed) and expects a refusal.
user_settings="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/settings.json"
if [[ -r "$user_settings" ]] && node -e '
    const s = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
    const deny = s.permissions?.deny || [];
    const hooked = (s.hooks?.PreToolUse || []).some((e) => (e.hooks || []).some((h) => String(h.command || "").includes("powerbi-secret-guard")));
    process.exit(deny.includes("Read(~/.config/powerbi-ai/**)") && hooked ? 0 : 1)' "$user_settings" 2>/dev/null; then
  if has powerbi-secret-guard && printf '%s' '{"tool_name":"Bash","tool_input":{"command":"cat ~/.config/powerbi-ai/connections.env"}}' |
      powerbi-secret-guard | grep -q '"deny"'; then
    pass "Claude credential guard active (file-tool deny rules and Bash hook)"
  else
    fail "Claude credential guard is configured but powerbi-secret-guard does not refuse credential reads; rerun setup.sh"
  fi
else
  fail "Claude credential guard is missing from $user_settings; rerun setup.sh"
fi

secret_files=("$codex_config" "$claude_mcp" "$claude_settings" "$workspace/.claude/settings.local.json")
if node "$setup_root/scripts/secret-audit.mjs" "${secret_files[@]}" >/dev/null; then
  pass "no credential-like literals in agent project configs"
else
  fail "credential-like literals found; run scripts/secret-audit.mjs for file and line numbers"
fi

database_mcp_configured=0
if { [[ -r "$codex_config" ]] && grep -Eq 'powerbi-(psql|mssql)-mcp' "$codex_config"; } ||
   { [[ -r "$claude_mcp" ]] && grep -Eq 'powerbi-(psql|mssql)-mcp' "$claude_mcp"; }; then
  database_mcp_configured=1
fi
if [[ -n "$env_file" || $database_mcp_configured -eq 1 ]]; then
  if [[ -z "$env_file" ]]; then env_file="${XDG_CONFIG_HOME:-$HOME/.config}/powerbi-ai/connections.env"; fi
  if [[ ! -r "$env_file" ]]; then
    fail "database MCP profiles selected but environment file is unreadable: $env_file"
  elif ! node "$setup_root/bin/powerbi-env" validate "$env_file" >/dev/null; then
    fail "database environment file is invalid"
  elif [[ $(stat -c '%a' "$env_file") == "600" ]]; then
    pass "database environment file is valid and has mode 600"
  else
    warn "database environment file is valid but should have mode 600"
  fi
else
  pass "database MCPs omitted by default"
fi

if ((live)); then
  if has powerbi-desktop && powerbi-desktop status --wait-seconds 5 >/dev/null 2>&1; then
    pass "Power BI Desktop bridge responded"
  else
    warn "Power BI Desktop bridge did not respond; open Desktop and enable the bridge preview"
  fi

  if [[ -r "$claude_mcp" ]]; then
    while IFS=$'\t' read -r server launcher profile; do
      [[ -n "$server" ]] || continue
      # The first Windows-side npx run downloads the modeling server.
      timeout_ms=30000
      if [[ "$launcher" == *powerbi-modeling-mcp ]]; then timeout_ms=180000; fi
      if probe_error=$(POWERBI_AI_MCP_PROBE_TIMEOUT_MS=$timeout_ms \
          node "$setup_root/scripts/mcp-probe.mjs" "$launcher" ${profile:+"$profile"} 2>&1 >/dev/null); then
        pass "MCP $server completed the initialize handshake"
      else
        fail "MCP $server did not start: ${probe_error:0:400}"
      fi
    done < <(node "$setup_root/scripts/mcp-servers.mjs" "$claude_mcp")
  fi
fi

printf '\nSummary: %d failure(s), %d warning(s)\n' "$failures" "$warnings"
((failures == 0))
