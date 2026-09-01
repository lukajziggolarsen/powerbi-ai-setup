#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const VERSION = "0.2.0";
const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3, informational: 4 };
const LEGACY_VISUALS = new Map([
  ["card", "cardVisual"],
  ["multiRowCard", "cardVisual"],
  ["table", "tableEx"],
  ["matrix", "pivotTable"],
  ["map", "azureMap"],
  ["filledMap", "azureMap"],
]);

function fail(message, code = 1) {
  process.stderr.write(`Error: ${message}\n`);
  process.exit(code);
}

function usage() {
  process.stdout.write(`Power BI Engineering audit CLI ${VERSION}

Usage:
  pbi-audit.mjs scan <project|.pbip|.Report|.SemanticModel> [options]
  pbi-audit.mjs evidence <audit-dir> <summary|findings|unused|visual|object|dependencies> [options]

Scan options:
  --out <directory>               Default: <project>/.powerbi-audit

Scope is controlled by the target: pass a project root for a full scan, or a
single .SemanticModel/.Report directory for a model-only/report-only baseline.

Evidence options:
  --severity <critical,high,...>
  --type <measure|column|table|...>
  --page <page display name>
  --query <case-insensitive text>
  --limit <n>                     Default: 30

The scanner is read-only with respect to PBIP sources. It writes only to --out.
`);
}

function parseOptions(args) {
  const positional = [];
  const options = {};
  for (let i = 0; i < args.length; i += 1) {
    const value = args[i];
    if (!value.startsWith("--")) {
      positional.push(value);
      continue;
    }
    const key = value.slice(2);
    if (i + 1 >= args.length || args[i + 1].startsWith("--")) {
      options[key] = true;
    } else {
      options[key] = args[i + 1];
      i += 1;
    }
  }
  return { positional, options };
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(`Cannot parse JSON ${file}: ${error.message}`);
  }
}

function walkFiles(root, predicate) {
  if (!root || !fs.existsSync(root)) return [];
  const result = [];
  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (!predicate || predicate(full)) result.push(full);
    }
  }
  return result.sort((a, b) => a.localeCompare(b));
}

function findDirectories(root, suffix) {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.endsWith(suffix))
    .map((entry) => path.join(root, entry.name))
    .sort();
}

function resolveProject(targetInput) {
  const target = path.resolve(targetInput);
  if (!fs.existsSync(target)) throw new Error(`Target does not exist: ${target}`);
  let projectRoot;
  let reportDir;
  let modelDir;

  const stat = fs.statSync(target);
  if (stat.isFile()) {
    if (!target.toLowerCase().endsWith(".pbip")) {
      throw new Error("File target must be a .pbip file.");
    }
    projectRoot = path.dirname(target);
  } else if (target.endsWith(".Report")) {
    reportDir = target;
    projectRoot = path.dirname(target);
  } else if (target.endsWith(".SemanticModel")) {
    modelDir = target;
    projectRoot = path.dirname(target);
  } else {
    projectRoot = target;
  }

  if (!reportDir) {
    const reports = findDirectories(projectRoot, ".Report");
    if (reports.length > 1) throw new Error(`Multiple .Report directories found under ${projectRoot}. Pass one explicitly.`);
    reportDir = reports[0] || null;
  }
  if (!modelDir) {
    const models = findDirectories(projectRoot, ".SemanticModel");
    if (models.length > 1) throw new Error(`Multiple .SemanticModel directories found under ${projectRoot}. Pass one explicitly.`);
    modelDir = models[0] || null;
  }
  if (!reportDir && !modelDir) {
    throw new Error(`No .Report or .SemanticModel directory found under ${projectRoot}.`);
  }

  const pbips = fs.readdirSync(projectRoot).filter((name) => name.endsWith(".pbip")).sort();
  return {
    projectRoot,
    projectName: path.basename(projectRoot),
    pbip: pbips.length === 1 ? path.join(projectRoot, pbips[0]) : null,
    reportDir,
    modelDir,
  };
}

function normalizeName(value) {
  return String(value || "").trim().toLowerCase();
}

function unquoteTmdl(value) {
  const text = String(value || "").trim();
  if (text.startsWith("'") && text.endsWith("'")) {
    return text.slice(1, -1).replaceAll("''", "'");
  }
  return text;
}

function splitAssignment(text) {
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === "'") {
      if (quoted && text[i + 1] === "'") {
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (text[i] === "=" && !quoted) {
      return {
        name: unquoteTmdl(text.slice(0, i)),
        expression: text.slice(i + 1).trim(),
        calculated: true,
      };
    }
  }
  return { name: unquoteTmdl(text), expression: "", calculated: false };
}

function parsePeerBlocks(text) {
  const lines = text.split(/\r?\n/);
  const starts = [];
  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].match(/^\t(measure|column|partition|hierarchy)\s+(.+)$/);
    if (match) starts.push({ index: i, type: match[1], rest: match[2] });
  }
  return starts.map((start, index) => {
    const end = index + 1 < starts.length ? starts[index + 1].index : lines.length;
    return { ...start, block: lines.slice(start.index, end).join("\n") };
  });
}

function tmdlObjectKey(kind, table, name) {
  return `${kind}|${normalizeName(table)}|${normalizeName(name)}`;
}

