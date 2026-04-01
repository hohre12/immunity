---
name: ripple
description: Traces the impact radius of code changes by combining deterministic dependency scanning with behavioral pattern analysis. Finds direct dependents, same-pattern code, and related contracts.
---

# /ripple — Change Impact Chain Verification

This skill traces the **ripple effect** of code changes. When you modify `UserService.update()`, it finds not only files that directly import it, but also files using the **same behavioral patterns** (like `OrderService.update()` with the same optimistic locking pattern).

Unlike simply asking "what does this change affect?", this skill performs **deterministic dependency scans first**, then applies LLM pattern matching on top.

## Execution Steps

### Step 1: Identify Changed Files

When the user runs `/ripple`, check the arguments:

- `/ripple <file-path>` — Analyze impact of the specified file
- `/ripple` (no args) — Run `git diff HEAD --name-only` to get recently changed files

If no files are found, ask the user for a target file.

### Step 2: Deterministic Dependency Scan (you do this yourself — no sub-agent)

Perform these tool-based scans before launching any sub-agent.

#### 2a. Extract Exports from Changed File

Read the changed file and identify all exported symbols:
- Function names, class names, type/interface names, constants
- Default export name

#### 2b. Find Direct Dependents

Use Grep to find every file that references the changed file:

```
Grep for each of these patterns across the project:
- import.*from.*['"].*{changed_file_name}['"]
- require\(['"].*{changed_file_name}['"]\)
- The exported function/class names from Step 2a
```

Record each match with file:line.

#### 2c. Find Test Files

Use Glob to find test files for the changed file:

```
Glob patterns:
- **/{changed_file_name}.test.{ts,tsx,js,jsx}
- **/{changed_file_name}.spec.{ts,tsx,js,jsx}
- **/__tests__/{changed_file_name}.*
```

#### 2d. Find Related Contracts

Use Glob to check if `.contracts/` exists:

```
Glob: .contracts/*.yml
```

If contracts exist, Read each one and check if the changed file path matches any contract's `scope` patterns.

#### 2e. Find Structurally Similar Files

Use Glob to find files in the same directory or sibling directories:

```
Glob: {same_directory}/*.{ts,tsx,js,jsx}
Glob: {parent_directory}/*/*.{ts,tsx,js,jsx}
```

These are candidates for behavioral analysis in Step 3.

Collect all deterministic findings into a structured list.

### Step 3: Launch Ripple Tracer Sub-Agent

Pass the deterministic scan results AND the list of structurally similar files to the sub-agent. The sub-agent's job is to read those similar files and determine if they use the same behavioral patterns.

Sub-agent prompt template:

```
You are a code impact analyst. Determine which of the candidate files use the same behavioral patterns as the changed files.

Project root: {project_root}
Changed files:
{file paths, one per line}

## What changed (summary from main agent's reading)
{brief description of what the changed file does, what patterns it uses}

## Pre-scan results (deterministic, already verified)
Direct dependents found:
{list from Step 2b with file:line}

Test files found:
{list from Step 2c}

Related contracts:
{list from Step 2d, or "none"}

## Candidate files for behavioral analysis
{list from Step 2e — files in same/sibling directories}

## Your Task

Read each candidate file and determine if it uses the SAME behavioral patterns as the changed file. Specifically look for:
- Same transaction pattern (optimistic locking, pessimistic locking)
- Same retry/error handling pattern
- Same external API call pattern  
- Same data transformation pattern
- Same caching strategy
- Same event emission pattern

Only report matches where the SAME change might need to be applied. "Both files use async/await" is NOT a match. "Both files implement optimistic locking with version column check before update" IS a match.

## Confidence Filter
- certain: Code clearly uses the exact same pattern
- likely: Code uses a very similar pattern that probably needs the same update
- possible: Do NOT report

## Output Format

BEHAVIORAL_MATCHES:
- file.ts — uses same pattern: {pattern name}. Reason: {why this needs attention}
- file.ts — uses same pattern: {pattern name}. Reason: {why this needs attention}

BEHAVIORAL_COUNT: number

If no behavioral matches found:
BEHAVIORAL_MATCHES: none
BEHAVIORAL_COUNT: 0
```

Agent tool settings:
- `subagent_type`: `"Explore"`
- `description`: `"ripple impact analysis"`

The agent definition in `agents/ripple-tracer.md` provides the tracer's role and rules.

### Step 4: Combine and Output Ripple Map

Merge the deterministic scan results (Direct, Tests, Contracts) with the sub-agent's behavioral analysis results:

```
── Ripple Map ──

src/services/UserService.ts (changed)
│
├── Direct (import/call relationships) [SCAN]
│   ├── src/controllers/UserController.ts:12 — imports UserService
│   ├── src/middleware/auth.ts:34 — calls UserService.findById()
│   └── src/services/UserService.test.ts — 3 test cases
│
├── Behavioral (same pattern) [REVIEW]
│   ├── src/services/OrderService.ts — uses same pattern: optimistic lock + event emission
│   │   └── ⚠ May need the same change
│   └── src/services/ProductService.ts — uses same pattern: optimistic lock
│       └── ⚠ Review recommended
│
└── Contract [SCAN]
    └── user-data-integrity — scope matches, needs re-verification

Direct: 3 / Behavioral: 2 / Contract: 1

Run chain verification?
```

### Step 5: Chain Verification (if user agrees)

If the user agrees to chain verification:

1. For each **Direct** file: Read and check if the interface is still compatible with the changes
2. For each **Behavioral** file: Read and check if the same modification needs to be applied
3. For each **Contract**: Run the contract's checks (same as `/immunity:contracts verify`)

Report findings:

```
── Chain Verification Results ──

✓ UserController.ts — interface compatible, no changes needed
✗ OrderService.ts — uses old pattern, needs same update applied
  └── Fix: Apply optimistic lock version check (same as UserService change)
✓ user-data-integrity contract — passed

Fix issues found?
```

### Important Rules

- **Always run deterministic scans first.** Grep/Glob results are facts. Behavioral analysis is judgment.
- **Label [SCAN] vs [REVIEW] in output.** Users trust deterministic findings more.
- **Don't report vague similarities.** "Both files use async/await" is not a behavioral match.
- **Direct dependencies are the priority.** Always report those. Behavioral findings are supplementary.
- **If `.contracts/` doesn't exist, skip the Contract section.** Don't mention it.
- **Behavioral analysis is heuristic.** Be transparent about this in the output.
