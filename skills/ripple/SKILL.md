---
name: ripple
description: Traces the impact radius of code changes by identifying direct dependencies, behavioral similarities, and related contracts to enable chain verification.
---

# /ripple — Change Impact Chain Verification

This skill traces the **ripple effect** of code changes. When you modify `UserService.update()`, it finds not only files that directly import it, but also files using the **same behavioral patterns** (like `OrderService.update()` with the same optimistic locking pattern).

## Execution Steps

### Step 1: Identify Changed Files

When the user runs `/ripple`, check the arguments:

- `/ripple <file-path>` — Analyze impact of the specified file
- `/ripple` (no args) — Run `git diff HEAD --name-only` to get recently changed files

If no files are found, ask the user for a target file.

### Step 2: Analyze the Changed Code

Read the target file(s) and extract **key patterns**:

- What external services/APIs does it call?
- What database operations does it perform?
- What patterns does it use? (transactions, locks, retries, event emission, caching, etc.)
- What error handling approach does it follow?
- What data structures/interfaces does it consume or produce?

### Step 3: Launch Ripple Tracer Sub-Agent

Use the Agent tool to launch a sub-agent that traces the impact radius.

Sub-agent prompt template:

```
You are a code impact analyst. Trace the ripple effect of changes to the specified files.

Project root: {project_root}
Changed files:
{file paths, one per line}

Key patterns found in changed files:
{extracted patterns from Step 2}

## Your Task

Find all code that could be affected by changes to the above files. Categorize findings into three groups:

### 1. Direct — Import/call relationships
Use Grep to find:
- Files that import/require the changed files
- Files that call functions defined in the changed files
- Test files for the changed files

### 2. Behavioral — Same pattern usage
Read files in similar directories and find code that uses the SAME patterns as the changed files. Examples:
- Same transaction pattern (optimistic locking, pessimistic locking)
- Same retry/error handling pattern
- Same external API call pattern
- Same data transformation pattern
- Same caching strategy

Only report behavioral matches where the SAME change might need to be applied. Don't report vague similarities.

### 3. Contract — Related contracts
Check if `.contracts/` directory exists. If so, read the contract files and find any whose scope includes the changed files.

## Confidence Filter
- certain: Directly imports or calls the changed code
- likely: Uses the exact same pattern and may need the same update
- possible: Do NOT report

## Output Format

RIPPLE MAP:
{changed_file} (changed)
├── Direct
│   ├── file.ts — function() directly calls changed code
│   └── file.test.ts — tests for changed code
├── Behavioral
│   ├── other-service.ts — uses same pattern: {pattern name}
│   └── ⚠ May need the same change applied
└── Contract
    └── contract-name — needs re-verification

---
DIRECT_COUNT: number
BEHAVIORAL_COUNT: number
CONTRACT_COUNT: number
```

Agent tool settings:
- `subagent_type`: `"Explore"`
- `description`: `"ripple impact analysis"`

The agent definition in `agents/ripple-tracer.md` provides the tracer's role and rules. The inline prompt template above should be used as the sub-agent's instructions — it contains the complete impact analysis criteria and output format.

### Step 4: Output Ripple Map

Format the sub-agent's results and show them to the user:

```
── Ripple Map ──

src/services/UserService.ts (changed)
│
├── Direct (import/call relationships)
│   ├── src/controllers/UserController.ts — updateUser() directly calls UserService.update()
│   ├── src/services/UserService.test.ts — 3 tests cover update()
│   └── src/middleware/auth.ts — getUserFromToken() calls UserService.findById()
│
├── Behavioral (same pattern)
│   ├── src/services/OrderService.ts — update() uses same pattern: optimistic lock + event emission
│   │   └── ⚠ May need the same change
│   └── src/services/ProductService.ts — update() uses same pattern: optimistic lock
│       └── ⚠ Review recommended
│
└── Contract
    └── user-data-integrity — needs re-verification

Direct: 3 / Behavioral: 2 / Contract: 1

Run chain verification?
```

### Step 5: Chain Verification (if user agrees)

If the user agrees to chain verification:

1. For each **Direct** file: Read and check if the interface is still compatible with the changes
2. For each **Behavioral** file: Read and check if the same modification needs to be applied
3. For each **Contract**: Run the contract's checks (same as `/contracts verify`)

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

- **Behavioral analysis is heuristic, not precise.** Claude reads code and identifies patterns — it's not an AST engine. Be transparent about this.
- **Don't report vague similarities.** "Both files use async/await" is not a behavioral match. "Both files implement optimistic locking with version column check" is.
- **Direct dependencies are the priority.** Always report those. Behavioral findings are supplementary.
- **If `.contracts/` doesn't exist, skip the Contract section.** Don't mention it.