function parseTableFile(file) {
  const text = fs.readFileSync(file, "utf8");
  const first = text.split(/\r?\n/).find((line) => line.trim());
  const tableMatch = first?.match(/^table\s+(.+?)(?:\s*=\s*.*)?$/);
  const fallback = path.basename(file, ".tmdl");
  const tableName = tableMatch ? splitAssignment(tableMatch[1]).name : fallback;
  const table = {
    kind: "table",
    table: null,
    name: tableName,
    key: tmdlObjectKey("table", "", tableName),
    sourceFile: file,
    hidden: /\n\tisHidden:\s*true\b/i.test(text),
    lineageTag: text.match(/^\tlineageTag:\s*(.+)$/m)?.[1]?.trim() || null,
  };
  const objects = [table];
  for (const item of parsePeerBlocks(text)) {
    const assignment = splitAssignment(item.rest);
    const common = {
      table: tableName,
      name: assignment.name,
      sourceFile: file,
      hidden: /\n\t\tisHidden:\s*true\b/i.test(item.block),
      lineageTag: item.block.match(/^\t\tlineageTag:\s*(.+)$/m)?.[1]?.trim() || null,
      expression: assignment.expression ? `${assignment.expression}\n${item.block}` : item.block,
    };
    if (item.type === "measure") {
      objects.push({
        ...common,
        kind: "measure",
        key: tmdlObjectKey("measure", tableName, assignment.name),
      });
    } else if (item.type === "column") {
      objects.push({
        ...common,
        kind: assignment.calculated ? "calculated-column" : "column",
        key: tmdlObjectKey("column", tableName, assignment.name),
        dataType: item.block.match(/^\t\tdataType:\s*(.+)$/m)?.[1]?.trim() || null,
        sourceColumn: item.block.match(/^\t\tsourceColumn:\s*(.+)$/m)?.[1]?.trim() || null,
      });
    } else if (item.type === "partition") {
      objects.push({
        ...common,
        kind: "partition",
        key: tmdlObjectKey("partition", tableName, assignment.name),
        mode: item.block.match(/^\t\tmode:\s*(.+)$/m)?.[1]?.trim() || null,
        sourceType: item.block.match(/^\t\tsource\s*=\s*(.+)$/m)?.[1]?.trim() || null,
      });
    } else if (item.type === "hierarchy") {
      objects.push({
        ...common,
        kind: "hierarchy",
        key: tmdlObjectKey("hierarchy", tableName, assignment.name),
      });
    }
  }
  return { text, tableName, objects };
}

function parseRelationships(modelDefinition) {
  if (!modelDefinition) return [];
  const file = path.join(modelDefinition, "relationships.tmdl");
  if (!fs.existsSync(file)) return [];
  const text = fs.readFileSync(file, "utf8");
  const lines = text.split(/\r?\n/);
  const starts = [];
  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].match(/^relationship\s+(.+)$/);
    if (match) starts.push({ index: i, name: unquoteTmdl(match[1]) });
  }
  return starts.map((start, index) => {
    const end = index + 1 < starts.length ? starts[index + 1].index : lines.length;
    const block = lines.slice(start.index, end).join("\n");
    return {
      kind: "relationship",
      table: null,
      name: start.name,
      key: tmdlObjectKey("relationship", "", start.name),
      sourceFile: file,
      from: block.match(/^\tfromColumn:\s*(.+)$/m)?.[1]?.trim() || null,
      to: block.match(/^\ttoColumn:\s*(.+)$/m)?.[1]?.trim() || null,
      active: !/^\tisActive:\s*false\b/im.test(block),
      crossFilter: block.match(/^\tcrossFilteringBehavior:\s*(.+)$/m)?.[1]?.trim() || "oneDirection",
      fromCardinality: block.match(/^\tfromCardinality:\s*(.+)$/m)?.[1]?.trim() || "many",
      toCardinality: block.match(/^\ttoCardinality:\s*(.+)$/m)?.[1]?.trim() || "one",
      block,
    };
  });
}

function splitQualifiedColumn(value) {
  if (!value) return null;
  let dot = -1;
  let quoted = false;
  for (let i = 0; i < value.length; i += 1) {
    if (value[i] === "'") {
      if (quoted && value[i + 1] === "'") i += 1;
      else quoted = !quoted;
    } else if (value[i] === "." && !quoted) {
      dot = i;
      break;
    }
  }
  if (dot < 0) return null;
  return {
    table: unquoteTmdl(value.slice(0, dot)),
    name: unquoteTmdl(value.slice(dot + 1)),
  };
}

function extractDaxRefs(expression, owner, indexes) {
  const refs = [];
  const seen = new Set();
  const qualifiedSpans = [];
  const qualified = /('(?:[^']|'')+'|[A-Za-z_][A-Za-z0-9_.-]*)\s*\[([^\]]+)\]/g;
  let match;
  while ((match = qualified.exec(expression))) {
    const table = unquoteTmdl(match[1]);
    const name = match[2];
    qualifiedSpans.push([match.index, qualified.lastIndex]);
    const measureKey = tmdlObjectKey("measure", table, name);
    const columnKey = tmdlObjectKey("column", table, name);
    const target = indexes.byKey.has(measureKey) ? measureKey : columnKey;
    const token = `${target}|${match[0]}`;
    if (!seen.has(token)) {
      refs.push({ target, evidence: match[0] });
      seen.add(token);
    }
  }
  const unqualified = /\[([^\]]+)\]/g;
  while ((match = unqualified.exec(expression))) {
    if (qualifiedSpans.some(([start, end]) => match.index >= start && match.index < end)) continue;
    const name = match[1];
    const globalMeasures = indexes.measureByName.get(normalizeName(name)) || [];
    let target = null;
    if (globalMeasures.length === 1) target = globalMeasures[0].key;
    else {
      const localColumn = tmdlObjectKey("column", owner.table, name);
      if (indexes.byKey.has(localColumn)) target = localColumn;
    }
    if (target && !seen.has(target)) {
      refs.push({ target, evidence: match[0] });
      seen.add(target);
    }
  }
  return refs;
}

