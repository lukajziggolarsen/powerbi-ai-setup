#!/usr/bin/env node
// Print the MCP servers this setup manages in a workspace .mcp.json, one per
// line as <name>\t<launcher>\t<profile>. Shared by setup.sh and doctor.sh.

import fs from "node:fs";

const file = process.argv[2];
if (!file) {
  console.error("Usage: mcp-servers.mjs <.mcp.json>");
  process.exit(2);
}

const servers = JSON.parse(fs.readFileSync(file, "utf8")).mcpServers || {};
for (const [name, server] of Object.entries(servers)) {
  const command = typeof server.command === "string" ? server.command : "";
  if (!/powerbi-(modeling|psql|mssql)-mcp$/.test(command)) continue;
  process.stdout.write(`${name}\t${command}\t${(server.args || [])[0] || ""}\n`);
}
