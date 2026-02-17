# Auto-Install Claude Code + Marketplace Profiles

Install Claude Code and a marketplace profile in a Codespace or devcontainer with a single `postCreateCommand`.

## Setup

Add to your `.devcontainer/devcontainer.json`:

```json
"postCreateCommand": "curl -fsSL https://raw.githubusercontent.com/brrichards/cli-profile-manager/main/scripts/install-profile.mjs -o /tmp/install-profile.mjs && node /tmp/install-profile.mjs marketplace devtools && rm -f /tmp/install-profile.mjs"
```

Replace `marketplace devtools` with your desired `<author> <profile>`.

## How It Works

The script installs Claude Code CLI (if not present) and fetches the profile's `profile.json` manifest from GitHub, mapping files into Claude Code's native structure:

| Marketplace Path | Installed To |
|---|---|
| `CLAUDE.md` | `~/.claude/CLAUDE.md` (appended) |
| `commands/<name>.md` | `~/.claude/skills/<name>/SKILL.md` |
| `hooks/<name>.md` | `~/.claude/hooks/<name>.md` |

## Available Profiles

Full list in [`index.json`](../index.json).

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `SKIP_CLAUDE_INSTALL` | `0` | Skip Claude Code CLI install |
| `PROFILE_BRANCH` | `main` | Branch to fetch profiles from |
| `CLAUDE_HOME` | `~/.claude` | Override the Claude config directory |

## Prerequisites

- **Node.js 18+** (uses built-in `fetch`, `fs`, and `path`)
- `postCreateCommand` runs once on container creation and on full rebuild, but not on stop/start.