function sourceEntity(node, aliases = new Map()) {
  if (!node || typeof node !== "object") return null;
  if (node.SourceRef?.Entity) return node.SourceRef.Entity;
  if (node.SourceRef?.Source && aliases.has(node.SourceRef.Source)) {
    return aliases.get(node.SourceRef.Source);
  }
  for (const value of Object.values(node)) {
    const found = sourceEntity(value, aliases);
    if (found) return found;
  }
  return null;
}

function extractStructuredRefs(root) {
  const refs = [];
  const seen = new Set();
  function propertyVariation(node) {
    if (!node || typeof node !== "object") return null;
    if (node.PropertyVariationSource) return node.PropertyVariationSource;
    for (const value of Object.values(node)) {
      const found = propertyVariation(value);
      if (found) return found;
    }
    return null;
  }
  function emit(kind, table, name, location) {
    if (!table || !name) return;
    const key = `${kind}|${normalizeName(table)}|${normalizeName(name)}`;
    const unique = `${key}|${location}`;
    if (!seen.has(unique)) {
      refs.push({ kind, table, name, key, location });
      seen.add(unique);
    }
  }
  function visit(node, location, inheritedAliases = new Map()) {
    if (!node || typeof node !== "object") return;
    const aliases = new Map(inheritedAliases);
    if (Array.isArray(node.From)) {
      for (const source of node.From) {
        if (source?.Name && source?.Entity) aliases.set(source.Name, source.Entity);
      }
    }
    if (node.HierarchyLevel && typeof node.HierarchyLevel === "object") {
      const variation = propertyVariation(node.HierarchyLevel);
      if (variation?.Property) {
        emit(
          "column",
          sourceEntity(variation.Expression || variation, aliases),
          variation.Property,
          location,
        );
      } else {
        const hierarchy = node.HierarchyLevel.Expression?.Hierarchy;
        emit(
          "hierarchy",
          sourceEntity(hierarchy?.Expression || hierarchy, aliases),
          hierarchy?.Hierarchy,
          location,
        );
      }
      return;
    }
    for (const kind of ["Measure", "Column", "Hierarchy"]) {
      const value = node[kind];
      if (!value || typeof value !== "object") continue;
      const table = sourceEntity(value.Expression || value, aliases);
      const name = value.Property || value.Level || value.Hierarchy || value.Name;
      emit(kind === "Measure" ? "measure" : kind.toLowerCase(), table, name, location);
    }
    if (Array.isArray(node)) {
      node.forEach((value, index) => visit(value, `${location}[${index}]`, aliases));
    } else {
      for (const [key, value] of Object.entries(node)) {
        visit(value, location ? `${location}.${key}` : key, aliases);
      }
    }
  }
  visit(root, "");
  return refs;
}

function literalText(node) {
  if (!node || typeof node !== "object") return null;
  if (typeof node.Value === "string") {
    const raw = node.Value;
    if (raw.startsWith("'") && raw.endsWith("'")) {
      return raw.slice(1, -1).replaceAll("''", "'");
    }
  }
  for (const value of Object.values(node)) {
    const result = literalText(value);
    if (result) return result;
  }
  return null;
}

function visualTitle(doc) {
  const title = doc?.visual?.visualContainerObjects?.title || doc?.visual?.objects?.title;
  return literalText(title);
}

