# Immunity

**AI agents can't reliably verify their own work.** Immunity fixes that.

[한국어](./README.ko.md)

---

## The Problem

AI agents write code fast. But they're bad at catching their own mistakes.

Ask the same agent to review code it just wrote, and it says "looks good" — because it already knows *why* it wrote it that way. This isn't a prompting problem. It's a structural one.

This manifests in 4 ways:

| Symptom | What happens |
|---------|-------------|
| **Self-confirmation bias** | Agent can't objectively critique code it just created |
| **Memory loss** | Decisions from session A are unknown in session B |
| **Tunnel vision** | Agent fixes one file without checking what else is affected |
| **Missing perspective** | Code "works" but isn't production-ready |

## The Fix

Immunity provides 4 skills, each targeting one symptom:

```
/immunity:critic     → Separate agent reviews code without knowing why it was written
/immunity:contracts  → Important decisions persist as verifiable rules across sessions
/immunity:ripple     → Changes are traced to find everything else that's affected
/immunity:prodlens   → Code is analyzed from a production operations perspective
```

`/critic` is the most impactful — try it first.

---

## Installation

```
/plugin marketplace add hohre12/immunity
/plugin install immunity@hohre12-immunity
```

Or for local development:

```bash
git clone https://github.com/hohre12/immunity.git
claude --plugin-dir ./immunity
```

**No servers. No databases. No runtime.** Just markdown files.

---

## /critic — Adversarial Code Review

The core skill. **Context isolation** is the mechanism.

When you ask the same agent to review its own code:

```
Agent: "This code handles the user's requirements well."
       (knows why it was built → rationalizes)
```

When `/critic` launches a separate sub-agent with code only:

```
Critic: "The retry loop reuses the same transactionId.
         PG may reject it as a duplicate."
        (doesn't know why → judges the code alone)
```

This isn't a prompt trick. The sub-agent structurally does not have access to the parent conversation. The bias is architecturally eliminated.

```
/immunity:critic src/services/payment/charge.ts
```

30 seconds later, you get a report with only high-confidence findings:

```
── Critic Report ──

Critical (fix immediately)
┌─────────────────────────────────────────────┐
│ [BUG] charge.ts:47                          │
│ Retry reuses same transactionId.            │
│ Fix: Generate new transactionId per retry   │
└─────────────────────────────────────────────┘

Warning (review recommended)
┌─────────────────────────────────────────────┐
│ [PRODUCTION] charge.ts:23                   │
│ No timeout on external PG API call.         │
│ Fix: Set axios timeout to 5000ms            │
└─────────────────────────────────────────────┘

Score: critical 1 / warning 1
```

Reporting criteria:
- Only `certain` (95%+) or `likely` (75-95%) confidence
- No code style, naming, or comment preferences
- If unsure, don't report — one false positive destroys trust

---

## /contracts — Self-Verifying Agent Memory

Writing "please do X" in CLAUDE.md is a **request**. A contract **catches violations**.

```
/immunity:contracts src/services/payment/
```

Claude analyzes the code and proposes contracts. You choose which to keep:

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

Next session, a different agent modifies payment code → contract violation detected → immediate alert.

Commit `.contracts/` to git and the whole team's agents respect the same rules.

---

## /ripple — Change Impact Chain Verification

```
/immunity:ripple src/services/UserService.ts
```

Import graphs aren't enough. They miss code using the same patterns.

```
UserService.update() changed
├── Direct: UserController (import relationship)
├── Behavioral: OrderService.update() (same pattern: optimistic lock + event emission)
└── Contract: user-data-integrity (needs re-verification)
```

Heuristic, not precise — but far better than checking nothing.

---

## /prodlens — Production Readiness Lens

```
/immunity:prodlens src/services/payment/
```

6 fixed axes from a production operations perspective:

| Axis | What it checks |
|------|---------------|
| Concurrency | Race conditions, deadlocks, isolation levels |
| Error Recovery | Failure recovery paths, transaction consistency |
| Observability | Logging, metrics, alerting |
| Security | Injection, auth bypass, information exposure |
| Rate Limiting | External API limits, user request limits |
| Input Validation | Boundary values, types, sizes |

```
Production Readiness: 4/6
```

---

## Before / After

**Before:**

```
Session 1: Claude writes payment logic. Includes idempotency key.
Session 2: Different Claude modifies it. Removes idempotency key. Nobody notices.
Session 3: "Review this" → "Well-written code." (self-confirmation bias)
Session 4: Deploy. Duplicate payments. Incident.
```

**After:**

```
Session 1: Claude writes payment logic. /contracts → idempotency contract created.
Session 2: Different Claude tries to modify → contract violation detected.
Session 2: /critic → finds "missing timeout". /ripple → "check OrderService too".
Session 2: /prodlens → production readiness 4/6 → fixes 2 gaps.
Session 3: Deploy. No incidents.
```

---

## Design Principles

1. **File-system based** — No DB, no servers. `.contracts/` and markdown files are everything
2. **Incremental adoption** — `/critic` alone provides value. Add more skills as needed
3. **Git-friendly** — Commit `.contracts/` and the whole team shares them
4. **Minimize false positives** — If unsure, don't report
5. **Protocol first** — Optimized for Claude Code, but the convention works with any AI agent

---

## Limitations

- **Depends on Claude's judgment.** If Claude misses it, the tool misses it.
- **Uses more API tokens.** Each skill reads and analyzes code.
- **Not runtime verification.** `/prodlens` is code review, not a load test.
- **`/ripple` is heuristic.** Pattern-based, not precise AST analysis.

These are limitations of AI code review as a category. Immunity structures the maximum value possible within these constraints.

---

## License

MIT
