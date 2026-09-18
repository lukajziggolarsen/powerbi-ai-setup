#!/usr/bin/env node
// Start a stdio MCP server, complete the initialize handshake, and exit.
// Used by doctor.sh --live to prove a configured server actually connects
// instead of failing later inside an agent session as CONNECTION_CLOSED.

import { spawn } from "node:child_process";

const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error("Usage: mcp-probe.mjs <command> [args...]");
  process.exit(2);
}

const timeoutMs = Number(process.env.POWERBI_AI_MCP_PROBE_TIMEOUT_MS || 30000);
const child = spawn(command, args, { stdio: ["pipe", "pipe", "pipe"] });
const stderr = [];
let stdout = "";
let settled = false;

function finish(code, message) {
  if (settled) return;
  settled = true;
  if (message) console.error(message);
  child.kill("SIGKILL");
  process.exit(code);
}

function firstError() {
  const text = stderr.join("");
  const line = text.split(/\r?\n/).find((l) => /error|fatal|refused|denied/i.test(l));
  return (line || text.split(/\r?\n/).filter(Boolean).pop() || "no output")
    // Servers such as MCP Toolbox prefix every line with a timestamp and a
    // level; dropping them keeps the actual cause inside doctor's one line.
    .replace(/^\s*\d{4}-\d{2}-\d{2}T[\d:.+-]+\s*/, "")
    .replace(/^(ERROR|FATAL|WARN)\s+/i, "")
    .trim()
    .slice(0, 400);
}

const timer = setTimeout(() => finish(1, `timed out after ${timeoutMs}ms: ${firstError()}`), timeoutMs);
timer.unref?.();

child.on("error", (error) => finish(1, `failed to spawn: ${error.message}`));
child.on("exit", (code) => finish(1, `exited with code ${code}: ${firstError()}`));
child.stderr.on("data", (chunk) => stderr.push(String(chunk)));
child.stdout.on("data", (chunk) => {
  stdout += String(chunk);
  for (const line of stdout.split(/\r?\n/)) {
    if (!line.trim().startsWith("{")) continue;
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      continue;
    }
    if (message.id !== 1) continue;
    if (message.error) finish(1, `initialize failed: ${JSON.stringify(message.error).slice(0, 300)}`);
    finish(0);
  }
});

child.stdin.write(`${JSON.stringify({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "powerbi-ai-doctor", version: "1" },
  },
})}\n`);
