# Immunity — Development Context

## Project Overview

Immunity is a Claude Code skill pack that provides 4 independent skills to ensure the quality of AI-generated code.

- `/contracts` — Self-verifying agent memory
- `/critic` — Context-isolated adversarial code review
- `/ripple` — Change impact tracking and chain verification
- `/prodlens` — Production readiness 6-axis analysis

## Architecture

```
immunity/
├── skills/          # 4 slash command definitions
├── agents/          # Sub-agent definitions (critic, ripple, prodlens)
├── hooks/           # Auto-verification trigger hooks
└── docs/            # Concept, architecture, usage guides
```

### Key Design Decisions

1. **Markdown only** — No runtime code. Skills and agents are all .md files
2. **Context isolation** — /critic's sub-agent receives code only, creation context is blocked
3. **File system protocol** — .contracts/ directory is the contract store. YAML format
4. **Confidence filter** — Only 95%+ (certain) or 75-95% (likely) reported. Minimize false positives

### Contract File Spec

```yaml
name: string                    # Contract name (kebab-case)
assertion: string               # Natural language description
scope: string[]                 # Glob patterns
checks:
  - type: pattern_present | pattern_absent | test_pass | file_exists | command_success | json_match
    pattern?: string
    in?: string
    command?: string
    path?: string
created_by: string
created_at: string (ISO 8601)
```

## Development Guidelines

- Skill files are prompts that Claude reads and executes. Write them clearly and specifically.
- Agent files define the role and rules for sub-agents. Explicitly state what NOT to do.
- False positives destroy tool credibility. Maintain the "if unsure, don't report" principle.
- All user-facing text in skills should be in English.
