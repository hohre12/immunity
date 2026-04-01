---
name: prodlens
description: Analyzes code from a production operations perspective across 6 fixed axes — concurrency, error recovery, observability, security, rate limiting, and input validation.
---

# /prodlens — Production Readiness Lens

This skill analyzes code from the perspective of a **production operations engineer**, not a feature developer. It checks whether code that "works" will **survive in production** under real-world conditions.

## Execution Steps

### Step 1: Identify Target

When the user runs `/prodlens`, check the arguments:

- `/prodlens <path>` — Analyze the specified file or directory
- `/prodlens` (no args) — Run `git diff HEAD --name-only` to get recently changed files

If no files are found, ask the user for a target path.

### Step 2: Launch Production Reviewer Sub-Agent

Use the Agent tool to launch a sub-agent with a production operations perspective.

Sub-agent prompt template:

```
You are a production operations engineer reviewing code for production readiness.
You do not care if the code "works". You care if it will survive in production with real traffic, real failures, and real attackers.

Project root: {project_root}
Review target files:
{file path list, one per line}

## Analyze these 6 axes exactly

### 1. Concurrency
- Race conditions between concurrent requests
- Missing database transaction isolation levels
- Deadlock possibilities
- Shared mutable state without synchronization
- Missing distributed locks where needed

### 2. Error Recovery
- What happens when external services fail (timeout, 5xx, network error)?
- Is there a clear recovery path for each failure mode?
- Are transactions rolled back on failure?
- Can the system recover to a consistent state after a crash?
- Are there zombie/orphan records possible (e.g., status stuck in "pending")?

### 3. Observability
- Is there logging for critical operations (not just errors)?
- Are there metrics for success/failure rates?
- Can you tell what's happening in production by reading the logs?
- Are there alerts or monitoring hooks for failure conditions?
- Are request IDs / correlation IDs propagated?

### 4. Security
- SQL injection / XSS / command injection vectors
- Authentication/authorization bypass possibilities
- Sensitive data exposure in logs or error responses
- Missing input sanitization at system boundaries
- Hardcoded secrets or credentials

### 5. Rate Limiting
- Are external API calls rate-limited or throttled?
- Can a single user exhaust shared resources?
- Are there circuit breakers for failing dependencies?
- Is there backpressure handling?

### 6. Input Validation
- Are boundary values validated (min, max, length)?
- Are types checked at system boundaries?
- Are required fields enforced?
- Are file sizes / payload sizes limited?

## Scoring Rules

For each axis, assign ONE status:
- ✓ PASS — No issues found for this axis
- △ PARTIAL — Some measures exist but gaps remain
- ✗ FAIL — Significant gap that would cause issues in production

## Confidence Filter
- certain (95%+): Report
- likely (75-95%): Report
- possible (50-75%): Do NOT report

Only report issues you're confident about. This is code review, not a penetration test or load test.

## What NOT to report
- Code style or naming issues
- Missing tests (that's not a production concern, it's a development concern)
- "Best practice" suggestions without a concrete production failure scenario
- Issues that only matter at extreme scale unless the code clearly targets high scale

## Output Format

For each axis:

[AXIS_NAME] [STATUS: PASS/PARTIAL/FAIL]
Issue description (if PARTIAL or FAIL)
  file:line — specific location
  Fix: concrete fix
  Confidence: certain or likely

---
PRODUCTION_READINESS: N/6
FAIL_COUNT: number
PARTIAL_COUNT: number
VERDICT: production-ready or needs-hardening or not-production-ready
```

Agent tool settings:
- `subagent_type`: `"feature-dev:code-reviewer"`
- `description`: `"prodlens production review"`

The agent definition in `agents/prod-reviewer.md` provides the reviewer's role and rules. The inline prompt template above should be used as the sub-agent's instructions — it contains the complete 6-axis analysis criteria and output format.

### Step 3: Output Production Report

Format the sub-agent's results and show them to the user:

```
── Production Lens ──

Concurrency                               ✗ FAIL
│ charge.ts:34 — No transaction isolation level set.
│ Concurrent payments may double-deduct inventory.
│ Fix: Use SELECT ... FOR UPDATE or SERIALIZABLE isolation
│
Error Recovery                             ✗ FAIL
│ charge.ts:52 — Transaction state unknown after PG timeout.
│ Cannot determine if payment succeeded or failed.
│ Fix: Query PG status API to confirm transaction state
│
Observability                              △ PARTIAL
│ Logging exists but no success/failure metrics.
│ Cannot detect payment failure rate spike in real-time.
│ Fix: Add payment.success / payment.failure counters
│
Security                                   ✓ PASS
Rate Limiting                              ✓ PASS
Input Validation                           ✓ PASS

Production Readiness: 4/6

Fix FAIL items?
```

### Step 4: Offer to Fix

If there are FAIL items, ask:

```
Fix N FAIL items?
```

If the user agrees, fix FAIL items in order. PARTIAL items are informational — only fix if the user explicitly requests.

### Important Rules

- **Always analyze all 6 axes.** Even if the first 3 are PASS, check the remaining 3.
- **Be specific about the failure scenario.** Don't just say "missing error handling" — say "if PG times out at line 52, the payment status remains pending indefinitely, creating a zombie record."
- **PASS is fine.** Not every file has production issues. Don't force findings.
- **This is code review, not runtime analysis.** Be transparent that you're judging code patterns, not actual load test results.
