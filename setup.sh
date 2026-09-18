#!/usr/bin/env bash
set -Eeuo pipefail

blueprint_root=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck disable=SC1091
source "$blueprint_root/versions.env"

workspace=$(cd "$blueprint_root/.." && pwd)
claude_scope="project"
env_file=""
bin_dir="${POWERBI_AI_BIN_DIR:-$HOME/.local/bin}"
config_root="${XDG_CONFIG_HOME:-$HOME/.config}/powerbi-ai"
dry_run=0
skip_agent_clis=0
skip_plugins=0
skip_npm_packages=0
install_windows_node=1

usage() {
  cat <<'EOF'
Usage: ./setup.sh [options]

Options:
  --workspace PATH         Power BI workspace root to configure.
  --claude-scope SCOPE     project (default), local, or user.
  --env-file FILE          Optional database profile/credential .env file.
  --bin-dir PATH           Launcher install directory (default: ~/.local/bin).
  --dry-run                Show changes without writing or installing.
  --skip-agent-clis        Do not install missing Codex/Claude CLIs.
  --skip-plugins           Do not register marketplaces or install plugins.
  --skip-npm-packages      Do not install the Power BI report/Desktop CLIs.
  --no-windows-node-install
                           In WSL, only check for Windows npx; do not use winget.
  -h, --help               Show this help.
EOF
}

while (($#)); do
  case "$1" in
    --workspace) workspace=$2; shift 2 ;;
    --claude-scope) claude_scope=$2; shift 2 ;;
    --env-file) env_file=$2; shift 2 ;;
    --bin-dir) bin_dir=$2; shift 2 ;;
    --dry-run) dry_run=1; shift ;;
    --skip-agent-clis) skip_agent_clis=1; shift ;;
    --skip-plugins) skip_plugins=1; shift ;;
    --skip-npm-packages) skip_npm_packages=1; shift ;;
    --no-windows-node-install) install_windows_node=0; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
done

case "$claude_scope" in project|local|user) ;; *) echo "Invalid Claude scope" >&2; exit 2 ;; esac
workspace=$(realpath -m "$workspace")
bin_dir=$(realpath -m "$bin_dir")
if [[ -n "$env_file" ]]; then env_file=$(realpath "$env_file"); fi

run() {
  if ((dry_run)); then
    printf 'would run:'
    printf ' %q' "$@"
    printf '\n'
  else
    "$@"
  fi
}

# Claude resolves --scope project from the process working directory, not from
# --workspace. Every project-scoped claude call must therefore run inside the
# workspace or the plugin is registered against the wrong project and shows up
# as "not enabled" there.
run_claude() {
  if ((dry_run)); then
    printf 'would run (cwd %q):' "$workspace"
    printf ' %q' claude "$@"
    printf '\n'
  else
    (cd "$workspace" && claude "$@")
  fi
}

claude_list_json() {
  (cd "$workspace" 2>/dev/null && claude plugin list --json 2>/dev/null) || true
}

has() { command -v "$1" >/dev/null 2>&1; }

if ! has node || ! has npm || ! has npx; then
  echo "Node.js 20+ with npm/npx is required. Install an LTS release, then rerun." >&2
  exit 3
fi
node_major=$(node -p 'Number(process.versions.node.split(".")[0])')
if ((node_major < 20)); then
  echo "Node.js 20+ is required; found $(node --version)." >&2
  exit 3
fi
if ! has git; then
  echo "git is required to install plugin marketplaces." >&2
  exit 3
fi

if ((!skip_agent_clis)); then
  if ! has codex; then run npm install -g @openai/codex@latest; fi
  if ! has claude; then run npm install -g @anthropic-ai/claude-code@latest; fi
fi
if ((!dry_run)) && { ! has codex || ! has claude; }; then
  echo "Both codex and claude must be on PATH unless --skip-plugins is used." >&2
  if ((!skip_plugins)); then exit 3; fi
