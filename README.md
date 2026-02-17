# Claude Profile Manager

A marketplace for saving, sharing, and loading Claude CLI configuration profiles.

[![npm version](https://img.shields.io/npm/v/cli-profile-manager)](https://www.npmjs.com/package/cli-profile-manager)
[![License](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

## What is this?

Claude Profile Manager (`cpm`) lets you:

- **Save** your `.claude` folder as a shareable profile
- **Load** profiles to switch between configurations
- **Browse** a marketplace of community-created profiles
- **Share** your profiles with others

Dotfiles for Claude CLI, with a built-in plugin marketplace.

## Installation

```bash
npm install -g cli-profile-manager
```

Requires Node.js 18+.

## Quick Start

```bash
# Save your current Claude config as a profile
cpm save my-setup

# List profiles in the marketplace
cpm list

# Install a profile from the marketplace
cpm install marketplace/senior-developer

# Load your saved profile
cpm load my-setup
```

## Commands

### Local Profile Management

```bash
cpm save <name> [--description "desc"] [--tags "tag1,tag2"]
cpm load <name> [--backup] [--force]
cpm local
cpm info <name>
cpm delete <name> [--force]
```

### Marketplace

```bash
cpm list [--category <cat>] [--refresh]
cpm search <query>
cpm install author/profile-name [--backup] [--force]
cpm info author/profile-name
```

### Publishing

```bash
cpm publish <name>
cpm repo owner/repo-name
```

### Configuration

```bash
cpm config
```

## What's in a Profile?

A profile snapshots your `.claude` folder:

- `CLAUDE.md` - Custom instructions
- `commands/` - Custom slash commands
- `hooks/` - Event hooks
- `skills/` - Custom skills
- `mcp.json` & `mcp_servers/` - MCP server configurations
- `plugins/` - User-authored plugins
- `agents/` - Custom agents

Sensitive files (credentials, API keys) are excluded by default.

## Example Workflows

### Switch Between Work Personas

```bash
# save current claude config
cpm save work-reviewer --tags "work,code-review"
# ... Modify claude config ...
cpm save docs-writer --tags "work,documentation"

cpm load work-reviewer
# ... do code reviews ...
cpm load docs-writer
# ... write documentation ...
```

### Share Team Configuration

```bash
cpm save team-standards --description "Our team's Claude configuration"
cpm publish team-standards

# Team members install it
cpm install yourname/team-standards
```

### Try Community Profiles

```bash
cpm list
cpm search ts
cpm install marketplace/ts-expert --backup

# Restore if needed
cpm load .claude-backup-*
```

## Profile Storage

```
~/.claude-profiles/
├── config.json
├── my-setup/
│   ├── profile.json
│   ├── CLAUDE.md
│   ├── commands/
│   └── hooks/
└── .cache/
    └── marketplace-index.json
```

## Contributing Profiles

1. Save your profile: `cpm save my-awesome-profile`
2. Publish it: `cpm publish my-awesome-profile`

See [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed guidelines.

## Custom Marketplace

Host your own marketplace (e.g., for your company):

1. Fork this repository
2. Add profiles to `profiles/`
3. Update `index.json`
4. Point users to your repo: `cpm repo your-org/your-marketplace`

## Auto-Install in Codespaces / Devcontainers

Install Claude Code and a marketplace profile automatically with a single `postCreateCommand`.

### Setup

Add to your `.devcontainer/devcontainer.json`:

```json
"postCreateCommand": "curl -fsSL https://raw.githubusercontent.com/brrichards/cli-profile-manager/main/scripts/install-profile.mjs -o /tmp/install-profile.mjs && node /tmp/install-profile.mjs marketplace devtools && rm -f /tmp/install-profile.mjs"
```

Replace `marketplace devtools` with your desired `<author> <profile>`.

### How It Works

The install script runs three steps:

1. **Installs Claude Code CLI** via `npm install -g @anthropic-ai/claude-code` (skipped if already present)
2. **Fetches the profile manifest** (`profile.json`) from GitHub raw content for the requested author/profile
3. **Maps marketplace files** into Claude Code's native config structure:

| Marketplace Path | Installed To |
|---|---|
| `CLAUDE.md` | `~/.claude/CLAUDE.md` (appended) |
| `commands/<name>.md` | `~/.claude/commands/<name>.md` |
| `skills/<name>/SKILL.md` | `~/.claude/skills/<name>/SKILL.md` |
| `agents/<name>.md` | `~/.claude/agents/<name>.md` |
| `hooks/<name>.md` | `~/.claude/hooks/<name>.md` |

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `SKIP_CLAUDE_INSTALL` | `0` | Skip Claude Code CLI install |
| `PROFILE_BRANCH` | `main` | Branch to fetch profiles from |
| `CLAUDE_HOME` | `~/.claude` | Override the Claude config directory |

### Prerequisites

- **Node.js 18+** (uses built-in `fetch`, `fs`, and `path`)
- `postCreateCommand` runs once on container creation and on full rebuild, but not on stop/start.

## Authentication

### How `cpm publish` Authenticates

When you run `cpm publish`, authentication happens in two stages:

1. **Git Credential Manager** — `cpm` first tries to read an existing GitHub token from your local git credential store (`git credential fill`). If you already have credentials stored (e.g., from `gh auth login` or a PAT), this works automatically.
2. **OAuth Device Flow** — If no stored credentials are found, `cpm` falls back to GitHub's OAuth device flow. It displays a URL and a one-time code, you authorize in your browser, and `cpm` receives a token. No manual PAT creation needed.

### Why This Matters in Codespaces

GitHub Codespaces automatically provides a `GITHUB_TOKEN`, but this token is **scoped to the current repository only**. Publishing a profile requires:

1. **Forking** the marketplace repo (`brrichards/cli-profile-manager`)
2. **Pushing a branch** to that fork
3. **Opening a pull request** back to the upstream repo

The Codespace's repo-scoped token cannot perform any of these operations on a different repository. To work around this, `cpm publish` bypasses local git entirely and uses the **GitHub Git Data API** to create commits and branches directly via authenticated API calls. This requires a token with `public_repo` scope, which is obtained through the OAuth device flow.

This design also benefits users outside Codespaces — no need to configure SSH keys or manually create PATs. The device flow handles everything.

## Repository Structure

```
cli-profile-manager/
├── src/                    # NPM package source
│   ├── cli.js             # CLI entry point
│   ├── commands/          # Command implementations
│   └── utils/             # Utilities
├── scripts/               # Automation scripts
│   └── install-profile.mjs  # Codespace/devcontainer auto-installer
├── profiles/              # Marketplace profiles
│   └── author/
│       └── profile-name/
│           ├── profile.json
│           └── ...
├── index.json             # Marketplace index
├── package.json
└── README.md
```

## License

MIT License - see [LICENSE](./LICENSE) for details.
