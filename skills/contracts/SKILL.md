---
name: contracts
description: Creates self-verifying agent memory by storing important decisions as executable contracts. Verification uses deterministic checks (Grep, Glob, Bash) that work without LLM judgment.
---

# /contracts — Self-Verifying Agent Memory

This skill turns important decisions into **executable contracts**. Unlike CLAUDE.md which is a request, a contract **catches violations**.

When an agent decides "payments must be idempotent", that decision becomes a verifiable rule stored as a YAML file in `.contracts/`. The next session's agent — or a different team member's agent — will be automatically notified if they violate this contract.

**Key difference from other skills:** Contract verification is **deterministic**. When you run `/immunity:contracts verify`, it uses Grep, Glob, and Bash — not LLM judgment. The results are reproducible.

## Execution Steps

### Step 1: Parse Arguments

When the user runs `/contracts`, check the arguments:

- `/contracts <path>` — Analyze code at path and propose contracts
- `/contracts verify` — Verify all contracts (go to Verify Flow)
- `/contracts verify <path>` — Verify contracts for specific scope only
- `/contracts verify <contract-name>` — Verify a specific contract
- `/contracts list` — List all contracts
- `/contracts remove <contract-name>` — Remove a contract
- `/contracts add "<assertion>" --scope "<glob>"` — Create a contract directly from natural language (go to Add Flow)
- `/contracts` (no args) — Analyze recent git changes and propose contracts. If no changes found, ask the user for a path.

### Step 1.5: Ensure .contracts/ Directory Exists

Before any operation (create, verify, list, remove), check if `.contracts/` exists in the project root. If it doesn't:

- For **create/add**: Create `.contracts/` directory and an empty `CONTRACTS.md` index file inside it. Inform the user: "Created `.contracts/` directory. This is where your contracts will be stored. You can commit this directory to git so your team's agents share the same rules."
- For **verify/list**: Report "No contracts found. Run `/immunity:contracts <path>` to create your first contract."
- For **remove**: Report "No contracts found."

### Step 2: Create Contracts (default flow)

**Resolving target files:**
- If the user provided a path: use that path
- If no args: run `git diff HEAD --name-only` to get recently changed files
- If git diff returns nothing: ask the user to provide a target path before continuing. Do NOT proceed without targets.

#### 2a. Read and Analyze Target Files

Read the target files using the Read tool. Identify **important invariants** — things that should always be true:
- Data validation rules (amount > 0, required fields)
- Security requirements (auth checks, input sanitization)
- Architectural patterns (error handling, transaction boundaries)
- API contracts (response format, status codes)
- Business rules (idempotency, rate limits)

#### 2b. Scan for Existing Patterns

Before proposing contracts, use tools to confirm the patterns actually exist:

```
For each candidate invariant, use Grep to verify:
- "The pattern I'm about to propose as a contract — does it actually exist in the code right now?"
- This prevents proposing contracts for things the code doesn't currently do.
```

Example: If proposing "all payments must include idempotency key":
```
Grep for: idempotencyKey|idempotency_key in src/services/payment/**
→ Found at charge.ts:15, refund.ts:22
→ Good: pattern exists, contract is valid
→ If NOT found: don't propose this contract
```

#### 2c. Propose Contracts

```
I analyzed src/services/payment/ and found these existing patterns worth preserving:

  1. payment-idempotency
     "All payment requests must include an idempotency key"
     scope: src/services/payment/**
     evidence: found in charge.ts:15, refund.ts:22

  2. payment-amount-validation
     "Payment amount must be greater than 0 and less than or equal to 10,000,000"
     scope: src/services/payment/**
     evidence: found in charge.ts:8

Add, modify, or skip any?
```

Note: Include **evidence** — the actual lines where the pattern was found. This proves the contract is based on reality, not hallucination.

#### 2d. Generate Contract Files

The user selects which contracts to create (or adds custom ones in natural language).

For each selected contract, generate a YAML file:

```yaml
name: payment-idempotency
assertion: "All payment requests must include an idempotency key"
scope:
  - "src/services/payment/**"
checks:
  - type: pattern_present
    pattern: "idempotencyKey|idempotency_key|IdempotencyKey"
    in: "src/services/payment/**"
  - type: pattern_absent
    pattern: "charge\\(.*\\)"
    in: "src/services/payment/**"
    exclude_if_also_matches: "idempotency"
created_by: "claude-session"
created_at: "ISO-8601-date"
```

Write the file to `.contracts/<contract-name>.yml` and update `.contracts/CONTRACTS.md` index.

### Add Flow (for `/contracts add`)

When the user runs `/contracts add "<assertion>" --scope "<glob>"`:

1. **Skip Steps 2a and 2b entirely.** The user is explicitly defining the contract — no code analysis needed.
2. Convert the assertion into a contract name (kebab-case, derived from key words).
3. Determine the appropriate check type:
   - If the assertion mentions something that "must exist" or "must include" → `pattern_present`. Ask the user: "What pattern should I look for? (e.g., `idempotencyKey`)"
   - If the assertion mentions something that "must not" or "should never" → `pattern_absent`. Ask the user for the pattern.
   - If unsure which check type fits → ask the user.
