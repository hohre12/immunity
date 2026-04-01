# Immunity — Usage Guide

## /contracts — Self-Verifying Agent Memory

### Create Contracts

```
# Analyze code and get contract proposals
/contracts src/services/payment/

# Analyze entire project
/contracts

# Create a contract from natural language
/contracts add "All API responses must follow { success, data, error } format" --scope "src/controllers/**"
```

Claude analyzes the code and proposes contract candidates. The user selects which to create, and YAML files are generated in `.contracts/`.

### Verify Contracts

```
# Verify all contracts
/contracts verify

# Verify specific scope
/contracts verify src/auth/

# Verify specific contract
/contracts verify payment-idempotency
```

### Manage Contracts

```
# List all contracts
/contracts list

# Remove a contract
/contracts remove payment-idempotency
```

---

## /critic — Adversarial Code Review

### Basic Usage

```
# Review recent changes (git diff based)
/critic

# Review specific file
/critic src/services/payment/charge.ts

# Review specific directory
/critic src/auth/

# Review multiple files
/critic src/services/payment/charge.ts src/services/payment/refund.ts
```

### Interpreting Results

```
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

## /ripple — Change Impact Chain Verification

### Basic Usage

```
# Analyze impact of a specific file
/ripple src/services/UserService.ts

# Analyze based on recent changes (git diff)
/ripple
```

### Interpreting Results

```
Ripple Map:
├── Direct      — Files connected by import/call relationships
├── Behavioral  — Files using the same code patterns
└── Contract    — Related contracts (.contracts/ files)
```

### Chain Verification

After the Ripple Map is shown, agree to "Run chain verification?" and affected files are checked in order.

---

## /prodlens — Production Readiness Lens

### Basic Usage

```
# Analyze a specific module
/prodlens src/services/payment/

# Analyze a specific file
/prodlens src/services/payment/charge.ts

# Analyze entire project (may take longer)
/prodlens
```

### 6-Axis Results

```
✓ PASS    — No issues for this axis
△ PARTIAL — Partially meets criteria. Improvement recommended
✗ FAIL    — Likely to cause issues in production

Production Readiness: N/6
```

---

## Recommended Workflow

### During Feature Development

```
1. Write code
2. /critic          → Check for bugs → Fix
3. /ripple          → Check blast radius → Fix related code
4. /prodlens        → Check production readiness → Harden
5. /contracts       → Save important decisions as contracts
6. Commit
```

### During Refactoring

```
1. Modify code
2. /contracts verify → Check existing contract violations
3. /ripple           → Check blast radius
4. /critic           → Check for new bugs after changes
5. Commit
```

### For Code Review

```
1. /critic src/      → Full adversarial review
2. /prodlens src/    → Production perspective check
```

---

## Tips

### Commit contracts to git

```bash
git add .contracts/
git commit -m "Add immunity contracts for payment module"
```

The entire team's AI agents will respect the same contracts.

### /critic is most effective right after writing code

Code just written has the strongest author bias. Running /critic at this point provides the most value.

### Store the "obvious" rules as contracts

The things you think "everyone knows" are what break most often. Rules like "API responses always use the envelope format" are ideal contracts.
