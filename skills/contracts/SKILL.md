---
name: contracts
description: Creates self-verifying agent memory by storing important decisions as executable contracts that automatically detect violations across sessions.
---

# /contracts — Self-Verifying Agent Memory

This skill turns important decisions into **executable contracts**. Unlike CLAUDE.md which is a request, a contract **catches violations**.

When an agent decides "payments must be idempotent", that decision becomes a verifiable rule stored as a YAML file in `.contracts/`. The next session's agent — or a different team member's agent — will be automatically notified if they violate this contract.

## Execution Steps

### Step 1: Parse Arguments

When the user runs `/contracts`, check the arguments:

- `/contracts <path>` — Analyze code at path and propose contracts
- `/contracts verify` — Verify all contracts (go to Verify Flow)
- `/contracts verify <path>` — Verify contracts for specific scope
- `/contracts verify <contract-name>` — Verify a specific contract
- `/contracts list` — List all contracts
- `/contracts remove <contract-name>` — Remove a contract
- `/contracts add "<assertion>" --scope "<glob>"` — Create a contract from natural language
- `/contracts` (no args) — Analyze recent git changes and propose contracts. If no changes found, ask the user for a path.

### Step 1.5: Ensure .contracts/ Directory Exists

Before any operation (create, verify, list, remove), check if `.contracts/` exists in the project root. If it doesn't:

- For **create/add**: Create `.contracts/` directory and an empty `CONTRACTS.md` index file inside it.
- For **verify/list**: Report "No contracts found. Run `/immunity:contracts <path>` to create your first contract."
- For **remove**: Report "No contracts found."

### Step 2: Create Contracts (default flow)

**Resolving target files:**
- If the user provided a path: use that path
- If no args: run `git diff HEAD --name-only` to get recently changed files
- If git diff returns nothing: ask the user to provide a target path before continuing. Do NOT proceed without targets.

1. Read the target files using the Read tool
2. Analyze the code and identify **important invariants** — things that should always be true:
   - Data validation rules (amount > 0, required fields)
   - Security requirements (auth checks, input sanitization)
   - Architectural patterns (error handling, transaction boundaries)
   - API contracts (response format, status codes)
   - Business rules (idempotency, rate limits)

3. Propose contracts to the user:

```
I analyzed src/services/payment/ and suggest these contracts:

  1. payment-idempotency
     "All payment requests must include an idempotency key"
     scope: src/services/payment/**

  2. payment-amount-validation
     "Payment amount must be greater than 0 and less than or equal to 10,000,000"
     scope: src/services/payment/**

  3. payment-error-recovery
     "Payment failures must trigger a transaction rollback"
     scope: src/services/payment/**

Add, modify, or skip any?
```

4. The user selects which contracts to create (or adds custom ones in natural language)

5. For each selected contract, generate a YAML file:

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
    pattern: "charge\\(.*\\)(?!.*idempotency)"
    in: "src/services/payment/**"
created_by: "claude-session"
created_at: "ISO-8601-date"
```

6. Write the file to `.contracts/<contract-name>.yml`
7. Update `.contracts/CONTRACTS.md` index

### Check Types

Use these check types when generating contracts:

| Type | Description | Fields |
|------|-------------|--------|
| `pattern_present` | Pattern MUST exist in scope | `pattern`, `in` |
| `pattern_absent` | Pattern must NOT exist in scope | `pattern`, `in` |
| `test_pass` | Test command must pass | `command` |
| `file_exists` | File must exist | `path` |
| `command_success` | Command must exit 0 | `command` |
| `json_match` | JSON/YAML field must match condition | `path`, `field`, `condition` |

### Verify Flow

When the user runs `/contracts verify`:

1. Read all `.contracts/*.yml` files
2. For each contract, execute its checks:
   - `pattern_present` → Use Grep to verify pattern exists in scope
   - `pattern_absent` → Use Grep to verify pattern does NOT exist in scope
   - `test_pass` → Use Bash to run the test command
   - `file_exists` → Use Glob to check file existence
   - `command_success` → Use Bash to run command, check exit code
   - `json_match` → Use Read to check JSON field value

3. Output results:

```
── Contract Verification ──

✓ payment-idempotency        — passed
✗ payment-error-recovery     — violation: no rollback in catch block (charge.ts:78)
✓ api-response-format        — passed

Score: 2/3 passing

Fix violations?
```

4. If the user agrees, fix the violations in order.

### CONTRACTS.md Index Format

```markdown
# Contracts

| Contract | Assertion | Scope | Status |
|----------|-----------|-------|--------|
| payment-idempotency | All payment requests must include an idempotency key | src/services/payment/** | active |
| api-response-format | All API responses must follow { success, data, error } format | src/controllers/** | active |
```

### Important Rules

- **Propose, don't impose.** Always let the user choose which contracts to create.
- **Prefer simple checks.** `pattern_present` and `pattern_absent` cover most cases. Don't over-engineer.
- **One contract, one concern.** Each contract should verify exactly one invariant.
- **Contracts must be git-committable.** The `.contracts/` directory is meant to be shared with the team.
- **Don't create duplicate contracts.** Check existing `.contracts/` before creating new ones.
