# CLI Profile Manager

A marketplace for saving, sharing, and loading CLI configuration profiles — supports **Claude Code** and **GitHub Copilot** CLI.

[![npm version](https://img.shields.io/npm/v/cli-profile-manager)](https://www.npmjs.com/package/cli-profile-manager)
[![License](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

## What is this?

CLI Profile Manager (`cpm`) lets you:

- **Save** your CLI configuration as a shareable profile
- **Load** profiles to switch between configurations
- **Browse** a marketplace of community-created profiles
- **Share** your profiles with others

Every command accepts a `--provider` flag to target either Claude Code or GitHub Copilot.

## Installation

```bash
npm install -g cli-profile-manager
```

Requires Node.js 18+.

## Quick Start

```bash
# Save your current Claude Code config as a profile
cpm save my-setup --provider claude

# Save your current GitHub Copilot config as a profile
cpm save my-copilot-setup --provider github

# Browse the marketplace
cpm list --provider claude
cpm list --provider github

# Install a profile from the marketplace
cpm install author/senior-developer --provider claude

# Load a locally saved profile
cpm load my-setup --provider claude
```

## Providers

### Claude Code (`--provider claude`)

Profiles snapshot your `.claude` folder and include:

| Item | Description |
|---|---|
| `CLAUDE.md` | Custom instructions |
| `commands/` | Custom slash commands |
| `hooks/` | Event hooks |
| `skills/` | Custom skills |
| `mcp.json` & `mcp_servers/` | MCP server configurations |
| `plugins/` | User-authored plugins |
| `agents/` | Custom agents |

Profiles are stored locally in `~/.cli-profiles/claude/` and installed to your `.claude` directory.

### GitHub Copilot (`--provider github`)

Profiles capture GitHub Copilot customizations and include:

| Item | Description |
|---|---|
| `copilot-instructions.md` | Custom Copilot instructions |
| `skills/` | Custom skills |
| `agents/` | Custom agents |

Profiles are stored locally in `~/.cli-profiles/github/`. When loaded, a profile is installed to `.github/<profile-name>/` in the current project directory (e.g., `.github/my-setup/`).

Sensitive files (credentials, API keys) are excluded from all profiles by default.

## Commands

All commands accept `-p, --provider <claude|github>`. Defaults to `claude` if omitted.

### Local Profile Management

```bash
cpm save <name> [--provider <p>] [--description "desc"] [--tags "tag1,tag2"]
cpm load <name> [--provider <p>] [--backup] [--force]
cpm local       [--provider <p>]
cpm info <name> [--provider <p>]
cpm delete <name> [--provider <p>] [--force]
```

### Marketplace

```bash
cpm list   [--provider <p>] [--category <cat>] [--refresh]
cpm search <query> [--provider <p>]
cpm install author/profile-name [--provider <p>] [--backup] [--force]
cpm info   author/profile-name [--provider <p>]
```

### Publishing

```bash
cpm publish <name> [--provider <p>]
cpm repo owner/repo-name
```

### Configuration

```bash
cpm config
```

## Example Workflows

### Switch Between Claude Code Personas

```bash
cpm save work-reviewer --provider claude --tags "work,code-review"
cpm save docs-writer   --provider claude --tags "work,documentation"

cpm load work-reviewer --provider claude
# ... do code reviews ...
cpm load docs-writer --provider claude
# ... write documentation ...
```

### Manage GitHub Copilot Profiles Per Project

```bash
# Snapshot your current .github/ copilot config
cpm save frontend-team --provider github --description "Frontend team Copilot setup"

# Install the profile into this project
cpm load frontend-team --provider github
# → installs to .github/frontend-team/

# Share it with the team
cpm publish frontend-team --provider github
```

### Share Team Configurations

```bash
# Claude Code
cpm save team-standards --provider claude --description "Our team's Claude configuration"
cpm publish team-standards --provider claude

# GitHub Copilot
cpm save team-copilot --provider github --description "Our team's Copilot setup"
cpm publish team-copilot --provider github

# Team members install it
cpm install yourname/team-standards --provider claude
cpm install yourname/team-copilot --provider github
```

## Profile Storage

```
~/.cli-profiles/
├── config.json
├── claude/                        # Claude Code profiles
│   ├── my-setup/
│   │   ├── profile.json
│   │   ├── CLAUDE.md
│   │   ├── commands/
│   │   └── hooks/
│   └── .cache/
│       └── claude-marketplace-index.json
└── github/                        # GitHub Copilot profiles
    ├── my-copilot-setup/
    │   ├── profile.json
    │   ├── copilot-instructions.md
    │   ├── skills/
    │   └── agents/
    └── .cache/
        └── github-marketplace-index.json
```

When a GitHub Copilot profile is loaded into a project:

```
<project-root>/
└── .github/
    └── my-copilot-setup/          # installed profile
        ├── copilot-instructions.md
        ├── skills/
        └── agents/
```

## Marketplace Repository Structure

```
cli-profile-manager/
├── profiles/
│   ├── claude/                    # Claude Code marketplace profiles
│   │   ├── index.json
│   │   └── author/profile-name/
│   │       ├── profile.json
│   │       └── ...
│   └── github/                    # GitHub Copilot marketplace profiles
│       ├── index.json
│       └── author/profile-name/
│           ├── profile.json
│           ├── copilot-instructions.md
│           ├── skills/
│           └── agents/
└── README.md
```

## Contributing Profiles

1. Save your profile: `cpm save my-awesome-profile --provider <claude|github>`
2. Publish it: `cpm publish my-awesome-profile --provider <claude|github>`

A pull request will be opened automatically against the marketplace repository for review.

See [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed guidelines.

## Custom Marketplace

Host your own marketplace (e.g., for your company):

1. Fork this repository
2. Add profiles to `profiles/claude/` and/or `profiles/github/`
3. Update the relevant `index.json`
4. Point users to your repo: `cpm repo your-org/your-marketplace`

## Auto-Install in Codespaces / Devcontainers

Install Claude Code and a marketplace profile automatically with a single `postCreateCommand`.

### Setup

Add to your `.devcontainer/devcontainer.json`:

```json
// Claude Code profile
"postCreateCommand": "curl -fsSL https://raw.githubusercontent.com/brrichards/cli-profile-manager/main/scripts/install-profile.mjs -o /tmp/install-profile.mjs && node /tmp/install-profile.mjs marketplace devtools claude && rm -f /tmp/install-profile.mjs"

// GitHub Copilot profile
"postCreateCommand": "curl -fsSL https://raw.githubusercontent.com/brrichards/cli-profile-manager/main/scripts/install-profile.mjs -o /tmp/install-profile.mjs && node /tmp/install-profile.mjs myorg frontend-team github && rm -f /tmp/install-profile.mjs"
```

Replace `<author> <profile>` with your desired profile. The third argument selects the provider (`claude` or `github`, defaults to `claude`).

### How It Works

Note: The script checks the repo root for a `.claude` (or `.github`) directory first before falling back to the home directory. To force project-scoped installation, create the directory in the repo root:

```bash
mkdir .claude    # for Claude Code
mkdir .github    # for GitHub Copilot
```

The install script runs three steps:

1. **Installs Claude Code CLI** via `npm install -g @anthropic-ai/claude-code` (skipped if already present)
2. **Fetches the profile manifest** (`profile.json`) from GitHub raw content for the requested author/profile
3. **Maps marketplace files** into the CLI's native config structure:

**Claude Code** (`profiles/claude/<author>/<profile>/`):

| Marketplace Path | Installed To |
|---|---|
| `CLAUDE.md` | `<claude-dir>/CLAUDE.md` (appended) |
| `commands/<name>.md` | `<claude-dir>/commands/<name>.md` |
| `skills/<name>/SKILL.md` | `<claude-dir>/skills/<name>/SKILL.md` |
| `agents/<name>.md` | `<claude-dir>/agents/<name>.md` |
| `hooks/<name>.md` | `<claude-dir>/hooks/<name>.md` |

**GitHub Copilot** (`profiles/github/<author>/<profile>/`):

| Marketplace Path | Installed To |
|---|---|
| `copilot-instructions.md` | `<github-dir>/<profile>/copilot-instructions.md` |
| `skills/<name>/SKILL.md` | `<github-dir>/<profile>/skills/<name>/SKILL.md` |
| `agents/<name>.md` | `<github-dir>/<profile>/agents/<name>.md` |

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PROVIDER` | `claude` | Provider to install (`claude` or `github`) |
| `SKIP_CLAUDE_INSTALL` | `0` | Skip Claude Code CLI install (Claude only) |
| `PROFILE_BRANCH` | `main` | Branch to fetch profiles from |
| `CLAUDE_HOME` | `<cwd>/.claude` or `~/.claude` | Override the Claude config directory |
| `GITHUB_HOME` | `<cwd>/.github` or `~/.github` | Override the .github directory (GitHub only) |

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

## Source Structure

```
cli-profile-manager/
├── src/
│   ├── cli.ts                     # CLI entry point
│   ├── commands/                  # Thin command wrappers
│   ├── types/                     # Interfaces and factory
│   ├── providers/
│   │   ├── claude/                # Claude Code provider
│   │   └── github/                # GitHub Copilot provider
│   └── utils/                     # Shared utilities (config, auth)
├── dist/                          # Compiled output
└── profiles/                      # Marketplace profiles
```

## License

MIT License - see [LICENSE](./LICENSE) for details.
