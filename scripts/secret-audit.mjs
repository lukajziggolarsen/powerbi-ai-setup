#!/usr/bin/env node

import fs from "node:fs";

const checks = [
  /(?:postgres(?:ql)?|mysql|mssql):\/\/(?!\$\{)[^\s/@:]+:[^\s/@]+@/i,
  /\b(?:PASSWORD|PASSWD|DATABASE_URI|API_KEY|TOKEN|SECRET)\b\s*=\s*["'](?!\$)[^"']+["']/i,
  /\"(?:password|token|secret|apiKey|api_key|databaseUri|database_uri)\"\s*:\s*\"(?!\$\{)[^\"]+\"/i,
];

let findings = 0;
for (const file of process.argv.slice(2)) {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) continue;
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((line, index) => {
    if (checks.some((check) => check.test(line))) {
      findings += 1;
      console.log(`${file}:${index + 1}: credential-like literal`);
    }
  });
}

if (findings > 0) {
  console.error(`Found ${findings} credential-like literal(s); values were not printed.`);
  process.exitCode = 1;
} else {
  console.log("No credential-like literals found in the checked files.");
}
