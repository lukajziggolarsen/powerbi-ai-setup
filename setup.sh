#!/usr/bin/env bash
set -Eeuo pipefail
trap 'echo "setup.sh: failed at line $LINENO: $BASH_COMMAND" >&2' ERR

setup_root=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck disable=SC1091
source "$setup_root/versions.env"

workspace=""
# The marketplace name comes from .claude-plugin/marketplace.json and
# .agents/plugins/marketplace.json; keep all three in step.
marketplace="powerbi-ai-setup"
engineering_id="powerbi-engineering@$marketplace"
# This repository was called powerbi-ai-blueprint before the rename; setup
# removes that registration so the two cannot both claim powerbi-engineering.
legacy_marketplace="powerbi-ai-blueprint"
legacy_engineering_id="powerbi-engineering@$legacy_marketplace"
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
Usage: ./setup.sh --workspace PATH [options]

Options:
  --workspace PATH         Power BI workspace root to configure (required).
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

if [[ -z "$workspace" ]]; then
  echo "--workspace is required: the directory whose .mcp.json, .codex/ and" >&2
  echo ".claude/ configure the agents (it is created if missing)." >&2
  usage >&2
  exit 2
fi
case "$claude_scope" in project|local|user) ;; *) echo "Invalid Claude scope" >&2; exit 2 ;; esac
workspace=$(realpath -m "$workspace")
bin_dir=$(realpath -m "$bin_dir")
# configure.mjs rewrites every database MCP registration from the env file, so
# a plain rerun must reuse the installed profiles instead of dropping them.
if [[ -z "$env_file" && -r "$config_root/connections.env" ]]; then
  env_file="$config_root/connections.env"
  echo "using installed database profiles: $env_file"
fi
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