4. Generate the YAML file and write to `.contracts/`.
5. Update `.contracts/CONTRACTS.md` index.

### Check Types

Use these check types when generating contracts. **All are deterministic — no LLM needed for verification.**

| Type | Description | Tool used | Fields |
|------|-------------|-----------|--------|
| `pattern_present` | Pattern MUST exist in scope | Grep | `pattern`, `in` |
| `pattern_absent` | Pattern must NOT exist in scope (use simple patterns only — no lookahead) | Grep | `pattern`, `in`, optional `exclude_if_also_matches` |
| `test_pass` | Test command must pass | Bash | `command` |
| `file_exists` | File must exist | Glob | `path` |
| `command_success` | Command must exit 0 | Bash | `command` |
| `json_match` | JSON/YAML field must match condition | Read + Bash | `path`, `field`, `operator`, `value` |

### Verify Flow

When the user runs `/contracts verify`:

**This is entirely deterministic. Execute each check using the specified tool. No LLM judgment needed.**

**Filtering:**
- `/contracts verify` (no args) → verify ALL contracts
- `/contracts verify <path>` → verify only contracts whose `scope` field matches the given path. Read each contract's scope and skip contracts that don't include the path.
- `/contracts verify <contract-name>` → verify only `.contracts/<contract-name>.yml`. If the file doesn't exist, report "Contract not found: <contract-name>"

**Execution:**

1. Use Glob to find `.contracts/*.yml` files (apply filter above)
2. Read each contract file
3. For each contract, execute its checks:
   - `pattern_present` → Use Grep to search for the pattern in the scope. If Grep returns results, the check passes. If no results, it fails.
   - `pattern_absent` → Use Grep with `-n` (line numbers) to search for the pattern in the scope. If Grep returns NO results, the check passes. If results found AND `exclude_if_also_matches` is set, for each matching line: use Read to read that specific line (offset=line_number, limit=1), then check if the exclusion pattern appears in that line's content. If it does, the match is exempt (skip it). If any non-exempt matches remain, the check fails — report the file:line. **Use simple regex only. Do NOT use lookahead (?!...) or lookbehind (?<!...) — ripgrep's default engine does not support these.**
   - `test_pass` → Use Bash to run the test command. Exit code 0 = pass, non-zero = fail.
   - `file_exists` → Use Glob to check if the file exists. Found = pass, not found = fail.
   - `command_success` → Use Bash to run the command. Exit code 0 = pass, non-zero = fail.
   - `json_match` → Use Read to open the file, extract the field value using dot notation (e.g., `dependencies.axios`). Then apply the operator: `exists` (field is present), `equals` (field === value), `contains` (field includes value as substring), `gte` (field >= value, numeric), `lte` (field <= value, numeric). All operators are deterministic — no LLM interpretation needed.

**json_match operators:**
| Operator | Passes when | Example |
|----------|------------|---------|
| `exists` | Field is present in the file | `field: "scripts.test", operator: "exists"` |
| `equals` | Field value === value | `field: "engine.node", operator: "equals", value: ">=18"` |
| `contains` | Field value includes value as substring | `field: "scripts.test", operator: "contains", value: "jest"` |
| `gte` | Field value >= value (numeric) | `field: "pool.max", operator: "gte", value: 5` |
| `lte` | Field value <= value (numeric) | `field: "pool.max", operator: "lte", value: 100` |

4. Output results:

```
── Contract Verification ──

✓ payment-idempotency        — passed (pattern found in 3 files)
✗ payment-error-recovery     — VIOLATION
  └── pattern_present check failed: "rollback|ROLLBACK" not found in src/services/payment/charge.ts
✓ api-response-format        — passed (pattern found in 12 files)

Score: 2/3 passing

Fix violations?
```

5. If the user agrees, fix the violations in order.

### CONTRACTS.md Index Format

```markdown
# Contracts

| Contract | Assertion | Scope | Checks | Status |
|----------|-----------|-------|--------|--------|
| payment-idempotency | All payment requests must include an idempotency key | src/services/payment/** | pattern_present | active |
| api-response-format | All API responses must follow { success, data, error } format | src/controllers/** | pattern_present | active |
```

### Important Rules

- **Propose, don't impose.** Always let the user choose which contracts to create.
- **Show evidence.** When proposing a contract, show the file:line where the pattern currently exists.
- **Verify before proposing.** Use Grep to confirm the pattern exists before suggesting it as a contract. Never propose a contract based on assumption.
- **Prefer simple checks.** `pattern_present` and `pattern_absent` cover most cases. Don't over-engineer.
- **One contract, one concern.** Each contract should verify exactly one invariant.
- **Verification is deterministic.** Never use LLM judgment in the verify flow. Grep/Glob/Bash only.
- **Contracts must be git-committable.** The `.contracts/` directory is meant to be shared with the team.
- **Don't create duplicate contracts.** Check existing `.contracts/` before creating new ones.
