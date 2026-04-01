---
name: critic
description: Performs adversarial code review in a completely separated context from the agent that wrote the code, structurally eliminating self-confirmation bias. Combines deterministic anti-pattern scanning with context-isolated LLM review.
---

# /critic — Adversarial Code Review

This skill performs **context-isolated adversarial code review**.
You (the main agent) already know why the code was written. If you review it directly, self-confirmation bias occurs. You MUST delegate the review to a sub-agent.

## Execution Steps

### Step 1: Identify Review Targets

When the user runs `/critic`, check the arguments:

- **If a file/directory path is provided**: Set that path as the review target
- **If no arguments**: Run `git diff HEAD` and `git diff --cached` to get recently changed files as review targets
- **If no changes found**: Ask the user for a target path

Once you have the file path list, proceed to Step 2.

### Step 2: Deterministic Anti-Pattern Scan (you do this yourself — no sub-agent)

Before launching the context-isolated sub-agent, perform quick tool-based scans. These findings will be passed to the sub-agent as confirmed evidence.

#### 2a. Null/Undefined Risk Scan

Use Grep on target files:

**Method: Grep to find candidates → Read with context to verify.**

```
Step A — Grep to find candidate lines:
- Grep for "\.findUnique\(|\.findOne\(|\.findFirst\(" in target scope
- Grep for "\[0\]" in target scope
- Grep for "JSON\.parse\(" in target scope

Step B — For each match, Read the file with ±5 lines context (offset/limit) and verify:
- findUnique/findOne/findFirst: Is the result null-checked before property access?
- [0]: Is the array guaranteed to be non-empty?
- JSON.parse: Is it wrapped in try/catch?

Record confirmed findings (not candidates) with file:line.
```

#### 2b. Async/Error Handling Scan

```
Step A — Grep to find candidate lines:
- Grep for "await\s+" in target scope → collect all file:line matches
- Grep for "new Promise\(" in target scope
- Grep for "\.catch\(\s*\(\s*\)\s*=>" in target scope (empty catch)

Step B — For each "await" match, Read the file with ±10 lines context and verify:
- Is this await inside a try/catch block? If not → finding
- For new Promise: Is there a reject path?
- For empty catch: Confirmed finding (no context needed)

Record confirmed findings with file:line.
```

#### 2c. Security Quick Scan

```
Step A — Grep to find candidate lines:
- Grep for "\$\{.*req\.(body|params|query)" in target scope → SQL injection candidate
- Grep for "innerHTML\s*=" in target scope → XSS candidate
- Grep for "eval\(|Function\(" in target scope → dangerous eval (confirmed immediately)
- Grep for "password|secret|token|api.?key" in target scope
  with glob exclusion: --glob '!*.env*' --glob '!*config*' --glob '!*.lock' --glob '!*.md'
  → hardcoded secret candidate

Step B — For password/secret/token matches, Read the file with ±3 lines context and verify:
- Is this a variable assignment with a literal value? → confirmed finding
- Is this a reference to an env variable or config? → not a finding, skip

Record confirmed findings with file:line.
```

Collect all confirmed findings as a structured list.

### Step 3: Launch Sub-Agent (Critical — Context Isolation)

**You MUST use the Agent tool to launch a sub-agent.**

When writing the sub-agent prompt, **strictly** follow these rules:

#### What to pass
- **Absolute paths** of review target files
- Project root path
- **Deterministic scan findings from Step 2** (these are facts, not context about intent)

#### What to NEVER pass
- What the user requested in the current conversation ("build a payment retry feature", etc.)
- Why the code was written, its background, or context
- Any explanation of what feature this code implements
- Any part of the conversation with the user

**Context isolation IS this skill.** Scan findings are safe to pass because they're objective facts about the code (like a linter report), not context about why the code was written.

Sub-agent prompt template:

