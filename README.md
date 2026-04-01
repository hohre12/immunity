# Immunity

**The immune system for AI-generated code.** Remember. Detect. Strengthen.

[한국어](./README.ko.md)

---

## What is Immunity?

When AI agents write code, three problems keep recurring:

1. **Memory loss** — Decisions made in session A are unknown to the agent in session B
2. **Self-confirmation bias** — The agent that wrote the code can't truly critique its own work
3. **Production blindness** — Agents build code that "works" but won't survive production

Immunity solves these with **4 independent skills**:

| Skill | Problem it solves | Biological analogy |
|-------|-------------------|-------------------|
| `/contracts` | Agent memory | Immune memory — remembers past pathogens |
| `/critic` | Critical verification | Immune response — detects and attacks anomalies |
| `/ripple` | Chain verification | Immune propagation — traces infection paths |
| `/prodlens` | Production hardening | Immune adaptation — builds stronger antibodies |

Each works independently. Install one or all four.

---

## Installation

```bash
# Add the marketplace and install
/plugin marketplace add hohre12/immunity
/plugin install immunity@hohre12-immunity
```

Or install from local directory for development:

```bash
git clone https://github.com/hohre12/immunity.git
claude --plugin-dir ./immunity
```

**No servers. No databases. No runtime.** Just markdown files.

---

## Quick Start

### Get an adversarial code review

```
/critic src/services/payment/charge.ts
```

An independent agent finds bugs you missed — in 30 seconds.

### Remember important decisions

```
/contracts src/services/payment/
```

Decisions like "payments must be idempotent" become verifiable contracts. The next session's agent that violates this contract gets caught automatically.

### Check the blast radius of a change

```
/ripple src/services/UserService.ts
```

Automatically finds what else needs to be checked when you change UserService.

### Check production readiness

```
/prodlens src/services/payment/
```

Concurrency, error recovery, observability, security — concrete gaps from a production perspective.

---

## How It Works

### /contracts — Self-Verifying Agent Memory

Writing "please do X" in CLAUDE.md is a **request**. A contract **catches violations**.

```yaml
# .contracts/payment-idempotency.yml
name: payment-idempotency
assertion: "All payment requests must include an idempotency key"
scope:
  - "src/services/payment/**"
checks:
  - type: pattern_present
    pattern: "idempotencyKey|idempotency_key"
    in: "src/services/payment/**"
```

When an agent modifies files in scope, hooks automatically check related contracts.

### /critic — Adversarial Code Review

The key is **context isolation**.

```
Current Claude              →   Code ONLY   →   Critic sub-agent
(knows why it was built)        (reason blocked)   (judges code alone)
```

Because the critic doesn't know why the code was written, the bias of "the user wanted this, so it must be fine" is structurally impossible.

**Reporting criteria:**
- Only `certain` (95%+) or `likely` (75-95%) confidence
- No code style, naming, or comment preferences
- If unsure, don't report — one false positive destroys trust

### /ripple — Change Impact Chain Verification

Import graphs aren't enough. They miss code using the same patterns.

```
UserService.update() changed
├── Direct: UserController (import relationship)
├── Behavioral: OrderService.update() (same pattern: optimistic lock + event emission)
└── Contract: user-data-integrity (needs re-verification)
```

Claude reads code and identifies patterns. Not perfect, but far better than checking nothing.

### /prodlens — Production Readiness Lens

Analyzes across 6 fixed axes:

| Axis | What it checks |
|------|---------------|
| Concurrency | Race conditions, deadlocks, isolation levels |
| Error Recovery | Failure recovery paths, transaction consistency |
| Observability | Logging, metrics, alerting |
| Security | Injection, auth bypass, information exposure |
| Rate Limiting | External API limits, user request limits |
| Input Validation | Boundary values, types, sizes |

---

## Before / After

**Before (without Immunity):**

```
Session 1: Claude writes payment logic. Includes idempotency key.
Session 2: Different Claude modifies payment logic. Removes idempotency key. Nobody notices.
Session 3: "Review this" → "Well-written code." (self-confirmation bias)
Session 4: Deploy. Duplicate payments. Incident.
```

**After (with Immunity):**

```
Session 1: Claude writes payment logic. /contracts → idempotency contract created.
Session 2: Different Claude tries to modify → contract violation detected → immediate alert.
Session 2: /critic → finds "missing timeout". /ripple → "check OrderService too" alert.
Session 2: /prodlens → production readiness 4/6 → fixes 2 gaps.
Session 3: Deploy. No incidents.
```

---

## Design Principles

1. **File-system based** — No DB, no servers. `.contracts/` directory and skill files are everything
2. **Protocol first** — Optimized for Claude Code, but the convention works with any AI agent
3. **Incremental adoption** — Value from just one skill
4. **Git-friendly** — Commit `.contracts/` and the whole team shares them
5. **Minimize false positives** — If unsure, don't report

---

## Limitations

Honest limitations:

- **Depends on Claude's judgment.** If Claude misses it, the tool misses it.
- **Uses more API tokens.** Each skill reads and analyzes code, consuming tokens.
- **Not runtime verification.** `/prodlens` is code-review level, not an actual load test.
- **`/ripple` behavioral analysis isn't perfect.** Pattern-based heuristics, not precise AST analysis.

These are limitations of AI code review as a category, not just this tool. Immunity structures the maximum value possible within these constraints.

---

## License

MIT