fi

if ((!skip_npm_packages)); then
  run npm install -g \
    "@microsoft/powerbi-report-authoring-cli@$POWERBI_REPORT_AUTHORING_CLI_VERSION" \
    "@microsoft/powerbi-desktop-bridge-cli@$POWERBI_DESKTOP_BRIDGE_CLI_VERSION"
fi

if [[ -n "$env_file" ]]; then
  node "$blueprint_root/bin/powerbi-env" validate "$env_file"
  psql_connections=$(node "$blueprint_root/bin/powerbi-env" count "$env_file" psql)
  if ((psql_connections > 0)) && ! has uvx && [[ ! -x "$HOME/.local/bin/uvx" ]]; then
    if has python3 && python3 -m pip --version >/dev/null 2>&1; then
      if [[ "$UV_VERSION" == "latest" ]]; then
        run python3 -m pip install --user --upgrade uv
      else
        run python3 -m pip install --user "uv==$UV_VERSION"
      fi
    else
      echo "PostgreSQL MCP profiles require uvx; install uv ($UV_VERSION channel) and rerun." >&2
      exit 3
    fi
  fi
fi

if ((!dry_run)) && [[ -r /proc/version ]] && grep -qi microsoft /proc/version && has powershell.exe; then
  if ! powershell.exe -NoProfile -NonInteractive -Command \
    'if (Get-Command npx.cmd -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }' \
    >/dev/null 2>&1; then
    if ((install_windows_node)) && has winget.exe; then
      run winget.exe install --id OpenJS.NodeJS.LTS --exact \
        --accept-package-agreements --accept-source-agreements
      echo "Windows Node was installed; restart the shell if npx.cmd is not immediately visible."
    else
      echo "Windows npx.cmd is required for Desktop-visible modeling from WSL." >&2
      echo "Install Node.js LTS on Windows, then rerun." >&2
      exit 3
    fi
  fi
fi

run mkdir -p "$workspace" "$bin_dir" "$config_root"
for launcher in powerbi-env powerbi-modeling-mcp powerbi-psql-mcp powerbi-mssql-mcp; do
  run install -m 0755 "$blueprint_root/bin/$launcher" "$bin_dir/$launcher"
done
run install -m 0644 "$blueprint_root/bin/powerbi-env-lib.mjs" "$bin_dir/powerbi-env-lib.mjs"
run install -m 0600 "$blueprint_root/config/mssql.tools.yaml" "$config_root/mssql.tools.yaml"
run install -m 0600 "$blueprint_root/config/connections.env.example" "$config_root/connections.env.example"
run install -m 0644 "$blueprint_root/versions.env" "$config_root/versions.env"
if [[ -n "$env_file" ]]; then
  installed_env="$config_root/connections.env"
  if [[ "$env_file" == "$installed_env" ]]; then
    run chmod 0600 "$installed_env"
  else
    run install -m 0600 "$env_file" "$installed_env"
  fi
fi

codex_plugin_installed() {
  local plugin_id=$1
  codex plugin list --json 2>/dev/null | node -e '
    let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{
      const x=JSON.parse(s); process.exit(x.installed?.some(p=>p.pluginId===process.argv[1])?0:1)
    })' "$plugin_id"
}

codex_engineering_collision() {
  codex plugin list --json 2>/dev/null | node -e '
    let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{
      const x=JSON.parse(s); process.exit(x.installed?.some(p=>p.name==="powerbi-engineering" && p.pluginId!==process.argv[1])?0:1)
    })' "powerbi-engineering@powerbi-ai-blueprint"
}

claude_plugin_record() {
  local plugin_id=$1
  claude_list_json | node -e '
    let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{
      const [id, workspace] = process.argv.slice(1);
      const rows = JSON.parse(s || "[]").filter(p=>p.id===id);
      // A project-scoped install only applies to the project it was recorded
      // against; anything else must be installed again for this workspace.
      const row = rows.find(p=>(p.scope||"user")!=="project" || p.projectPath===workspace);
      if(!row) process.exit(1); process.stdout.write(row.scope || "user")
    })' "$plugin_id" "$workspace"
}

