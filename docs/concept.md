# Immunity — Concept

## Why "Immune System"?

In the era of AI-generated code, existing approaches to code quality are all **passive**.

| Existing approach | What it does | Limitation |
|-------------------|-------------|-----------|
| CLAUDE.md / .cursorrules | Says "please do X" | No enforcement. Can be ignored |
| Linters / formatters | Check syntax rules | Can't verify business logic |
| Tests | Verify written cases only | Useless if the agent writes bad tests too |
| CI/CD | Check build + test pass | Just pass/fail. Doesn't know "why" |
| PR review | Human judgment | Humans can't keep up with AI speed |
| mem0 etc. | Remembers things | Doesn't verify what it remembers |

A biological immune system is different. It's **active**.

```
1. Immune memory — Remembers past pathogens (T cells, B cells)
2. Immune response — Detects and reacts to anomalies immediately (antibodies, killer cells)
3. Immune propagation — Traces infection paths to prevent spread (cytokines)
4. Immune adaptation — Builds stronger antibodies against new threats (affinity maturation)
```

Immunity applies this structure to code quality:

```
/contracts  →  Immune memory     →  Remember decisions, detect violations
/critic     →  Immune response   →  Independently detect anomalies (bugs, flaws)
/ripple     →  Immune propagation →  Trace how far a change's impact spreads
/prodlens   →  Immune adaptation  →  Strengthen code for the production environment
```

## Core Innovation: Memory = Verification

In the existing world, memory and verification live in completely separate layers:

```
Existing:  Memory ──(manual human effort)──→ Test / Lint / CI
Immunity:  Memory === Verification          (a single object called a contract)
```

The moment an agent **remembers** "payments must be idempotent", it automatically becomes a **verifiable rule**.

This is the new primitive that Immunity's `/contracts` proposes.

## Core Innovation: Context Isolation

When you ask the same agent to "build this" and then "critique this", the agent is biased toward the code it created. This isn't the agent's fault — it's a structural limitation of performing creation and criticism within the same context.

```
Same agent reviewing its own code:
  "This code is well-written to meet the user's requirements."
  (Knows why it was built, so it rationalizes)

/critic (separate agent):
  "The retry loop reuses the same transactionId.
   The PG may reject it as a duplicate request."
  (Doesn't know why it was built, so it judges only the code)
```

This is `/critic`'s context isolation. Creator and Critic are structurally separated.

## Design Philosophy

### 1. Enforcement, not requests

CLAUDE.md: "Please add error handling to functions" → Request. Can be ignored.
Contract: "If this function has no error handling, it's detected as a violation" → Enforcement.

### 2. False positives destroy trust

If `/critic` sends wrong alerts 3 out of 10 times, the user ignores it from the 11th time.
**Not reporting when unsure** is the correct strategy.

All Immunity skills apply a confidence filter:
- certain (95%+): Report
- likely (75-95%): Report
- possible (50-75%): Do NOT report

### 3. Incremental adoption

Each of the 4 skills must provide value on its own.
A user who only uses `/critic` and a user who uses all 4 must both be satisfied.

### 4. Protocol > Implementation

The YAML files in `.contracts/` are not tied to any specific AI.
Claude Code, Cursor, Copilot — any agent can read these files and participate in verification.

## Competitive Landscape

**Direct competitors: None**

The category "self-verifying agent memory" has not been defined yet.
"Context-isolated adversarial review" has never been productized.

**Indirect competitors:**

| Tool | Difference from Immunity |
|------|------------------------|
| mem0 | Remembers only. Doesn't verify |
| CodeRabbit | PR-level review. No context isolation |
| SonarQube | Static analysis. Can't judge business logic |
| GitHub Copilot Review | Same model writes + reviews. Bias exists |

## Market Positioning

```
Tagline: "When AI remembers, AI enforces."
Category: AI Code Quality / Agent Memory
Competitors: None (category creation)
Install cost: 0 (copy markdown files)
Learning cost: Run /critic once and you'll see
```