function parseReport(reportDir) {
  if (!reportDir) return { pages: [], visuals: [], usages: [], reportFiles: [] };
  const definition = path.join(reportDir, "definition");
  const pagesRoot = path.join(definition, "pages");
  const pagesIndex = path.join(pagesRoot, "pages.json");
  const orderDoc = fs.existsSync(pagesIndex) ? readJson(pagesIndex) : {};
  const pageOrder = orderDoc.pageOrder || [];
  const pageDirs = fs.existsSync(pagesRoot)
    ? fs.readdirSync(pagesRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
    : [];
  const sortedPages = [...new Set([...pageOrder, ...pageDirs.sort()])];
  const pages = [];
  const visuals = [];
  const usages = [];

  for (const pageName of sortedPages) {
    const pageFile = path.join(pagesRoot, pageName, "page.json");
    if (!fs.existsSync(pageFile)) continue;
    const pageDoc = readJson(pageFile);
    const page = {
      key: `page|${normalizeName(pageName)}`,
      name: pageName,
      displayName: pageDoc.displayName || pageName,
      hidden: pageDoc.visibility === "Hidden" || pageDoc.isHidden === true,
      width: pageDoc.width || pageDoc.displayArea?.width || null,
      height: pageDoc.height || pageDoc.displayArea?.height || null,
      sourceFile: pageFile,
      visualCount: 0,
    };
    pages.push(page);
    for (const ref of extractStructuredRefs(pageDoc.filterConfig || {})) {
      usages.push({
        ...ref,
        consumerKey: page.key,
        consumerType: "page-filter",
        page: page.displayName,
      });
    }
    const visualRoot = path.join(pagesRoot, pageName, "visuals");
    const visualFiles = walkFiles(visualRoot, (file) => path.basename(file) === "visual.json");
    page.visualCount = visualFiles.length;
    for (const file of visualFiles) {
      const doc = readJson(file);
      const name = doc.name || path.basename(path.dirname(file));
      const visual = {
        key: `visual|${normalizeName(pageName)}|${normalizeName(name)}`,
        name,
        pageKey: page.key,
        page: page.displayName,
        type: doc.visual?.visualType || null,
        title: visualTitle(doc),
        x: doc.position?.x ?? null,
        y: doc.position?.y ?? null,
        width: doc.position?.width ?? null,
        height: doc.position?.height ?? null,
        hidden: doc.position?.hidden === true,
        sourceFile: file,
      };
      visuals.push(visual);
      for (const ref of extractStructuredRefs(doc)) {
        let consumerType = "visual-metadata";
        if (ref.location.includes(".query.")) consumerType = "visual-query";
        else if (ref.location.includes("filterConfig") || ref.location.includes(".filter.")) {
          consumerType = "visual-filter";
        } else if (ref.location.includes(".selector.data")) {
          consumerType = "format-selector";
        } else if (ref.location.includes(".objects.")) {
          consumerType = "visual-formatting";
        }
        usages.push({
          ...ref,
          consumerKey: visual.key,
          consumerType,
          page: page.displayName,
          visual: name,
          visualType: visual.type,
          title: visual.title,
        });
      }
    }
  }
  const reportFile = path.join(definition, "report.json");
  if (fs.existsSync(reportFile)) {
    const reportDoc = readJson(reportFile);
    for (const ref of extractStructuredRefs(reportDoc.filterConfig || reportDoc.filters || {})) {
      usages.push({
        ...ref,
        consumerKey: "report",
        consumerType: "report-filter",
        page: null,
      });
    }
  }
  return {
    pages,
    visuals,
    usages,
    reportFiles: walkFiles(definition, (file) => file.endsWith(".json")),
  };
}

function buildModel(modelDir) {
  if (!modelDir) return { objects: [], relationships: [], dependencies: [], modelFiles: [] };
  const definition = path.join(modelDir, "definition");
  const tableFiles = walkFiles(path.join(definition, "tables"), (file) => file.endsWith(".tmdl"));
  const objects = [];
  for (const file of tableFiles) objects.push(...parseTableFile(file).objects);
  const relationships = parseRelationships(definition);
  objects.push(...relationships);

  const byKey = new Map(objects.map((object) => [object.key, object]));
  const measureByName = new Map();
  for (const object of objects.filter((item) => item.kind === "measure")) {
    const key = normalizeName(object.name);
    if (!measureByName.has(key)) measureByName.set(key, []);
    measureByName.get(key).push(object);
  }
  const indexes = { byKey, measureByName };
  const dependencies = [];

  for (const object of objects) {
    if (object.kind === "measure" || object.kind === "calculated-column") {
      for (const ref of extractDaxRefs(object.expression || "", object, indexes)) {
        dependencies.push({
          fromKey: object.key,
          toKey: ref.target,
          type: "dax-reference",
          evidence: ref.evidence,
        });
      }
    }
    if (object.kind === "partition") {
      dependencies.push({
        fromKey: tmdlObjectKey("table", "", object.table),
        toKey: object.key,
        type: "table-partition",
        evidence: object.name,
      });
    }
  }

  for (const relationship of relationships) {
    for (const [side, value] of [["from", relationship.from], ["to", relationship.to]]) {
      const qualified = splitQualifiedColumn(value);
      if (!qualified) continue;
      dependencies.push({
        fromKey: relationship.key,
        toKey: tmdlObjectKey("column", qualified.table, qualified.name),
        type: `relationship-${side}`,
        evidence: value,
      });
    }
  }

  const dedup = new Map();
  for (const edge of dependencies) {
    const key = `${edge.fromKey}|${edge.toKey}|${edge.type}`;
    if (!dedup.has(key)) dedup.set(key, edge);
  }
  return {
    objects,
    relationships,
    dependencies: [...dedup.values()],
    modelFiles: walkFiles(definition, (file) => file.endsWith(".tmdl")),
  };
}

function assignIds(model, report) {
  const prefixes = {
    table: "T",
    column: "C",
    "calculated-column": "C",
    measure: "M",
    partition: "PT",
    hierarchy: "H",
    relationship: "R",
  };
  const counters = {};
  const sortedObjects = [...model.objects].sort((a, b) =>
    `${a.kind}|${a.table || ""}|${a.name}`.localeCompare(`${b.kind}|${b.table || ""}|${b.name}`));
  const idByKey = new Map();
  for (const object of sortedObjects) {
    const prefix = prefixes[object.kind] || "O";
    counters[prefix] = (counters[prefix] || 0) + 1;
    object.id = `${prefix}${counters[prefix]}`;
    idByKey.set(object.key, object.id);
  }
  report.pages.forEach((page, index) => {
    page.id = `P${index + 1}`;
    idByKey.set(page.key, page.id);
  });
  report.visuals
    .sort((a, b) => `${a.page}|${a.name}`.localeCompare(`${b.page}|${b.name}`))
    .forEach((visual, index) => {
      visual.id = `V${index + 1}`;
      idByKey.set(visual.key, visual.id);
    });
  return { idByKey, objects: sortedObjects };
}

function addFinding(findings, input) {
  const digest = crypto.createHash("sha1")
    .update(`${input.rule}|${(input.objectIds || []).join(",")}|${(input.affected || []).join(",")}`)
    .digest("hex")
    .slice(0, 8);
  findings.push({
    id: `PBI-${input.rule.toUpperCase().replaceAll(/[^A-Z0-9]+/g, "-")}-${digest}`,
    ...input,
  });
}

function analyze(model, report, ids) {
  const findings = [];
  const byKey = new Map(model.objects.map((object) => [object.key, object]));
  const usageRecords = [];
  const directUsed = new Set();
  const missing = [];

  const dedupUsages = new Map();
  for (const usage of report.usages) {
    const key = [
      usage.consumerKey,
      usage.consumerType,
      usage.kind,
      normalizeName(usage.table),
      normalizeName(usage.name),
    ].join("|");
    if (!dedupUsages.has(key)) dedupUsages.set(key, usage);
  }
  for (const usage of dedupUsages.values()) {
    const targetKey = usage.kind === "measure"
      ? tmdlObjectKey("measure", usage.table, usage.name)
      : tmdlObjectKey("column", usage.table, usage.name);
    const target = byKey.get(targetKey);
    const record = {
      consumerId: ids.idByKey.get(usage.consumerKey) || usage.consumerKey,
      consumerType: usage.consumerType,
      targetId: target?.id || null,
      target: `${usage.table}[${usage.name}]`,
      targetKind: usage.kind,
      page: usage.page,
      visual: usage.visual || null,
      visualType: usage.visualType || null,
      title: usage.title || null,
      location: usage.location,
      status: target
        ? "resolved"
        : ["format-selector", "visual-metadata"].includes(usage.consumerType)
          ? "stale-metadata"
          : "missing",
    };
    usageRecords.push(record);
    if (target) {
      if (usage.consumerType !== "format-selector" && usage.consumerType !== "visual-metadata") {
        directUsed.add(target.key);
      }
    } else {
      missing.push(record);
    }
  }

  const activeMissing = missing.filter((item) =>
    !["format-selector", "visual-metadata"].includes(item.consumerType));
  const staleMissing = missing.filter((item) =>
    ["format-selector", "visual-metadata"].includes(item.consumerType));
  if (activeMissing.length) {
    addFinding(findings, {
      rule: "missing-report-reference",
      layer: "report-model-contract",
      severity: "critical",
      confidence: "strong",
      title: `${activeMissing.length} active report reference(s) do not resolve to model objects`,
      objectIds: [...new Set(activeMissing.map((item) => item.consumerId))].slice(0, 100),
      affected: [...new Set(activeMissing.map((item) => item.target))],
      evidence: activeMissing.slice(0, 20).map((item) => `${item.page || "Report"} ${item.consumerId} ${item.location}`),
      recommendation: "Restore or replace the missing bindings, validate PBIR, and render the affected pages.",
    });
  }
  if (staleMissing.length) {
    addFinding(findings, {
      rule: "stale-report-metadata",
      layer: "report",
      severity: "informational",
      confidence: "strong",
      title: `${staleMissing.length} formatting or metadata reference(s) point at absent objects`,
      objectIds: [...new Set(staleMissing.map((item) => item.consumerId))].slice(0, 100),
      affected: [...new Set(staleMissing.map((item) => item.target))],
      evidence: staleMissing.slice(0, 20).map((item) => `${item.page || "Report"} ${item.consumerId} ${item.location}`),
      recommendation: "Treat these as stale PBIR metadata unless rendered behavior or validation proves they are active.",
    });
  }

  const outgoing = new Map();
  for (const edge of model.dependencies) {
    if (!outgoing.has(edge.fromKey)) outgoing.set(edge.fromKey, []);
    outgoing.get(edge.fromKey).push(edge.toKey);
  }
  const transitiveUsed = new Set();
  const stack = [...directUsed];
  while (stack.length) {
    const key = stack.pop();
    for (const dependency of outgoing.get(key) || []) {
      if (directUsed.has(dependency) || transitiveUsed.has(dependency)) continue;
      transitiveUsed.add(dependency);
      stack.push(dependency);
    }
  }
  const structuralUsed = new Set();
  for (const edge of model.dependencies) {
    if (edge.type.startsWith("relationship-") || edge.type === "table-partition") {
      structuralUsed.add(edge.toKey);
    }
  }
  const usedChildren = new Set([...directUsed, ...transitiveUsed, ...structuralUsed]);
  for (const object of model.objects) {
    if (!object.table || !usedChildren.has(object.key)) continue;
    transitiveUsed.add(tmdlObjectKey("table", "", object.table));
  }

  const candidates = model.objects.filter((object) =>
    ["table", "column", "calculated-column", "measure", "hierarchy"].includes(object.kind)
    && !directUsed.has(object.key)
    && !transitiveUsed.has(object.key)
    && !structuralUsed.has(object.key));
  const unused = candidates.map((object) => ({
    id: object.id,
    kind: object.kind,
    table: object.table,
    name: object.name,
    status: "unobserved-in-scope",
    externalCheckRequired: true,
  }));
  for (const kind of ["measure", "column", "calculated-column", "table", "hierarchy"]) {
    const group = unused.filter((item) => item.kind === kind);
    if (!group.length) continue;
    addFinding(findings, {
      rule: `unobserved-${kind}`,
      layer: "usage",
      severity: "low",
      confidence: "strong",
      title: `${group.length} ${kind} object(s) have no observed consumer in the audited PBIP`,
      objectIds: group.map((item) => item.id),
      affected: group.slice(0, 50).map((item) => item.table ? `${item.table}[${item.name}]` : item.name),
      evidence: ["No direct PBIR, transitive DAX, or recognized structural consumer was found."],
      recommendation: "Check external reports and clients before deprecating, hiding, or deleting these objects.",
    });
  }

  const bidirectional = model.relationships.filter((item) => /both/i.test(item.crossFilter));
  if (bidirectional.length) {
    addFinding(findings, {
      rule: "bidirectional-relationships",
      layer: "model",
      severity: "medium",
      confidence: "suspected",
      title: `${bidirectional.length} bidirectional relationship(s) require ambiguity and performance review`,
      objectIds: bidirectional.map((item) => item.id),
      affected: bidirectional.map((item) => `${item.from} ↔ ${item.to}`),
      evidence: bidirectional.map((item) => `${item.name}: crossFilteringBehavior=${item.crossFilter}`),
      recommendation: "Confirm each is required by a documented filter path; prefer one-direction relationships where possible.",
    });
  }
  const manyToMany = model.relationships.filter((item) =>
    normalizeName(item.fromCardinality) === "many"
    && normalizeName(item.toCardinality) === "many");
  if (manyToMany.length) {
    addFinding(findings, {
      rule: "many-to-many-relationships",
      layer: "model",
      severity: "medium",
      confidence: "suspected",
      title: `${manyToMany.length} many-to-many relationship(s) require grain and double-counting review`,
      objectIds: manyToMany.map((item) => item.id),
      affected: manyToMany.map((item) => `${item.from} ↔ ${item.to}`),
      evidence: manyToMany.map((item) => item.name),
      recommendation: "Validate business grain and aggregation behavior; use a bridge design when appropriate.",
    });
  }

  const daxRules = [
    ["dax-iterator", /\b(SUMX|AVERAGEX|COUNTX|RANKX)\s*\(/i, "Iterator-heavy measures need measured DAX review"],
    ["dax-filter", /\bFILTER\s*\(/i, "FILTER-based measures need filter-context and timing review"],
    ["dax-lookup", /\b(LOOKUPVALUE|EARLIER)\s*\(/i, "Lookup-style DAX may indicate row-by-row processing"],
  ];
  for (const [rule, regex, title] of daxRules) {
    const affected = model.objects.filter((item) =>
      (item.kind === "measure" || item.kind === "calculated-column")
      && regex.test(item.expression || ""));
    if (!affected.length) continue;
    addFinding(findings, {
      rule,
      layer: "dax",
      severity: "medium",
      confidence: "suspected",
      title: `${title} (${affected.length} object(s))`,
      objectIds: affected.map((item) => item.id),
      affected: affected.slice(0, 50).map((item) => `${item.table}[${item.name}]`),
      evidence: [`Static pattern: ${regex}`],
      recommendation: "Prioritize report-exposed objects and collect execution metrics before rewriting DAX.",
    });
  }

  const calculatedColumns = model.objects.filter((item) => item.kind === "calculated-column");
  if (calculatedColumns.length) {
    addFinding(findings, {
      rule: "calculated-column-placement",
      layer: "calculation-placement",
      severity: "low",
      confidence: "suspected",
      title: `${calculatedColumns.length} calculated column(s) require cross-layer placement review`,
      objectIds: calculatedColumns.map((item) => item.id),
      affected: calculatedColumns.slice(0, 50).map((item) => `${item.table}[${item.name}]`),
      evidence: ["Calculated columns are stored and evaluated during model processing."],
      recommendation: "Move stable row-level logic to readable, testable SQL when the maintainability gate passes; otherwise prefer foldable Power Query and retain DAX only when model semantics require it.",
    });
  }

  const partitions = model.objects.filter((item) => item.kind === "partition");
  const mRules = [
    ["m-table-buffer", /\bTable\.Buffer\s*\(/i, "Table.Buffer can increase memory use and break folding"],
    ["m-add-column-placement", /\bTable\.AddColumn\s*\(/i, "Power Query calculated columns need cross-layer placement review"],
    ["sql-cross-apply", /\bCROSS\s+APPLY\b/i, "CROSS APPLY may remove unmatched rows when used as enrichment"],
    ["sql-select-star", /\bSELECT\s+(?:\w+\.)?\*/i, "SELECT * increases schema and refresh coupling"],
  ];
  for (const [rule, regex, title] of mRules) {
    const affected = partitions.filter((item) => regex.test(item.expression || ""));
    if (!affected.length) continue;
    addFinding(findings, {
      rule,
      layer: rule.startsWith("sql-") ? "source-query" : "power-query",
      severity: rule === "sql-cross-apply" ? "high" : "medium",
      confidence: "suspected",
      title: `${title} (${affected.length} partition(s))`,
      objectIds: affected.map((item) => item.id),
      affected: affected.map((item) => `${item.table}/${item.name}`),
      evidence: [`Static pattern: ${regex}`],
      recommendation: rule === "sql-cross-apply"
        ? "Confirm whether unmatched driving rows must survive; reconcile row counts before and after the apply."
        : rule === "m-add-column-placement"
          ? "Prefer readable, versioned SQL for stable row-level logic when available; otherwise preserve folding and test the M implementation."
          : "Profile folding and source execution before changing the query.",
    });
  }

  const legacy = report.visuals.filter((visual) => LEGACY_VISUALS.has(visual.type));
  if (legacy.length) {
    addFinding(findings, {
      rule: "legacy-visuals",
      layer: "report",
      severity: "low",
      confidence: "strong",
      title: `${legacy.length} legacy visual(s) have modern replacements`,
      objectIds: legacy.map((item) => item.id),
      affected: legacy.slice(0, 50).map((item) => `${item.page}/${item.title || item.name}: ${item.type}`),
      evidence: [...new Set(legacy.map((item) => `${item.type} → ${LEGACY_VISUALS.get(item.type)}`))],
      recommendation: "Migrate only as an approved report change and validate rendering and interactions.",
    });
  }
  const densePages = report.pages.filter((page) => page.visualCount > 25);
  if (densePages.length) {
    addFinding(findings, {
      rule: "dense-pages",
      layer: "report-performance",
      severity: "medium",
      confidence: "suspected",
      title: `${densePages.length} page(s) contain more than 25 visuals`,
      objectIds: densePages.map((page) => page.id),
      affected: densePages.map((page) => `${page.displayName}: ${page.visualCount} visuals`),
      evidence: ["High visual count can increase query fan-out and render work."],
      recommendation: "Measure page load and visual query timings before consolidating or moving content.",
    });
  }

  findings.sort((a, b) =>
    (SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
    || a.id.localeCompare(b.id));
  return { findings, usageRecords, unused };
}

function finalizeEdges(model, ids) {
  return model.dependencies.map((edge) => ({
    from: ids.idByKey.get(edge.fromKey) || null,
    to: ids.idByKey.get(edge.toKey) || null,
    fromKey: edge.fromKey,
    toKey: edge.toKey,
    type: edge.type,
    evidence: edge.evidence,
    status: ids.idByKey.has(edge.toKey) ? "resolved" : "missing",
  }));
}

function fingerprint(files) {
  const hash = crypto.createHash("sha256");
  for (const file of [...files].sort()) {
    hash.update(file);
    hash.update("\0");
    hash.update(fs.readFileSync(file));
    hash.update("\0");
  }
  return hash.digest("hex");
}

function compactObject(object, projectRoot) {
  const output = {
    id: object.id,
    kind: object.kind,
    table: object.table,
    name: object.name,
    hidden: object.hidden ?? null,
    lineageTag: object.lineageTag || null,
    sourceFile: object.sourceFile ? path.relative(projectRoot, object.sourceFile) : null,
  };
  for (const key of [
    "dataType",
    "sourceColumn",
    "mode",
    "sourceType",
    "from",
    "to",
    "active",
    "crossFilter",
    "fromCardinality",
    "toCardinality",
  ]) {
    if (object[key] !== undefined) output[key] = object[key];
  }
  return output;
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function writeJsonl(file, rows) {
  fs.writeFileSync(
    file,
    rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""),
  );
}

function markdownReport(context) {
  const { summary, findings, unused, report, mode } = context;
  const visibleFindings = findings;
  const lines = [
    `# Power BI audit: ${summary.projectName}`,
    "",
    `Mode: **${mode}**  `,
    `Source fingerprint: \`${summary.sourceFingerprint.slice(0, 16)}\`  `,
    `Coverage: ${summary.coverage.join(", ")}`,
    "",
    "## Executive summary",
    "",
    `- ${summary.counts.pages} pages and ${summary.counts.visuals} visuals`,
    `- ${summary.counts.tables} tables, ${summary.counts.columns} columns, ${summary.counts.measures} measures, and ${summary.counts.relationships} relationships`,
    `- ${summary.counts.reportReferences} structured report references (${summary.counts.missingReferences} unresolved)`,
    `- ${findings.filter((item) => item.severity === "critical").length} critical, ${findings.filter((item) => item.severity === "high").length} high, ${findings.filter((item) => item.severity === "medium").length} medium findings`,
    `- ${unused.length} objects have no observed consumer in this PBIP scope; external checks are still required`,
    "",
    "## Report outline",
    "",
    ...report.pages.map((page) =>
      `- ${page.id} **${page.displayName}** — ${page.visualCount} visuals${page.hidden ? " (hidden)" : ""}`),
    "",
    "## Static findings",
    "",
  ];
  if (!visibleFindings.length) {
    lines.push("No static findings were detected. Continue with the complete manual and live audit checklist.");
  } else {
    for (const finding of visibleFindings) {
      lines.push(`### ${finding.id} — ${finding.severity.toUpperCase()}: ${finding.title}`, "");
      lines.push(`Confidence: ${finding.confidence}.`);
      if (finding.affected?.length) {
        lines.push(`Affected: ${finding.affected.slice(0, 12).join(", ")}${finding.affected.length > 12 ? ` (+${finding.affected.length - 12})` : ""}.`);
      }
      lines.push(`Recommendation: ${finding.recommendation}`, "");
    }
  }
  lines.push(
    "## Coverage limitations",
    "",
    "- This static scan does not prove business intent, query folding, cardinality, refresh duration, DAX runtime, or visual render time.",
    "- Calculation placement requires a semantic, governance, deployment, testability, and maintainability decision across SQL, Power Query, and DAX.",
    "- This baseline does not fully parse or validate every RLS/OLS, calculation-group, perspective, culture, bookmark, interaction, or external-consumer contract; the comprehensive audit must inspect them.",
    "- \"Unobserved\" does not mean globally safe to delete; other reports and external clients may consume the model.",
    "- Complete the comprehensive checklist and use live/source/rendered validation for every material conclusion.",
    "",
    "## Indexed evidence",
    "",
    "`summary.json`, `objects.jsonl`, `dependencies.jsonl`, `report-usage.jsonl`, `visuals.jsonl`, `unused.jsonl`, and `findings.jsonl`.",
    "",
  );
  return lines.join("\n");
}

function scan(target, options) {
  const mode = options.mode || "full";
  if (mode !== "full") {
    throw new Error(`Invalid mode: ${mode}`);
  }
  const project = resolveProject(target);
  const outDir = path.resolve(options.out || path.join(project.projectRoot, ".powerbi-audit"));
  if (outDir === project.projectRoot || outDir === project.reportDir || outDir === project.modelDir) {
    throw new Error("--out must not overwrite the project, report, or model directory.");
  }
  fs.mkdirSync(outDir, { recursive: true });

  const report = parseReport(project.reportDir);
  const model = buildModel(project.modelDir);
  const ids = assignIds(model, report);
  const analysis = analyze(model, report, ids);
  const edges = finalizeEdges(model, ids);
  const sourceFiles = [...report.reportFiles, ...model.modelFiles];
  const sourceFingerprint = fingerprint(sourceFiles);
  const objects = ids.objects.map((object) => compactObject(object, project.projectRoot));
  const visuals = report.visuals.map((visual) => ({
    id: visual.id,
    pageId: ids.idByKey.get(visual.pageKey),
    page: visual.page,
    name: visual.name,
    type: visual.type,
    title: visual.title,
    hidden: visual.hidden,
    position: {
      x: visual.x,
      y: visual.y,
      width: visual.width,
      height: visual.height,
    },
    sourceFile: path.relative(project.projectRoot, visual.sourceFile),
  }));
  const missingReferences = analysis.usageRecords.filter((item) => item.status === "missing").length;
  const staleMetadataReferences = analysis.usageRecords
    .filter((item) => item.status === "stale-metadata").length;
  const summary = {
    schemaVersion: 1,
    toolVersion: VERSION,
    generatedAt: new Date().toISOString(),
    mode,
    projectName: project.projectName,
    projectRoot: project.projectRoot,
    reportDir: project.reportDir,
    modelDir: project.modelDir,
    sourceFingerprint,
    coverage: [
      project.reportDir ? "static-pbir" : null,
      project.modelDir ? "static-tmdl" : null,
    ].filter(Boolean),
    liveEvidence: false,
    counts: {
      pages: report.pages.length,
      visuals: report.visuals.length,
      tables: model.objects.filter((item) => item.kind === "table").length,
      columns: model.objects.filter((item) =>
        item.kind === "column" || item.kind === "calculated-column").length,
      calculatedColumns: model.objects.filter((item) => item.kind === "calculated-column").length,
      measures: model.objects.filter((item) => item.kind === "measure").length,
      partitions: model.objects.filter((item) => item.kind === "partition").length,
      relationships: model.relationships.length,
      reportReferences: analysis.usageRecords.length,
      missingReferences,
      staleMetadataReferences,
      findings: analysis.findings.length,
      unusedInScope: analysis.unused.length,
    },
    severity: Object.fromEntries(Object.keys(SEVERITY_ORDER).map((severity) => [
      severity,
      analysis.findings.filter((item) => item.severity === severity).length,
    ])),
    artifacts: {
      markdown: "audit.md",
      objects: "objects.jsonl",
      dependencies: "dependencies.jsonl",
      reportUsage: "report-usage.jsonl",
      visuals: "visuals.jsonl",
      findings: "findings.jsonl",
      unused: "unused.jsonl",
    },
  };

  writeJson(path.join(outDir, "summary.json"), summary);
  writeJsonl(path.join(outDir, "objects.jsonl"), objects);
  writeJsonl(path.join(outDir, "dependencies.jsonl"), edges);
  writeJsonl(path.join(outDir, "report-usage.jsonl"), analysis.usageRecords);
  writeJsonl(path.join(outDir, "visuals.jsonl"), visuals);
  writeJsonl(path.join(outDir, "findings.jsonl"), analysis.findings);
  writeJsonl(path.join(outDir, "unused.jsonl"), analysis.unused);
  fs.writeFileSync(
    path.join(outDir, "audit.md"),
    `${markdownReport({
      summary,
      findings: analysis.findings,
      unused: analysis.unused,
      report,
      mode,
    })}\n`,
  );
  process.stdout.write(`${JSON.stringify({
    status: "ok",
    auditDir: outDir,
    sourceFingerprint,
    counts: summary.counts,
    severity: summary.severity,
  })}\n`);
}

function loadJsonl(file) {
  if (!fs.existsSync(file)) throw new Error(`Evidence file not found: ${file}`);
  return fs.readFileSync(file, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`Invalid JSONL at ${file}:${index + 1}: ${error.message}`);
      }
    });
}

function evidence(auditDirInput, kind, options) {
  const auditDir = path.resolve(auditDirInput);
  const limit = Number.parseInt(options.limit || "30", 10);
  if (!Number.isFinite(limit) || limit < 1) {
    throw new Error("--limit must be a positive integer.");
  }
  if (kind === "summary") {
    process.stdout.write(`${JSON.stringify(readJson(path.join(auditDir, "summary.json")))}\n`);
    return;
  }
  const files = {
    findings: "findings.jsonl",
    unused: "unused.jsonl",
    visual: "visuals.jsonl",
    object: "objects.jsonl",
    dependencies: "dependencies.jsonl",
  };
  if (!files[kind]) throw new Error(`Unknown evidence kind: ${kind}`);
  let rows = loadJsonl(path.join(auditDir, files[kind]));
  if (options.severity) {
    const allowed = new Set(String(options.severity).split(",").map(normalizeName));
    rows = rows.filter((row) => allowed.has(normalizeName(row.severity)));
  }
  if (options.type) {
    rows = rows.filter((row) =>
      normalizeName(row.kind || row.type) === normalizeName(options.type));
  }
  if (options.page) {
    rows = rows.filter((row) =>
      normalizeName(row.page).includes(normalizeName(options.page)));
  }
  if (options.query) {
    const query = normalizeName(options.query);
    rows = rows.filter((row) => normalizeName(JSON.stringify(row)).includes(query));
  }
  rows = rows.slice(0, limit);
  process.stdout.write(
    rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""),
  );
}

function main() {
  const [command, ...rest] = process.argv.slice(2);
  try {
    if (!command || command === "--help" || command === "-h" || command === "help") {
      usage();
    } else if (command === "scan") {
      const { positional, options } = parseOptions(rest);
      if (!positional[0]) fail("scan requires a target.");
      scan(positional[0], options);
    } else if (command === "evidence") {
      const { positional, options } = parseOptions(rest);
      if (!positional[0] || !positional[1]) {
        fail("evidence requires <audit-dir> and an evidence kind.");
      }
      evidence(positional[0], positional[1], options);
    } else {
      fail(`Unknown command: ${command}`);
    }
  } catch (error) {
    fail(error.message);
  }
}

export { evidence, resolveProject, scan };

if (path.resolve(process.argv[1] || "") === fileURLToPath(import.meta.url)) main();