if ((!skip_plugins)); then
  codex_marketplaces=$(codex plugin marketplace list 2>/dev/null || true)
  if ! grep -q '^fabric-collection[[:space:]]' <<<"$codex_marketplaces"; then
    run codex plugin marketplace add microsoft/skills-for-fabric
  else
    run codex plugin marketplace upgrade fabric-collection
  fi
  if ! grep -q '^powerbi-ai-blueprint[[:space:]]' <<<"$codex_marketplaces"; then
    run codex plugin marketplace add "$blueprint_root"
  fi

  if ! codex_plugin_installed powerbi-authoring@fabric-collection; then
    run codex plugin add powerbi-authoring@fabric-collection
  fi
  if codex_engineering_collision; then
    echo "A different Codex powerbi-engineering plugin is already installed." >&2
    echo "Remove or disable it before installing powerbi-engineering@powerbi-ai-blueprint." >&2
    exit 5
  fi
  if ! codex_plugin_installed powerbi-engineering@powerbi-ai-blueprint; then
    run codex plugin add powerbi-engineering@powerbi-ai-blueprint
  fi

  claude_marketplaces=$( (cd "$workspace" && claude plugin marketplace list 2>/dev/null) || true)
  if ! grep -q 'fabric-collection' <<<"$claude_marketplaces"; then
    run_claude plugin marketplace add microsoft/skills-for-fabric --scope user
  else
    run_claude plugin marketplace update fabric-collection
  fi
  if ! grep -q 'powerbi-ai-blueprint' <<<"$claude_marketplaces"; then
    run_claude plugin marketplace add "$blueprint_root" --scope user
  fi

  if installed_scope=$(claude_plugin_record powerbi-authoring@fabric-collection); then
    run_claude plugin update powerbi-authoring@fabric-collection --scope "$installed_scope" --yes
    if [[ "$installed_scope" != "$claude_scope" ]]; then
      echo "note: Claude powerbi-authoring remains $installed_scope-scoped (requested: $claude_scope)."
    fi
  else
    run_claude plugin install powerbi-authoring@fabric-collection --scope "$claude_scope" --yes
  fi

  if claude_list_json | node -e '
      let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{
        const rows=JSON.parse(s || "[]"); process.exit(rows.some(p=>p.id.startsWith("powerbi-engineering@") && p.id!==process.argv[1])?0:1)
      })' powerbi-engineering@powerbi-ai-blueprint; then
    echo "A different Claude powerbi-engineering plugin is already installed." >&2
    echo "Uninstall it before installing powerbi-engineering@powerbi-ai-blueprint." >&2
    exit 5
  fi
  if installed_scope=$(claude_plugin_record powerbi-engineering@powerbi-ai-blueprint); then
    echo "note: kept personal Claude powerbi-engineering plugin unchanged ($installed_scope scope)."
  else
    run_claude plugin install powerbi-engineering@powerbi-ai-blueprint --scope "$claude_scope" --yes
  fi
fi

configure_args=(
  "$blueprint_root/scripts/configure.mjs"
  --workspace "$workspace"
  --blueprint "$blueprint_root"
  --bin-dir "$bin_dir"
)
if [[ -n "$env_file" ]]; then configure_args+=(--env-file "$env_file"); fi
if ((dry_run)); then configure_args+=(--dry-run); fi
node "${configure_args[@]}"

echo
echo "Power BI AI setup complete for: $workspace"
echo "Next: run $blueprint_root/doctor.sh --workspace $workspace"
echo "Claude will ask once to trust the workspace and approve project MCP servers."
echo "Power BI Desktop must be installed on Windows with its external-tool bridge enabled."
