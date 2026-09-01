# Remediation Safety Contract

## Required controls

1. Require explicit approved finding IDs.
2. Confirm the audit source fingerprint still matches.
3. Retrieve direct and transitive consumers before editing.
4. Prefer the smallest behavior-preserving change.
5. Apply and validate one dependency-safe change set at a time.
6. Keep a reversible before-state.
7. Roll back immediately on validation failure.
8. Regenerate the static audit after changes.

## Deletion controls

Absence from the audited PBIR is insufficient. Before deleting, check semantic
dependencies, all reports bound to the model, perspectives, calculation groups,
field parameters, Analyze in Excel/external clients where applicable, and
deployment consumers. If that scope is incomplete, propose deprecation or
hiding instead of deletion.

## Security controls

Treat RLS/OLS definitions as dependencies and potential behavior contracts.
Apply a security-definition change only when its finding was specifically
approved, the intended access contract is documented, and representative
identity tests are available. Role membership, workspace access, and item
permissions require separate explicit authorization.

## Correctness controls

For logic changes, define expected behavior before editing and validate with at
least one invariant, boundary case, or source reconciliation. A faster result
that changes business meaning is a failed optimization.

## Performance controls

Capture comparable before/after evidence at the same scope and data state.
Separate source, Power Query, processing, DAX, and visual-render timings. Do
not claim an improvement based only on a code-pattern change.

## Calculation placement controls

Evaluate SQL, Power Query, and DAX by semantics, governance, deployment,
testability, reuse, and maintainability. Before moving a calculation, prove
semantic equivalence and record why the selected owner is better and why the
alternatives were rejected.

Do not approve a SQL rewrite solely because it is faster. Require explicit
grain, named stages, source-level tests, versionable code, comparable execution
evidence, and a rollback path. Treat temp tables and indexes as valid measured
tools, not automatic defects or automatic solutions.
