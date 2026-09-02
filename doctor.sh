#!/usr/bin/env bash
set -Eeuo pipefail

blueprint_root=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck disable=SC1091
source "$blueprint_root/versions.env"

workspace=$(cd "$blueprint_root/.." && pwd)
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
pass() { printf 'PASS  %s\n' "$*"; }
warn() { printf 'WARN  %s\n' "$*"; warnings=$((warnings + 1)); }
fail() { printf 'FAIL  %s\n' "$*"; failures=$((failures + 1)); }
has() { command -v "$1" >/dev/null 2>&1; }

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
  actual=$($command_name --version 2>/dev/null | head -n 1 | tr -d '\r')
  if [[ "$expected" == "latest" ]]; then
    pass "$command_name version $actual (latest channel selected by setup)"
  elif [[ "$actual" == "$expected" || "$actual" == *"$expected"* ]]; then
    pass "$command_name version $actual"
  else
    warn "$command_name version $actual; blueprint requests $expected"
  fi
}

echo "Power BI AI doctor"
echo "workspace: $workspace"
check_command git
check_command npm
check_command npx
check_command codex
check_command claude

if has node; then
  node_major=$(node -p 'Number(process.versions.node.split(".")[0])')
  if ((node_major >= 20)); then pass "Node.js $(node --version)"; else fail "Node.js 20+ required; found $(node --version)"; fi
else
  fail "node is missing"
fi

check_version powerbi-report-author "$POWERBI_REPORT_AUTHORING_CLI_VERSION"
check_version powerbi-desktop "$POWERBI_DESKTOP_BRIDGE_CLI_VERSION"

if [[ -r /proc/version ]] && grep -qi microsoft /proc/version; then
  pass "WSL detected"
  if has powershell.exe && powershell.exe -NoProfile -NonInteractive -Command \
      'if (Get-Command npx.cmd -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }' \
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

if has codex; then
  codex_json=$(codex plugin list --json 2>/dev/null || true)
  if node -e 'const x=JSON.parse(process.argv[1]);process.exit(x.installed?.some(p=>p.name==="powerbi-authoring"&&p.enabled)?0:1)' "$codex_json" 2>/dev/null; then
    pass "Codex powerbi-authoring plugin enabled"
  else
    fail "Codex powerbi-authoring plugin is not enabled"
  fi
  if node -e 'const x=JSON.parse(process.argv[1]);process.exit(x.installed?.some(p=>p.name==="powerbi-engineering"&&p.enabled)?0:1)' "$codex_json" 2>/dev/null; then
    pass "Codex powerbi-engineering plugin enabled"
  else
    warn "Codex powerbi-engineering plugin is not enabled"
  fi
fi

if has claude; then
  claude_json=$(claude plugin list --json 2>/dev/null || true)
  if node -e 'const x=JSON.parse(process.argv[1]);process.exit(x.some(p=>p.id.startsWith("powerbi-authoring@")&&p.enabled)?0:1)' "$claude_json" 2>/dev/null; then
    pass "Claude powerbi-authoring plugin enabled"
  else
    fail "Claude powerbi-authoring plugin is not enabled"
  fi
  if node -e 'const x=JSON.parse(process.argv[1]);process.exit(x.some(p=>p.id.startsWith("powerbi-engineering@")&&p.enabled)?0:1)' "$claude_json" 2>/dev/null; then
    pass "Claude powerbi-engineering plugin enabled"
  else
    warn "Claude powerbi-engineering plugin is not enabled"
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

secret_files=("$codex_config" "$claude_mcp" "$claude_settings" "$workspace/.claude/settings.local.json")
if node "$blueprint_root/scripts/secret-audit.mjs" "${secret_files[@]}" >/dev/null; then
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
  elif ! node "$blueprint_root/bin/powerbi-env" validate "$env_file" >/dev/null; then
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
fi

printf '\nSummary: %d failure(s), %d warning(s)\n' "$failures" "$warnings"
((failures == 0))
