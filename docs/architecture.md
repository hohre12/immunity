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
│  Skill: critic.md                                            │
│  Role: Identify review targets, launch sub-agent, format     │
│  Tools: Agent (sub-agent launch), Bash (git diff)            │
└──────────────┬───────────────────────────────────────────────┘
               │ Agent tool call (code only, context blocked)
┌──────────────▼───────────────────────────────────────────────┐
│  Agent: critic-reviewer                                      │
│  Role: Judge code only, find defects                         │
│  Tools: Read, Grep, Glob (read-only)                         │
│  Output: Structured findings                                 │
└──────────────┬───────────────────────────────────────────────┘
               │ Results returned
┌──────────────▼───────────────────────────────────────────────┐
│  Skill: critic.md (result handling)                          │
│  → Show formatted report to user                            │
│  → "Fix critical issues?"                                   │
└──────────────────────────────────────────────────────────────┘
```

Skill-to-agent mapping:

| Skill | Agent | Agent role |
|-------|-------|-----------|
| `/contracts` | None (handled by main agent) | — |
| `/critic` | `critic-reviewer` | Adversarial code critique in isolated context |
| `/ripple` | `ripple-tracer` | Change impact radius tracing |
| `/prodlens` | `prod-reviewer` | Production 6-axis analysis |

`/contracts` is handled directly by the main agent without a sub-agent, because contract creation/verification is more accurate with the current conversation context.

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
[2] Launch critic-reviewer via Agent tool
    │   Passed: file path list, project root
    │   NOT passed: user request, code purpose, conversation context
    │
    ▼
[3] critic-reviewer independently analyzes code
    │   - Reads target files
    │   - Reads imported files (interface mismatch check)
    │   - Applies 4 perspectives (bug, logic, security, production)
    │   - Applies confidence filter (certain + likely only)
    │   - Returns structured results
    │
    ▼
[4] Format and display report to user
    │
    ▼
[5] "Fix critical issues?" → fix on user consent
```

### /ripple flow

```
User: /ripple src/services/UserService.ts
    │
    ▼
[1] Read changed file + extract key patterns
    │
    ▼
[2] Launch ripple-tracer via Agent tool
    │   Passed: changed file path, extracted patterns, project root
    │
    ▼
[3] ripple-tracer traces impact radius
    │   ├── Direct: import/call relationships (Grep)
    │   ├── Behavioral: same pattern usage (read code + match)
    │   └── Contract: related contracts (.contracts/ check)
    │
    ▼
[4] Output Ripple Map
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
[2] Launch prod-reviewer via Agent tool
    │   Passed: file path list, project root
    │
    ▼
[3] prod-reviewer performs 6-axis analysis
    │   ├── Concurrency
    │   ├── Error Recovery
    │   ├── Observability
    │   ├── Security
    │   ├── Rate Limiting
    │   └── Input Validation
    │
    ▼
[4] Output Production Readiness Score (N/6)
    │
    ▼
[5] "Fix FAIL items?" → fix on user consent
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
