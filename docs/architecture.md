# Immunity — Architecture

## Overall Structure

```
immunity/                              # Plugin distribution unit
├── .claude-plugin/
│   └── plugin.json                    # Plugin manifest (required)
├── skills/                            # Slash commands (user interface)
│   ├── contracts/
│   │   └── SKILL.md                   # /immunity:contracts
│   ├── critic/
│   │   └── SKILL.md                   # /immunity:critic
│   ├── ripple/
│   │   └── SKILL.md                   # /immunity:ripple
│   └── prodlens/
│       └── SKILL.md                   # /immunity:prodlens
├── agents/                            # Sub-agents (execution engines)
│   ├── critic-reviewer.md             # Adversarial review agent
│   ├── ripple-tracer.md               # Impact tracing agent
│   └── prod-reviewer.md               # Production review agent
├── hooks/                             # Auto triggers
│   └── immunity-hooks.json            # Hook config template
└── docs/                              # Documentation
```

When applied to a user project:

```
my-project/
├── .contracts/                    # Contract store (git committed)
│   ├── CONTRACTS.md               # Contract index (auto-generated)
│   └── *.yml                      # Individual contract files
├── .claude/
│   └── settings.json              # Plugin installed + hooks registered
└── src/                           # User code
```

## Skill ↔ Agent Mapping

```
┌──────────────────────────────────────────────────────────────┐
│                        User                                  │
│                     types /critic                             │
└──────────────┬───────────────────────────────────────────────┘
               │
┌──────────────▼───────────────────────────────────────────────┐
│  Skill: SKILL.md (Phase 1 — deterministic scan)              │
│  Main agent runs Grep + Read to find anti-patterns           │
│  Produces [SCAN] findings                                    │
└──────────────┬───────────────────────────────────────────────┘
               │
┌──────────────▼───────────────────────────────────────────────┐
│  Skill: SKILL.md (Phase 2 — sub-agent launch)                │
│  Passes: file paths + [SCAN] findings (context blocked)      │
│  Contains: complete prompt template for the sub-agent        │
└──────────────┬───────────────────────────────────────────────┘
               │ Agent tool call
┌──────────────▼───────────────────────────────────────────────┐
│  Agent: critic-reviewer.md                                   │
│  Defines: role + constraints (what to do, what NOT to do)    │
│  Does NOT define: review criteria, output format             │
│  (those come from the SKILL.md prompt template)              │
└──────────────┬───────────────────────────────────────────────┘
               │ Results returned
┌──────────────▼───────────────────────────────────────────────┐
│  Skill: SKILL.md (Phase 3 — report)                          │
│  → Merge [SCAN] + [REVIEW] findings                         │
│  → Show formatted report with legend                        │
│  → "Fix critical issues?"                                   │
└──────────────────────────────────────────────────────────────┘
```

Skill-to-agent responsibility split:

| | SKILL.md | Agent .md |
|---|----------|----------|
| **Defines** | Full execution flow, scan patterns, prompt template, output format | Role identity, constraints, what NOT to do |
| **Source of truth for** | Review criteria, perspectives, output format | Behavioral guardrails |
| **Updated when** | Adding scan patterns, changing output format | Changing role constraints |

| Skill | Agent | Agent's narrow role |
|-------|-------|-----------|
| `/contracts` | None (main agent) | — |
| `/critic` | `critic-reviewer` | Role + constraints only. Criteria come from SKILL.md prompt |
| `/ripple` | `ripple-tracer` | Role + constraints only. Behavioral analysis of candidate files |
| `/prodlens` | `prod-reviewer` | Role + constraints only. Criteria come from SKILL.md prompt |

`/contracts` is handled directly by the main agent without a sub-agent, because contract creation/verification is deterministic (Grep/Glob/Bash) and benefits from conversation context.

## Data Flows

### /contracts flow

```
User: /contracts src/services/payment/
    │
    ▼
[1] Read target files (Read)
    │
    ▼
[2] Analyze code → generate contract candidates
    │
    ▼
[3] Propose to user → user selects
    │
    ▼
[4] Write .contracts/*.yml files (Write)
    │
    ▼
[5] Update .contracts/CONTRACTS.md index
```

### /contracts verify flow

