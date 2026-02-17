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
cpm save work-reviewer --tags "work,code-review"
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
cpm search python
cpm install marketplace/python-expert --backup

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

## Repository Structure

```
cli-profile-manager/
├── src/                    # NPM package source
│   ├── cli.js             # CLI entry point
│   ├── commands/          # Command implementations
│   └── utils/             # Utilities
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
