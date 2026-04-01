# Immunity — Installation Guide

## Installation

### Method 1: Full install

```bash
# 1. Clone the repository
git clone https://github.com/hohre12/immunity.git /tmp/immunity

# 2. Copy skill files
cp /tmp/immunity/skills/*.md .claude/skills/

# 3. Copy agent files
cp /tmp/immunity/agents/*.md .claude/agents/

# 4. (Optional) Hook setup — auto contract verification
# Add hooks to .claude/settings.json
```

### Method 2: Individual skills only

Install only the skills you want:

```bash
# /critic only
cp /tmp/immunity/skills/critic.md .claude/skills/

# /contracts only
cp /tmp/immunity/skills/contracts.md .claude/skills/

# /prodlens only
cp /tmp/immunity/skills/prodlens.md .claude/skills/

# /ripple only
cp /tmp/immunity/skills/ripple.md .claude/skills/
```

## Verify Installation

```
# In Claude Code, simply run any skill:
User: /critic
→ If prompted for a review target or the skill starts analyzing, installation succeeded

User: /contracts list
→ If it reports "no contracts found" or shows existing contracts, installation succeeded
```

## Hook Setup (Optional)

To enable automatic contract verification, add hooks to your settings.

Add to `.claude/settings.json`:

```jsonc
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

This hook is a **reminder**, not automatic enforcement. When files are modified and `.contracts/` exists, it prompts the agent to consider running `/contracts verify`. For full enforcement, run `/contracts verify` manually before commits.

## Project vs Global Install

| Install location | Effect | Recommended for |
|-----------------|--------|----------------|
| Project `.claude/` | Available in this project only | Team projects (can git commit) |
| Global `~/.claude/` | Available in all projects | Individual developers |

## Dependencies

None.

- No Node.js required
- No Python required
- No additional packages required
- No MCP server required

Just markdown files. If Claude Code is installed, you're ready to go.

## Update

```bash
cd /tmp/immunity && git pull
cp skills/*.md /path/to/project/.claude/skills/
cp agents/*.md /path/to/project/.claude/agents/
```

## Uninstall

```bash
# Remove skill files
rm .claude/skills/contracts.md
rm .claude/skills/critic.md
rm .claude/skills/ripple.md
rm .claude/skills/prodlens.md

# (Optional) Remove contract data
rm -rf .contracts/

# (Optional) Remove hook settings
# Remove immunity-related hooks from .claude/settings.json
```

Contract data (`.contracts/`) is independent of the skills. Removing skills doesn't affect contract data. Reinstall later and existing contracts will work as before.
