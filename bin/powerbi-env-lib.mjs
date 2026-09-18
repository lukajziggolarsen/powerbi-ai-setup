import fs from "node:fs";

function parseEnv(file) {
  const values = {};
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const original = lines[index];
    const line = original.trim();
    if (!line || line.startsWith("#")) continue;
    const match = original.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) throw new Error(`${file}:${index + 1}: invalid environment assignment`);
    const [, key, rawValue] = match;
    let value = rawValue.trim();
    if ((value.startsWith("'") && value.endsWith("'")) ||
        (value.startsWith('"') && value.endsWith('"'))) {
      value = value.slice(1, -1);
    } else if (value.startsWith("'") || value.startsWith('"')) {
      throw new Error(`${file}:${index + 1}: unterminated quoted value`);
    }
    values[key] = value;
  }
  return values;
}

function profiles(values, kind) {
  const prefix = kind.toUpperCase();
  const suffixes = kind === "psql"
    ? "URL|MCP_NAME"
    : "HOST|PORT|DATABASE|SCHEMA|USER|PASSWORD|ENCRYPT|MCP_NAME";
  const pattern = new RegExp(`^${prefix}_([A-Z][A-Z0-9_]*)_(?:${suffixes})$`);
  const discovered = [];
  for (const key of Object.keys(values)) {
    if (!key.toUpperCase().startsWith(`${prefix}_`)) continue;
    if (key !== key.toUpperCase()) throw new Error(`${key} must use uppercase variable names`);
    const match = key.match(pattern);
    if (!match) throw new Error(`${key} does not match ${prefix}_<CONNECTION_NAME>_<FIELD>`);
    discovered.push(match[1]);
  }
  const result = [...new Set(discovered)].map((profile) => profile.toLowerCase());
  const seen = new Set();
  for (const profile of result) {
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(profile)) {
      throw new Error(`${prefix} connection name ${JSON.stringify(profile)} must use letters, numbers, and underscores`);
    }
    const normalized = profile.toUpperCase();
    if (seen.has(normalized)) throw new Error(`${listKey} contains duplicate profile ${profile}`);
    seen.add(normalized);
  }
  return result;
}

function profileKey(kind, profile, suffix) {
  return `${kind.toUpperCase()}_${profile.toUpperCase()}_${suffix}`;
}

function required(values, key) {
  if (!values[key]) throw new Error(`missing required variable ${key}`);
}

function requiredValue(values, key) {
  required(values, key);
  return values[key];
}

function validatePort(values, kind, profile, fallback) {
  const key = profileKey(kind, profile, "PORT");
  const port = values[key] || fallback;
  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
    throw new Error(`${key} must be an integer from 1 to 65535`);
  }
  return port;
}

function validateSchema(values, kind, profile) {
  const key = profileKey(kind, profile, "SCHEMA");
  const schema = requiredValue(values, key);
  const pattern = kind === "psql"
    ? /^[A-Za-z_][A-Za-z0-9_$]*(\s*,\s*[A-Za-z_][A-Za-z0-9_$]*)*$/
    : /^[A-Za-z_][A-Za-z0-9_$]*$/;
  if (!pattern.test(schema)) {
    throw new Error(`${key} must contain ${kind === "psql" ? "one or more comma-separated" : "one"} unquoted schema identifier(s)`);
  }
  return schema;
}

function mcpName(values, kind, profile) {
  const override = values[profileKey(kind, profile, "MCP_NAME")];
  const fallback = `${kind}-${profile.toLowerCase().replaceAll("_", "-")}`;
  const name = override || fallback;
  if (!/^[A-Za-z0-9_-]+$/.test(name)) {
    throw new Error(`${profileKey(kind, profile, "MCP_NAME")} is not a valid MCP server name`);
  }
  return name;
}

function inspect(values) {
  const psql = profiles(values, "psql");
  const mssql = profiles(values, "mssql");
  for (const profile of psql) {
    const urlKey = profileKey("psql", profile, "URL");
    const connectionUrl = requiredValue(values, urlKey);
    let parsed;
    try {
      parsed = new URL(connectionUrl);
    } catch {
      throw new Error(`${urlKey} must be a valid PostgreSQL URL`);
    }
    if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
      throw new Error(`${urlKey} must use the postgres:// or postgresql:// scheme`);
    }
  }
  for (const profile of mssql) {
    for (const suffix of ["HOST", "DATABASE", "SCHEMA", "USER", "PASSWORD"]) {
      required(values, profileKey("mssql", profile, suffix));
    }
    validatePort(values, "mssql", profile, "1433");
    validateSchema(values, "mssql", profile);
    const encryptKey = profileKey("mssql", profile, "ENCRYPT");
    // go-mssqldb (used by MCP Toolbox) accepts four modes. "false" still
    // negotiates TLS for the login packet, so legacy servers without a usable
    // certificate need "disable", which skips the handshake entirely.
    if (values[encryptKey] && !["true", "false", "disable", "strict"].includes(values[encryptKey].toLowerCase())) {
      throw new Error(`${encryptKey} must be true, false, disable, or strict`);
    }
  }
  const sources = {
    psql: psql.map((profile) => ({ name: mcpName(values, "psql", profile), profile })),
    mssql: mssql.map((profile) => ({ name: mcpName(values, "mssql", profile), profile })),
  };
  const names = [...sources.psql, ...sources.mssql].map((source) => source.name);
  if (new Set(names).size !== names.length) throw new Error("MCP server names must be unique");
  return sources;
}

export function sourcesFromEnv(file) {
  return inspect(parseEnv(file));
}

export function valueFromEnv(file, key) {
  const values = parseEnv(file);
  inspect(values);
  return values[key];
}

export function psqlUrlFromEnv(file, profile) {
  const values = parseEnv(file);
  inspect(values);
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(profile)) throw new Error("invalid PSQL profile name");
  return requiredValue(values, profileKey("psql", profile, "URL"));
}
