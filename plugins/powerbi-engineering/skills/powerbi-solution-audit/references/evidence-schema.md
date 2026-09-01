# Evidence Schema

## Contents

- Files
- Stable IDs
- Finding fields
- Dependency fields
- Incremental reuse

## Files

The scanner writes:

- `summary.json`: compact counts, coverage, source fingerprint, and artifact
  paths.
- `objects.jsonl`: semantic-model objects.
- `dependencies.jsonl`: directed semantic-model dependency edges.
- `report-usage.jsonl`: structured report-to-model references.
- `visuals.jsonl`: compact page/visual inventory.
- `findings.jsonl`: deterministic static findings.
- `unused.jsonl`: objects without an observed consumer in the audited scope.
- `audit.md`: human-readable summary of the scan.

The scanner is a static baseline. The comprehensive audit adds the artifacts
defined in `deliverable-contract.md` at the parent `.powerbi-audit/` level.

JSONL files contain one compact JSON object per line and are intended to be
filtered before loading into model context.

## Stable IDs

- `T#`: table
- `C#`: column
- `M#`: measure
- `PT#`: partition
- `H#`: hierarchy
- `R#`: relationship
- `ROLE#`: role or security definition when inventoried
- `CG#`: calculation group/item when inventoried
- `P#`: report page
- `V#`: visual

IDs are assigned from deterministic sorted object names within a scan. Use the
source fingerprint to determine whether IDs can be reused across scans.

## Finding fields

```json
{
  "id": "PBI-RULE-12ab34cd",
  "rule": "missing-report-reference",
  "layer": "report-model-contract",
  "severity": "critical",
  "confidence": "strong",
  "title": "Report references a missing object",
  "objectIds": ["V8"],
  "affected": ["Measures[Net Revenue]"],
  "evidence": ["P2/V8 queryState.Values"],
  "recommendation": "Restore or replace the binding and validate the visual."
}
```

## Dependency fields

```json
{
  "from": "M8",
  "to": "C17",
  "type": "dax-reference",
  "evidence": "Sales[Amount]"
}
```

Edges point from consumer to dependency. Direct report usage seeds the
transitive walk; following outgoing dependency edges identifies required
downstream objects.

## Evidence extensions

Live or manually verified evidence should use the same stable object names and
finding IDs and add:

- evidence class;
- environment and timestamp;
- test/query identifier;
- parameters, filters, identity, and cache state;
- observed result or timing;
- artifact path;
- limitation or timeout status.

## Incremental reuse

`sourceFingerprint` hashes relevant PBIR JSON and TMDL content. Reuse an audit
only when the fingerprint matches and the live environment/data state remains
appropriate for the conclusion. Revalidate affected reverse dependents after
any source change.
