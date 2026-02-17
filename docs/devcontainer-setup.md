# Auto-Install Claude Code + Marketplace Profiles

Install Claude Code and a marketplace profile automatically. One command, all platforms.

## Codespaces / Devcontainers

Add a `postCreateCommand` to `.devcontainer/devcontainer.json`:

```json
{
  "name": "Dev with Claude Code",
  "image": "mcr.microsoft.com/devcontainers/universal:2",
  "features": {
    "ghcr.io/devcontainers/features/node:1": {
      "version": "lts"
    }
  },
  "postCreateCommand": "node <(curl -fsSL https://raw.githubusercontent.com/brrichards/cli-profile-manager/main/scripts/install-profile.mjs) marketplace devtools",
  "customizations": {
    "vscode": {
      "extensions": ["anthropic.claude-code"]
    }
  }
}
```

## Local Install

Requires Node.js 18+.

```bash
curl -fsSL https://raw.githubusercontent.com/brrichards/cli-profile-manager/main/scripts/install-profile.mjs -o install-profile.mjs && node install-profile.mjs marketplace devtools
```

Or from a cloned repo:

```bash
node scripts/install-profile.mjs marketplace devtools
```

## Available Profiles

```bash
node install-profile.mjs marketplace devtools
node install-profile.mjs marketplace code-quality
node install-profile.mjs marketplace git-workflow
```

Full list in [`index.json`](../index.json).

## How It Works

The script fetches the profile's `profile.json` manifest from GitHub and maps files into Claude Code's native structure:

| Marketplace Path | Installed To |
|---|---|
| `CLAUDE.md` | `~/.claude/CLAUDE.md` (appended) |
| `commands/<name>.md` | `~/.claude/skills/<name>/SKILL.md` |
| `hooks/<name>.md` | `~/.claude/hooks/<name>.md` |

### Prerequisites

- **Node.js 18+** (uses built-in `fetch`, `fs`, and `path`)

## Chaining With Existing Setup

```json
{
  "postCreateCommand": "npm install && node <(curl -fsSL https://raw.githubusercontent.com/brrichards/cli-profile-manager/main/scripts/install-profile.mjs) marketplace devtools"
}
```

## Multiple Profiles

```bash
node install-profile.mjs marketplace devtools && node install-profile.mjs marketplace code-quality
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `SKIP_CLAUDE_INSTALL` | `0` | Skip Claude Code CLI install |
| `PROFILE_BRANCH` | `main` | Branch to fetch profiles from |
| `CLAUDE_HOME` | `~/.claude` | Override the Claude config directory |
