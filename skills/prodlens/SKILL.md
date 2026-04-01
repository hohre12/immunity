---
name: prodlens
description: Analyzes code from a production operations perspective across 6 fixed axes — concurrency, error recovery, observability, security, rate limiting, and input validation. Combines deterministic pattern scanning with LLM judgment.
---

# /prodlens — Production Readiness Lens

This skill analyzes code from the perspective of a **production operations engineer**, not a feature developer. It checks whether code that "works" will **survive in production** under real-world conditions.

Unlike simply asking "review this for production readiness", this skill performs **deterministic scans first**, then applies LLM judgment on top. The deterministic layer catches concrete patterns; the LLM layer catches design-level gaps.

## Execution Steps

### Step 1: Identify Target

When the user runs `/prodlens`, check the arguments:

- `/prodlens <path>` — Analyze the specified file or directory
- `/prodlens` (no args) — Run `git diff HEAD --name-only` to get recently changed files

If no files are found, ask the user for a target path.

### Step 2: Deterministic Scan (you do this yourself — no sub-agent)

Before launching any sub-agent, perform these tool-based scans on the target files. These produce concrete, reproducible evidence.

#### 2a. Timeout & External Call Scan

Use Grep on the target files for external call patterns WITHOUT timeout configuration:

```
Grep patterns (in target scope):
- "axios\.(get|post|put|delete|patch)\(" → then check if timeout is set nearby
- "fetch\(" → check for AbortController or signal
- "http\.(get|request)\(" → check for timeout option
- "\.query\(|\.execute\(" → check for statement_timeout or lock_timeout
```

Record each finding with file:line.

#### 2b. Error Handling Gap Scan

Use Grep to find try/catch patterns and external calls:

```
Grep patterns:
- "await.*\.(post|get|put|delete|query|execute)\(" WITHOUT surrounding try/catch
- "catch.*\{[^}]*\}" → check if catch block is empty or only logs
- "\.then\(" without ".catch\("
```

#### 2c. Sensitive Data Exposure Scan

```
Grep patterns:
- "console\.(log|info|warn)\(.*password|token|secret|key|credential"
- "res\.(json|send)\(.*error\.(message|stack)"
- "process\.env\." in client-side code (check file path for /client/ or /public/)
```

#### 2d. Input Validation Scan

```
Grep patterns:
- "req\.(body|params|query)\." without preceding validation (joi, zod, yup, class-validator)
- "parseInt\(|parseFloat\(" without isNaN check
- "JSON\.parse\(" without try/catch
```

#### 2e. Configuration File Scan

Use Glob to find config files, then Read them:

```
Glob: "**/database.{ts,js,json}", "**/config.{ts,js,json}", "**/.env.example", "**/docker-compose.{yml,yaml}"
Check for:
- Connection pool size settings
- Timeout configurations
- Rate limit configurations
- Retry settings
```

Collect all deterministic findings into a structured list with file:line references.

### Step 3: Launch Production Reviewer Sub-Agent

Pass the deterministic scan results to the sub-agent along with the files. This gives the LLM concrete evidence to work with, not just vibes.

Sub-agent prompt template:

```
You are a production operations engineer reviewing code for production readiness.
You do not care if the code "works". You care if it will survive in production with real traffic, real failures, and real attackers.

Project root: {project_root}
Review target files:
{file path list, one per line}

## Pre-scan findings (deterministic, already verified)
{paste the findings from Step 2 here — these are confirmed facts, not guesses}

## Analyze these 6 axes exactly

Use the pre-scan findings as evidence. Add additional issues found through code reading.

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

Mark findings from pre-scan as [SCAN] and findings from your own analysis as [REVIEW].

## Confidence Filter
- certain (95%+): Report
- likely (75-95%): Report
- possible (50-75%): Do NOT report

## What NOT to report
- Code style or naming issues
- Missing tests
- "Best practice" suggestions without a concrete production failure scenario
- Issues that only matter at extreme scale unless the code clearly targets high scale

## Output Format

For each axis:

[AXIS_NAME] [STATUS: PASS/PARTIAL/FAIL]
[SCAN] or [REVIEW] Issue description
  file:line — specific location
  Fix: concrete fix
  Confidence: certain or likely

---
PRODUCTION_READINESS: N/6
FAIL_COUNT: number
PARTIAL_COUNT: number
SCAN_FINDINGS: number (from deterministic pre-scan)
REVIEW_FINDINGS: number (from LLM analysis)
VERDICT: production-ready or needs-hardening or not-production-ready
```

Agent tool settings:
- `subagent_type`: `"feature-dev:code-reviewer"`
- `description`: `"prodlens production review"`

The agent definition in `agents/prod-reviewer.md` provides the reviewer's role and rules.

### Step 4: Output Production Report

Format the sub-agent's results and show them to the user:

```
── Production Lens ──

Concurrency                               ✗ FAIL
│ [SCAN] charge.ts:34 — No transaction isolation level set.
│ Concurrent payments may double-deduct inventory.
│ Fix: Use SELECT ... FOR UPDATE or SERIALIZABLE isolation
│
Error Recovery                             ✗ FAIL
│ [SCAN] charge.ts:26 — axios.post without timeout.
│ PG failure → request hangs indefinitely → connection pool exhaustion.
│ Fix: Set axios timeout to 5000ms
│
│ [REVIEW] charge.ts:52 — Transaction state unknown after PG timeout.
│ Cannot determine if payment succeeded or failed.
│ Fix: Query PG status API to confirm transaction state
│
Observability                              △ PARTIAL
│ [REVIEW] Logging exists but no success/failure metrics.
│ Cannot detect payment failure rate spike in real-time.
│ Fix: Add payment.success / payment.failure counters
│
Security                                   ✓ PASS
Rate Limiting                              ✓ PASS
Input Validation                           ✓ PASS

Production Readiness: 4/6
Scan findings: 2 / Review findings: 2

Fix FAIL items?
```

### Step 5: Offer to Fix

If there are FAIL items, ask:

```
Fix N FAIL items?
```

If the user agrees, fix FAIL items in order. PARTIAL items are informational — only fix if the user explicitly requests.

### Important Rules

- **Always run the deterministic scan first.** This gives concrete evidence before LLM judgment.
- **Always analyze all 6 axes.** Even if the first 3 are PASS, check the remaining 3.
- **Distinguish [SCAN] vs [REVIEW].** Users trust deterministic findings more. Label them clearly.
- **Be specific about the failure scenario.** Don't just say "missing error handling" — say "if PG times out at line 52, the payment status remains pending indefinitely, creating a zombie record."
- **PASS is fine.** Not every file has production issues. Don't force findings.
- **This is code review, not runtime analysis.** Be transparent about this.
