#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { sourcesFromEnv } from "../bin/powerbi-env-lib.mjs";

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) throw new Error(`Unexpected argument: ${arg}`);
    const key = arg.slice(2);
    if (key === "dry-run") {
      out.dryRun = true;
      continue;
    }
    const value = argv[++i];
    if (!value) throw new Error(`Missing value for ${arg}`);
    out[key] = value;
  }
  return out;
}

function parseJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function jsonText(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function tomlString(value) {
  return JSON.stringify(value);
}

function normalizeSection(content) {
  return content.length === 0 || content.endsWith("\n") ? content : `${content}\n`;
}

function upsertTomlSection(content, section, entries) {
  const header = `[${section}]`;
  const childPrefix = `[${section}.`;
  const lines = normalizeSection(content).split("\n");
  let start = lines.findIndex((line) => line.trim() === header);

  if (start < 0) {
    const child = lines.findIndex((line) => line.trim().startsWith(childPrefix));
    const block = [header, ...Object.entries(entries).map(([k, v]) => `${k} = ${v}`), ""];
    if (child >= 0) lines.splice(child, 0, ...block);
    else {
      while (lines.length && lines.at(-1) === "") lines.pop();
      if (lines.length) lines.push("");
      lines.push(...block);
    }
    return `${lines.join("\n").replace(/\n+$/, "")}\n`;
  }

  let end = start + 1;
  while (end < lines.length && !/^\s*\[/.test(lines[end])) end += 1;
  const keys = new Set(Object.keys(entries));
  const kept = lines.slice(start + 1, end).filter((line) => {
    const match = line.match(/^\s*([A-Za-z0-9_-]+)\s*=/);
    return !match || !keys.has(match[1]);
  });
  const replacement = [
    header,
    ...Object.entries(entries).map(([k, v]) => `${k} = ${v}`),
    ...kept,
  ];
  lines.splice(start, end - start, ...replacement);
  return `${lines.join("\n").replace(/\n+$/, "")}\n`;
}

function removeManagedMcpSections(content) {
  const lines = normalizeSection(content).split("\n");
  const managedCommand = /powerbi-(?:modeling|postgres|psql|mssql)-mcp["']?\s*$/;
  const output = [];
  for (let start = 0; start < lines.length; ) {
    if (!/^\s*\[mcp_servers\./.test(lines[start])) {
      output.push(lines[start]);
      start += 1;
      continue;
    }
    let end = start + 1;
    while (end < lines.length && !/^\s*\[/.test(lines[end])) end += 1;
    const block = lines.slice(start, end);
    if (!block.some((line) => /^\s*command\s*=/.test(line) && managedCommand.test(line.trim()))) {
      output.push(...block);
    }
    start = end;
  }
  return `${output.join("\n").replace(/\n+$/, "")}\n`;
}

const args = parseArgs(process.argv.slice(2));
const workspace = path.resolve(args.workspace || process.cwd());
const blueprint = path.resolve(args.blueprint || path.join(import.meta.dirname, ".."));
const binDir = path.resolve(args["bin-dir"] || path.join(os.homedir(), ".local", "bin"));
const stateDir = path.resolve(
  args["state-dir"] || path.join(os.homedir(), ".local", "state", "powerbi-ai-blueprint"),
);
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupRoot = path.join(stateDir, "backups", timestamp);
const dryRun = Boolean(args.dryRun);

if (!fs.existsSync(workspace)) {
  if (dryRun) console.log(`would create workspace ${workspace}`);
  else fs.mkdirSync(workspace, { recursive: true });
}

const planned = [];

function backup(file) {
  if (!fs.existsSync(file)) return;
  const label = file.startsWith(workspace)
    ? path.join("workspace", path.relative(workspace, file))
    : path.join("home", path.relative(os.homedir(), file));
  const destination = path.join(backupRoot, label);
  if (dryRun) return;
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(file, destination);
}

function write(file, content, mode) {
  const previous = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
  if (previous === content) return;
  planned.push(file);
  if (dryRun) return;
  backup(file);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, { mode });
  if (mode) fs.chmodSync(file, mode);
}

function readOr(file, fallback) {
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : fallback;
}

let sources = { psql: [], mssql: [] };
if (args["env-file"]) {
  sources = sourcesFromEnv(path.resolve(args["env-file"]));
}
for (const kind of ["psql", "mssql"]) {
  if (!Array.isArray(sources[kind] || [])) throw new Error(`${kind} must be an array`);
  for (const item of sources[kind] || []) {
    if (!/^[A-Za-z0-9_-]+$/.test(item.name || "")) {
      throw new Error(`Invalid ${kind} server name: ${item.name}`);
    }
    if (!/^[A-Za-z0-9_]+$/.test(item.profile || "")) {
      throw new Error(`Invalid ${kind} profile: ${item.profile}`);
    }
  }
}

const allSourceNames = [...(sources.psql || []), ...(sources.mssql || [])].map((x) => x.name);
if (new Set(allSourceNames).size !== allSourceNames.length) {
  throw new Error("Source MCP server names must be unique");
}

const codexFile = path.join(workspace, ".codex", "config.toml");
let codex = removeManagedMcpSections(readOr(codexFile, ""));
codex = upsertTomlSection(codex, 'plugins."powerbi-authoring@fabric-collection"', {
  enabled: "true",
});
codex = upsertTomlSection(codex, 'plugins."powerbi-engineering@powerbi-ai-blueprint"', {
  enabled: "true",
});
codex = upsertTomlSection(
  codex,
  'plugins."powerbi-authoring@fabric-collection".mcp_servers.powerbi-modeling-mcp',
  { enabled: "false" },
);
codex = upsertTomlSection(codex, "mcp_servers.powerbi-modeling", {
  command: tomlString(path.join(binDir, "powerbi-modeling-mcp")),
  enabled: "true",
  required: "false",
  startup_timeout_sec: "60",
  tool_timeout_sec: "600",
  default_tools_approval_mode: tomlString("approve"),
});
for (const item of sources.psql || []) {
  codex = upsertTomlSection(codex, `mcp_servers.${item.name}`, {
    command: tomlString(path.join(binDir, "powerbi-psql-mcp")),
    args: `[${tomlString(item.profile)}]`,
    enabled: "true",
    required: "false",
    startup_timeout_sec: "60",
    tool_timeout_sec: "180",
    default_tools_approval_mode: tomlString("prompt"),
  });
}
for (const item of sources.mssql || []) {
  codex = upsertTomlSection(codex, `mcp_servers.${item.name}`, {
    command: tomlString(path.join(binDir, "powerbi-mssql-mcp")),
    args: `[${tomlString(item.profile)}]`,
    enabled: "true",
    required: "false",
    startup_timeout_sec: "60",
    tool_timeout_sec: "180",
    default_tools_approval_mode: tomlString("prompt"),
  });
}
write(codexFile, codex, 0o600);

const claudeSettingsFile = path.join(workspace, ".claude", "settings.json");
const claudeSettings = fs.existsSync(claudeSettingsFile) ? parseJson(claudeSettingsFile) : {};
claudeSettings.enabledPlugins = {
  ...(claudeSettings.enabledPlugins || {}),
  "powerbi-authoring@fabric-collection": true,
  "powerbi-engineering@powerbi-ai-blueprint": true,
};
write(claudeSettingsFile, jsonText(claudeSettings), 0o644);

const mcpFile = path.join(workspace, ".mcp.json");
const mcp = fs.existsSync(mcpFile) ? parseJson(mcpFile) : {};
mcp.mcpServers ||= {};
for (const [name, server] of Object.entries(mcp.mcpServers)) {
  const commandName = typeof server?.command === "string" ? path.basename(server.command) : "";
  if (["powerbi-modeling-mcp", "powerbi-postgres-mcp", "powerbi-psql-mcp", "powerbi-mssql-mcp"].includes(commandName)) {
    delete mcp.mcpServers[name];
  }
}
mcp.mcpServers["powerbi-modeling"] = {
  type: "stdio",
  command: path.join(binDir, "powerbi-modeling-mcp"),
  args: [],
};
for (const item of sources.psql || []) {
  mcp.mcpServers[item.name] = {
    type: "stdio",
    command: path.join(binDir, "powerbi-psql-mcp"),
    args: [item.profile],
  };
}
for (const item of sources.mssql || []) {
  mcp.mcpServers[item.name] = {
    type: "stdio",
    command: path.join(binDir, "powerbi-mssql-mcp"),
    args: [item.profile],
  };
}
write(mcpFile, jsonText(mcp), 0o644);

const claudeStateFile = path.resolve(
  args["claude-state-file"] || path.join(os.homedir(), ".claude.json"),
);
const claudeState = fs.existsSync(claudeStateFile) ? parseJson(claudeStateFile) : {};
claudeState.projects ||= {};
claudeState.projects[workspace] ||= {};
const disabled = new Set(claudeState.projects[workspace].disabledMcpServers || []);
disabled.add("plugin:powerbi-authoring:powerbi-modeling-mcp");
claudeState.projects[workspace].disabledMcpServers = [...disabled].sort();
write(claudeStateFile, jsonText(claudeState), 0o600);

for (const file of ["AGENTS.md", "CLAUDE.md"]) {
  const target = path.join(workspace, file);
  const template = path.join(blueprint, "templates", file);
  if (!fs.existsSync(target)) write(target, fs.readFileSync(template, "utf8"), 0o644);
  else console.log(`kept existing guidance: ${target}`);
}

if (planned.length === 0) console.log("configuration already up to date");
else {
  for (const file of planned) console.log(`${dryRun ? "would write" : "wrote"}: ${file}`);
  if (!dryRun) console.log(`backups: ${backupRoot}`);
}