# WSL appends Windows' PATH, so a Windows npm/npx/claude shim under /mnt/ must
# not count as the Linux tool; names ending in .exe are Windows tools by design.
has() {
  local found
  found=$(command -v "$1" 2>/dev/null) || return 1
  [[ "$1" == *.exe || "$found" != /mnt/* ]]
}

# Tools this script bootstraps without sudo (Node.js, uv, npm globals, the
# launchers) land in ~/.local/bin. A fresh login shell only has that directory
# on PATH once it exists, so put it there for this run.
local_bin="$HOME/.local/bin"
case ":$PATH:" in *":$bin_dir:"*) path_had_bin_dir=1 ;; *) path_had_bin_dir=0 ;; esac
export PATH="$bin_dir:$local_bin:$PATH"

cpu=$(uname -m)
download() { curl -fsSL --retry 3 --connect-timeout 20 -o "$2" "$1"; }

for tool in curl tar sha256sum git; do
  if ! has "$tool"; then
    echo "$tool is required; install it first (sudo apt-get install -y $tool)." >&2
    exit 3
  fi
done

# Official nodejs.org build, checksum-verified, under ~/.local/share/powerbi-ai.
install_node() {
  local version=$NODE_VERSION arch index name dest tmp
  case "$cpu" in
    x86_64) arch=x64 ;;
    aarch64|arm64) arch=arm64 ;;
    *) echo "No Node.js bootstrap for CPU $cpu; install Node.js $node_min_major+ and rerun." >&2; exit 3 ;;
  esac
  if [[ "$version" == "lts" ]]; then
    # One release per line, newest first; download fully so pipefail holds.
    index=$(curl -fsSL --retry 3 https://nodejs.org/dist/index.json)
    version=$(grep -m1 '"lts":"' <<<"$index" | sed -E 's/^.*"version":"(v[0-9.]+)".*$/\1/')
  fi
  version="v${version#v}"
  name="node-$version-linux-$arch"
  dest="$HOME/.local/share/powerbi-ai/$name"
  if ((dry_run)); then echo "would install Node.js $version to $dest"; return; fi
  echo "installing Node.js $version to $dest"
  tmp=$(mktemp -d)
  download "https://nodejs.org/dist/$version/$name.tar.gz" "$tmp/$name.tar.gz"
  download "https://nodejs.org/dist/$version/SHASUMS256.txt" "$tmp/SHASUMS256.txt"
  (cd "$tmp" && grep " $name.tar.gz\$" SHASUMS256.txt | sha256sum -c --quiet -)
  mkdir -p "$(dirname "$dest")" "$local_bin"
  rm -rf "$dest"
  tar -xzf "$tmp/$name.tar.gz" -C "$(dirname "$dest")"
  rm -rf "$tmp"
  for tool in node npm npx; do ln -sfn "$dest/bin/$tool" "$local_bin/$tool"; done
  hash -r
}

# Official astral-sh/uv release, checksum-verified. pip is not an option on a
# fresh Ubuntu 24.04: it is not installed and PEP 668 blocks --user installs.
install_uv() {
  local target base tmp
  case "$cpu" in
    x86_64) target=x86_64-unknown-linux-gnu ;;
    aarch64|arm64) target=aarch64-unknown-linux-gnu ;;
    *) echo "No uv bootstrap for CPU $cpu; install uv and rerun." >&2; exit 3 ;;
  esac
  if [[ "$UV_VERSION" == "latest" ]]; then
    base="https://github.com/astral-sh/uv/releases/latest/download"
  else
    base="https://github.com/astral-sh/uv/releases/download/$UV_VERSION"
  fi
  if ((dry_run)); then echo "would install uv ($UV_VERSION) to $local_bin"; return; fi
  echo "installing uv ($UV_VERSION) to $local_bin"
  tmp=$(mktemp -d)
  download "$base/uv-$target.tar.gz" "$tmp/uv-$target.tar.gz"
  download "$base/uv-$target.tar.gz.sha256" "$tmp/uv-$target.tar.gz.sha256"
  (cd "$tmp" && sha256sum -c --quiet "uv-$target.tar.gz.sha256")
  tar -xzf "$tmp/uv-$target.tar.gz" -C "$tmp"
  mkdir -p "$local_bin"
  install -m 0755 "$tmp/uv-$target/uv" "$tmp/uv-$target/uvx" "$local_bin/"
  rm -rf "$tmp"
  hash -r
}

# Claude Code declares node >=22 (the Power BI CLIs need 20); npm installs it on
# older Node without complaint, so enforce the floor here.
node_min_major=22
node_ok() {
  has node && has npm && has npx &&
    node -e 'process.exit(Number(process.versions.node.split(".")[0])>=Number(process.argv[1])?0:1)' "$node_min_major"
}
if ! node_ok; then
  if has node; then echo "found Node.js $(node --version); $node_min_major+ is required."; fi
  install_node
  if ((dry_run)) && ! node_ok; then
    echo "The rest of the preview needs Node.js; rerun without --dry-run to install it."
    exit 0
  fi
  node_ok || { echo "Node.js bootstrap did not produce a usable node/npm/npx." >&2; exit 3; }
fi

# Global npm installs must not need sudo. A distro Node (prefix /usr) or the
# bootstrapped one (bin not on PATH) gets a per-user prefix of ~/.local.
npm_prefix=$(npm prefix -g)
if [[ ! -w "$npm_prefix" || "$npm_prefix" == "$HOME/.local/share/powerbi-ai/"* ]]; then
  run npm config set prefix "$HOME/.local" --location=user
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
  node "$setup_root/bin/powerbi-env" validate "$env_file"
  psql_connections=$(node "$setup_root/bin/powerbi-env" count "$env_file" psql)
  if ((psql_connections > 0)) && ! has uvx; then install_uv; fi
fi

# powershell.exe inherits the PATH Windows had when WSL started, so a Node.js
# installed since then is only visible after re-reading it from the registry.
windows_npx_available() {
  powershell.exe -NoProfile -NonInteractive -Command \
    '$env:Path=[Environment]::GetEnvironmentVariable("Path","Machine")+";"+[Environment]::GetEnvironmentVariable("Path","User"); if (Get-Command npx.cmd -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }' \
    >/dev/null 2>&1
}

if ((!dry_run)) && [[ -r /proc/version ]] && grep -qi microsoft /proc/version; then
  if ! has powershell.exe; then
    echo "powershell.exe is not reachable; enable WSL interop and appendWindowsPath" >&2
    echo "in /etc/wsl.conf, run 'wsl --shutdown' from Windows, then rerun." >&2
    exit 3
  fi
  # binfmt_misc is shared by every distro; starting another systemd distro can
  # clear the WSLInterop entry, and then every .exe fails with "MZ: not found".
  if ! powershell.exe -NoProfile -NonInteractive -Command 'exit 0' >/dev/null 2>&1; then
    echo "Windows interop is broken: powershell.exe cannot start." >&2
    echo "Re-register it from a Windows terminal, then rerun:" >&2
    echo "  wsl -u root -e sh -c 'echo :WSLInterop:M::MZ::/init:PF > /proc/sys/fs/binfmt_misc/register'" >&2
    exit 3
  fi
  if ! windows_npx_available; then
    if ((install_windows_node)) && has winget.exe; then
      echo "installing Node.js LTS on Windows with winget (accept the UAC prompt)"
      run winget.exe install --id OpenJS.NodeJS.LTS --exact --silent \
        --accept-package-agreements --accept-source-agreements
    fi
    if ! windows_npx_available; then
      echo "Windows npx.cmd is required for Desktop-visible modeling from WSL." >&2
      echo "Install Node.js LTS on Windows (https://nodejs.org), then rerun." >&2
      exit 3
    fi
  fi
fi

run mkdir -p "$workspace" "$bin_dir" "$config_root"
for launcher in powerbi-env powerbi-modeling-mcp powerbi-psql-mcp powerbi-mssql-mcp; do
  run install -m 0755 "$setup_root/bin/$launcher" "$bin_dir/$launcher"
done
run install -m 0644 "$setup_root/bin/powerbi-env-lib.mjs" "$bin_dir/powerbi-env-lib.mjs"
run install -m 0600 "$setup_root/config/mssql.tools.yaml" "$config_root/mssql.tools.yaml"
run install -m 0600 "$setup_root/config/connections.env.example" "$config_root/connections.env.example"
run install -m 0644 "$setup_root/versions.env" "$config_root/versions.env"
if [[ -n "$env_file" ]]; then
  installed_env="$config_root/connections.env"
  if [[ "$env_file" == "$installed_env" ]]; then
    run chmod 0600 "$installed_env"
  else
    run install -m 0600 "$env_file" "$installed_env"
  fi
fi

codex_config="${CODEX_HOME:-$HOME/.codex}/config.toml"
codex_config_has() { grep -Fqs "$1" "$codex_config"; }

codex_plugin_installed() {
  local plugin_id=$1
  codex plugin list --json 2>/dev/null | node -e '
    let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{
      const x=JSON.parse(s || "{}"); process.exit(x.installed?.some(p=>p.pluginId===process.argv[1])?0:1)
    })' "$plugin_id"
}

codex_engineering_collision() {
  codex plugin list --json 2>/dev/null | node -e '
    let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{
      const x=JSON.parse(s || "{}"), ours=process.argv.slice(1);
      process.exit(x.installed?.some(p=>p.name==="powerbi-engineering" && !ours.includes(p.pluginId))?0:1)
    })' "$engineering_id" "$legacy_engineering_id"
}

# Prints a Claude marketplace's registered directory (or repo), nothing if absent.
claude_marketplace_source() {
  (cd "$workspace" 2>/dev/null && claude plugin marketplace list --json 2>/dev/null) | node -e '
    let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{
      const m=JSON.parse(s || "[]").find(x=>x.name===process.argv[1]);
      if(m) process.stdout.write(m.path || m.repo || m.installLocation || "?")
    })' "$1" || true
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
  # A local marketplace whose directory has moved makes every codex plugin
  # command fail, so drop the pre-rename registration and re-add this one from
  # its current path before anything lists plugins.
  if codex_config_has "[marketplaces.$legacy_marketplace]"; then
    run codex plugin marketplace remove "$legacy_marketplace"
  fi
  if codex_config_has "[plugins.\"$legacy_engineering_id\"]"; then
    run codex plugin remove "$legacy_engineering_id"
  fi
  if codex_config_has "[marketplaces.$marketplace]"; then
    run codex plugin marketplace remove "$marketplace"
  fi
  run codex plugin marketplace add "$setup_root"

  if codex_config_has "[marketplaces.fabric-collection]"; then
    run codex plugin marketplace upgrade fabric-collection
  else
    run codex plugin marketplace add microsoft/skills-for-fabric
  fi

  if ! codex_plugin_installed powerbi-authoring@fabric-collection; then
    run codex plugin add powerbi-authoring@fabric-collection
  fi
  if codex_engineering_collision; then
    echo "A different Codex powerbi-engineering plugin is already installed." >&2
    echo "Remove or disable it before installing $engineering_id." >&2
    exit 5
  fi
  # Re-adding a local plugin refreshes Codex's cached copy from this checkout.
  run codex plugin add "$engineering_id"

  if [[ -n $(claude_marketplace_source fabric-collection) ]]; then
    run_claude plugin marketplace update fabric-collection
  else
    run_claude plugin marketplace add microsoft/skills-for-fabric --scope user
  fi
  # Removing a Claude marketplace also uninstalls the plugins it provided.
  if [[ -n $(claude_marketplace_source "$legacy_marketplace") ]]; then
    run_claude plugin marketplace remove "$legacy_marketplace"
  fi
  local_source=$(claude_marketplace_source "$marketplace")
  if [[ -n "$local_source" && "$local_source" != "$setup_root" ]]; then
    run_claude plugin marketplace remove "$marketplace"
    local_source=""
  fi
  if [[ -z "$local_source" ]]; then
    run_claude plugin marketplace add "$setup_root" --scope user
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
        const rows=JSON.parse(s || "[]"), ours=process.argv.slice(1);
        process.exit(rows.some(p=>p.id.startsWith("powerbi-engineering@") && !ours.includes(p.id))?0:1)
      })' "$engineering_id" "$legacy_engineering_id"; then
    echo "A different Claude powerbi-engineering plugin is already installed." >&2
    echo "Uninstall it before installing $engineering_id." >&2
    exit 5
  fi
  # Claude caches plugins by version: a skill change reaches Claude only after
  # the version in plugins/powerbi-engineering/.claude-plugin/plugin.json is bumped.
  if installed_scope=$(claude_plugin_record "$engineering_id"); then
    run_claude plugin update "$engineering_id" --scope "$installed_scope" --yes
  else
    run_claude plugin install "$engineering_id" --scope "$claude_scope" --yes
  fi
fi

configure_args=(
  "$setup_root/scripts/configure.mjs"
  --workspace "$workspace"
  --setup-root "$setup_root"
  --bin-dir "$bin_dir"
)
if [[ -n "$env_file" ]]; then configure_args+=(--env-file "$env_file"); fi
if ((dry_run)); then configure_args+=(--dry-run); fi
node "${configure_args[@]}"

echo
echo "Power BI AI setup complete for: $workspace"
if ((!path_had_bin_dir)); then
  echo "note: $bin_dir was not on PATH. Open a new terminal (Ubuntu's ~/.profile adds"
  echo "      ~/.local/bin once it exists) or add it to your shell profile yourself."
fi
echo "Next: run $setup_root/doctor.sh --workspace $workspace"
echo "Then sign in once with 'claude' and 'codex'. Claude asks to trust the"
echo "workspace and approve its project MCP servers on first launch there."
echo "Power BI Desktop must be installed on Windows with its external-tool bridge enabled."
