# Immunity — Usage Guide

## /immunity:contracts — Self-Verifying Agent Memory

### Create Contracts

```
# Analyze code and get contract proposals
/immunity:contracts src/services/payment/

# Analyze entire project
/immunity:contracts

# Create a contract from natural language
/immunity:contracts add "All API responses must follow { success, data, error } format" --scope "src/controllers/**"
```

Claude analyzes the code, Grep-scans for existing patterns, and proposes contracts with evidence. The user selects which to create, and YAML files are generated in `.contracts/`.

### Verify Contracts

```
# Verify all contracts (deterministic — Grep/Glob/Bash only, no LLM)
/immunity:contracts verify

# Verify specific scope
/immunity:contracts verify src/auth/

# Verify specific contract
/immunity:contracts verify payment-idempotency
```

### Manage Contracts

```
# List all contracts
/immunity:contracts list

# Remove a contract
/immunity:contracts remove payment-idempotency
```

---

## /immunity:critic — Adversarial Code Review

### Basic Usage

```
# Review recent changes (git diff based)
/immunity:critic

# Review specific file
/immunity:critic src/services/payment/charge.ts

# Review specific directory
/immunity:critic src/auth/

# Review multiple files
/immunity:critic src/services/payment/charge.ts src/services/payment/refund.ts
```

### Interpreting Results

```
[SCAN]   — Found by deterministic Grep scan. Reproducible.
[REVIEW] — Found by LLM analysis. Judgment-based.

Critical — Fix immediately. Actual bugs or security vulnerabilities.
Warning  — Review recommended. May cause issues under certain conditions.

Confidence:
  certain (95%+) — Clearly a problem just from the code
  likely (75-95%) — A problem in most cases
```

### What is NOT reported

- Code style, naming preferences
- "There's a better way" level suggestions
- Theoretically possible but extremely unlikely issues
- Issues linters/type checkers already catch
- Lack of comments/documentation

---

## /immunity:ripple — Change Impact Chain Verification

### Basic Usage

```
# Analyze impact of a specific file
/immunity:ripple src/services/UserService.ts

# Analyze based on recent changes (git diff)
/immunity:ripple
```

### Interpreting Results

```
Ripple Map:
├── Direct [SCAN]       — Files found by Grep (import/call relationships)
├── Behavioral [REVIEW] — Files found by LLM pattern analysis
└── Contract [SCAN]     — Related contracts matched by scope
```

### Chain Verification

After the Ripple Map is shown, agree to "Run chain verification?" and affected files are checked in order.

---

## /immunity:prodlens — Production Readiness Lens

### Basic Usage

```
# Analyze a specific module
/immunity:prodlens src/services/payment/

# Analyze a specific file
/immunity:prodlens src/services/payment/charge.ts

# Analyze entire project (may take longer)
/immunity:prodlens
```

### 6-Axis Results

```
[SCAN]   — Found by deterministic Grep/Glob scan
[REVIEW] — Found by LLM production analysis

✓ PASS    — No issues for this axis
△ PARTIAL — Partially meets criteria. Improvement recommended
✗ FAIL    — Likely to cause issues in production

Production Readiness: N/6
Scan findings: N / Review findings: N
```

---

## Recommended Workflow

### During Feature Development

```
1. Write code
2. /immunity:critic          → Check for bugs → Fix
3. /immunity:ripple          → Check blast radius → Fix related code
4. /immunity:prodlens        → Check production readiness → Harden
5. /immunity:contracts       → Save important decisions as contracts
6. Commit
```

### During Refactoring

```
1. Modify code
2. /immunity:contracts verify → Check existing contract violations
3. /immunity:ripple           → Check blast radius
4. /immunity:critic           → Check for new bugs after changes
5. Commit
```

### For Code Review

```
1. /immunity:critic src/      → Full adversarial review
2. /immunity:prodlens src/    → Production perspective check
```

---

## Tips

### Commit contracts to git

```bash
git add .contracts/
git commit -m "Add immunity contracts for payment module"
```

The entire team's AI agents will respect the same contracts.

### /immunity:critic is most effective right after writing code

Code just written has the strongest author bias. Running /immunity:critic at this point provides the most value.

### Store the "obvious" rules as contracts

The things you think "everyone knows" are what break most often. Rules like "API responses always use the envelope format" are ideal contracts.

### Trust [SCAN] findings more

`[SCAN]` findings are deterministic — they come from Grep/Glob and are reproducible. `[REVIEW]` findings are LLM judgment — valuable but not guaranteed. When prioritizing fixes, start with `[SCAN]` findings.
