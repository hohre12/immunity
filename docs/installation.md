# Immunity — Installation Guide

## Installation

### Method 1: Plugin install (recommended)

In Claude Code, run:

```
/plugin marketplace add hohre12/immunity
/plugin install immunity@hohre12-immunity
```

This registers the marketplace and installs all 4 skills + agents automatically.

### Method 2: Local development / testing

```bash
git clone https://github.com/hohre12/immunity.git
claude --plugin-dir ./immunity
```

### Method 3: Manual file copy (fallback)

```bash
git clone https://github.com/hohre12/immunity.git /tmp/immunity

# Copy skill directories
cp -r /tmp/immunity/skills/critic/ .claude/skills/critic/
cp -r /tmp/immunity/skills/contracts/ .claude/skills/contracts/
cp -r /tmp/immunity/skills/ripple/ .claude/skills/ripple/
cp -r /tmp/immunity/skills/prodlens/ .claude/skills/prodlens/

# Copy agent files
cp /tmp/immunity/agents/*.md .claude/agents/
```

## Verify Installation

```
# In Claude Code, run any skill:
/immunity:critic
→ If prompted for a review target or starts analyzing, installation succeeded

/immunity:contracts list
→ If it reports "no contracts found" or shows existing contracts, installation succeeded
```

## Hook Setup (Optional)

To get reminders about contract verification when files are modified, copy the hook template:

```bash
# View the hook template
cat /tmp/immunity/hooks/immunity-hooks.json
```

Then add the hook configuration to your `.claude/settings.json`:

```jsonc
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "command": "sh -c 'if [ -d .contracts ]; then echo \"[immunity] Contracts exist in this project. Consider running /immunity:contracts verify to check for violations.\"; fi'"
      }
    ]
  }
}
```

This is a **reminder**, not automatic enforcement. When files are modified and `.contracts/` exists, it prompts the agent to consider running `/immunity:contracts verify`.

## Plugin vs Manual Install

| Method | Skills invoked as | Best for |
|--------|------------------|----------|
| Plugin install | `/immunity:critic` | Most users |
| Manual copy | `/critic` | Customization, forking |

## Dependencies

None.

- No Node.js required
- No Python required
- No additional packages required
- No MCP server required

Just markdown files. If Claude Code is installed, you're ready to go.

## Update

```
# Plugin install
/plugin uninstall immunity@hohre12-immunity
/plugin install immunity@hohre12-immunity

# Manual install
cd /tmp/immunity && git pull
cp -r skills/*/ /path/to/project/.claude/skills/
cp agents/*.md /path/to/project/.claude/agents/
```

## Uninstall

```
# Plugin install
/plugin uninstall immunity@hohre12-immunity

# Manual install
rm -rf .claude/skills/critic/
rm -rf .claude/skills/contracts/
rm -rf .claude/skills/ripple/
rm -rf .claude/skills/prodlens/
rm .claude/agents/critic-reviewer.md
rm .claude/agents/prod-reviewer.md
rm .claude/agents/ripple-tracer.md
```

Contract data (`.contracts/`) is independent of the plugin. Removing the plugin doesn't affect contract data. Reinstall later and existing contracts will work as before.