```
User: /contracts verify
    │
    ▼
[1] Load all .contracts/*.yml
    │
    ▼
[2] Execute each contract's checks:
    │   ├── pattern_present → Grep for pattern existence
    │   ├── pattern_absent → Grep for pattern absence
    │   ├── test_pass → Bash to run test
    │   ├── file_exists → Glob for file existence
    │   ├── command_success → Bash to run command
    │   └── json_match → Read to check JSON field
    │
    ▼
[3] Output results (✓ pass / ✗ fail)
```

### /critic flow

```
User: /critic src/services/payment/charge.ts
    │
    ▼
[1] Determine review target files
    │   - If args provided: use those files
    │   - If no args: git diff HEAD
    │
    ▼
[2] Deterministic anti-pattern scan (main agent, no sub-agent)
    │   - Grep for null-risk, error-handling, security patterns
    │   - Read ±N lines context to verify each candidate
    │   - Collect confirmed [SCAN] findings
    │
    ▼
[3] Launch critic-reviewer via Agent tool
    │   Passed: file paths, project root, [SCAN] findings
    │   NOT passed: user request, code purpose, conversation context
    │
    ▼
[4] critic-reviewer independently analyzes code
    │   - Verifies [SCAN] findings + finds additional [REVIEW] issues
    │   - Applies confidence filter (certain + likely only)
    │   - Returns structured results
    │
    ▼
[5] Format and display report to user
    │
    ▼
[6] "Fix critical issues?" → fix on user consent
```

### /ripple flow

```
User: /ripple src/services/UserService.ts
    │
    ▼
[1] Read changed file + extract key patterns
    │
    ▼
[2] Deterministic dependency scan (main agent, no sub-agent)
    │   - Grep for imports/calls referencing changed file [SCAN]
    │   - Glob for test files [SCAN]
    │   - Check .contracts/ for related contracts [SCAN]
    │   - Glob for candidate files in same/sibling directories
    │
    ▼
[3] Launch ripple-tracer via Agent tool
    │   Passed: changed file, patterns, [SCAN] results, candidate files
    │   Task: behavioral analysis of candidates only
    │
    ▼
[4] Combine [SCAN] + [REVIEW] → Output Ripple Map
    │
    ▼
[5] "Run chain verification?" → verify affected files on consent
```

### /prodlens flow

```
User: /prodlens src/services/payment/
    │
    ▼
[1] Determine target files
    │
    ▼
[2] Deterministic production scan (main agent, no sub-agent)
    │   - Grep for timeout, error handling, security, validation patterns
    │   - Read ±N lines context to verify each candidate
    │   - Glob+Read config files (DB, ORM, Docker, etc.)
    │   - Collect confirmed [SCAN] findings
    │
    ▼
[3] Launch prod-reviewer via Agent tool
    │   Passed: file paths, project root, [SCAN] findings
    │
    ▼
[4] prod-reviewer performs 6-axis analysis
    │   - Verifies [SCAN] findings + finds additional [REVIEW] issues
    │   ├── Concurrency, Error Recovery, Observability
    │   ├── Security, Rate Limiting, Input Validation
    │
    ▼
[5] Output Production Readiness Score (N/6)
    │
    ▼
[6] "Fix FAIL items?" → fix on user consent
```

## Hook Integration

```jsonc
// .claude/settings.json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "command": "sh -c 'if [ -d .contracts ]; then echo \"[immunity] Contracts exist in this project. Consider running /contracts verify to check for violations.\"; fi'"
      }
    ]
  }
}
```

Hook behavior:
- This hook is a **reminder**, not automatic enforcement
- When a file is modified and `.contracts/` exists, it prompts the agent to consider running `/contracts verify`
- The agent decides whether to act on the reminder based on the context
- For full enforcement, the user should run `/contracts verify` manually or before commits

## Inter-Skill Integration

The 4 skills are independent but have integration points:

```
/contracts ←─── /ripple
  │               │
  │  .contracts/  │  ripple reads contract scopes to
  │  shared files │  include "this contract needs re-verification"
  │               │
  └───────────────┘

/critic ←─── /prodlens
  │               │
  │  different    │  critic finds bugs/logic/security
  │  perspectives │  prodlens finds operational gaps
  │               │
  └───────────────┘
```

- `/ripple` reads `.contracts/` files to include related contracts in the Ripple Map
- `/critic` and `/prodlens` have different perspectives, so running both provides complementary coverage

However, no skill **requires** any other skill to exist. Each works standalone.