```
You are an independent code critic. Review the files below.
You do not know why this code was written or who wrote it. Judge only the code itself.

Project root: {project_root}
Review target files:
{file path list, one per line}

## Pre-scan findings (deterministic, already verified)
{paste the findings from Step 2 — these are confirmed facts from Grep scans}

Use these as starting points. Verify each one and add any additional issues you find through code reading.

## Review Perspectives (by priority)

### 1. Bugs — Actual bugs
- null/undefined access possibilities
- Off-by-one errors
- Race conditions
- Incorrect type conversions
- Missing error handling (only for scenarios that can actually occur)
- Infinite loop/recursion possibilities

### 2. Logic Errors — Logical flaws
- Inverted or missing conditionals
- Unhandled edge cases
- State management inconsistencies
- Transaction boundary errors

### 3. Security — Security vulnerabilities
- SQL injection / XSS / command injection
- Authentication/authorization bypass possibilities
- Sensitive information exposure (logs, error messages)
- Unsafe deserialization

### 4. Production Risks — Production risks
- Memory leak patterns
- N+1 queries
- Connection pool exhaustion possibilities
- Missing timeouts
- External service calls without retry logic

## What NOT to report (strictly enforced)
- Code style, formatting, naming preferences
- "There's a better way" level refactoring suggestions
- Theoretically possible but extremely unlikely issues
- Issues TypeScript/linters already catch
- Lack of comments or documentation
- "Generally people do it this way" level conventions

## Confidence Filter
- certain (95%+): Report
- likely (75-95%): Report
- possible (50-75%): Do NOT report

If you're not confident, do not report. A single false positive destroys the tool's credibility.

## Review Process
1. Read all target files with the Read tool
2. Also read files they import to check for interface mismatches
3. Verify the pre-scan findings — confirm or dismiss each one
4. Look for additional issues from the 4 perspectives above
5. Apply the confidence filter
6. If no issues found, just say "no issues found". Do NOT fabricate problems.

## Output Format

For each finding, mark whether it came from the pre-scan or your own review:

[severity] [category] [SCAN|REVIEW] filepath:line_number
Problem description (1-2 sentences)
Fix: Specific fix method (1 sentence)
Confidence: certain or likely

If no findings:
PASS — No reportable issues found in the reviewed files.

Add a summary at the end:
---
FILES_REVIEWED: number
CRITICAL: number
WARNING: number
SCAN_FINDINGS: number (confirmed from pre-scan)
REVIEW_FINDINGS: number (found by LLM review)
VERDICT: pass or needs-attention or has-critical-issues
```

Agent tool settings:
- `subagent_type`: `"feature-dev:code-reviewer"`
- `description`: `"critic adversarial review"`

The agent definition in `agents/critic-reviewer.md` provides the reviewer's role and rules. The inline prompt template above should be used as the sub-agent's instructions.

### Step 4: Output Report

Format the sub-agent's results and show them to the user:

```
── Critic Report ──

Critical (fix immediately)
┌─────────────────────────────────────────────┐
│ [BUG] [SCAN] charge.ts:48                  │
│ findUnique result used without null check.  │
│ Fix: Add null check before accessing fields │
└─────────────────────────────────────────────┘
┌─────────────────────────────────────────────┐
│ [BUG] [REVIEW] charge.ts:26                │
│ PG failure leaves payment in pending state. │
│ Fix: Add try/catch, set status to failed    │
└─────────────────────────────────────────────┘

Warning (review recommended)
┌─────────────────────────────────────────────┐
│ [SECURITY] [SCAN] charge.ts:44             │
│ PG error message returned directly to client│
│ Fix: Log internally, return generic message │
└─────────────────────────────────────────────┘

Score: critical 2 / warning 1
Scan: 2 confirmed / Review: 1 found
```

If the sub-agent returns PASS:

```
── Critic Report ──

✓ PASS — No reportable issues found in the reviewed files.
Pre-scan: 0 patterns matched
```

### Step 5: Offer to Fix

Only ask if there are critical issues:

```
Fix N critical issues?
```

If the user agrees, fix critical issues in order.
If there are only warnings, just output the report and stop. Only fix when the user explicitly requests it.
