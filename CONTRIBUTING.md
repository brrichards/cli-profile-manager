# Contributing

How to share your Claude CLI profiles with the community.

## Quick Start

```bash
npm install -g cli-profile-manager
cpm save my-awesome-profile --description "My custom setup" --tags "python,testing"
cpm publish my-awesome-profile
```

## Adding a Profile Manually

### 1. Fork this Repository

### 2. Create Your Profile Directory

```bash
mkdir -p profiles/YOUR_USERNAME/your-profile-name
```

### 3. Add Required Files

```
profiles/your-username/your-profile-name/
├── profile.json      # Metadata (required)
├── CLAUDE.md         # Instructions (optional)
├── commands/         # Slash commands (optional)
├── hooks/            # Event hooks (optional)
└── skills/           # Custom skills (optional)
```

#### profile.json

```json
{
  "name": "your-profile-name",
  "version": "1.0.0",
  "description": "A clear description of what this profile does",
  "author": "your-github-username",
  "tags": ["tag1", "tag2"],
  "createdAt": "2025-02-15T00:00:00Z",
  "platform": "cross-platform",
  "files": ["CLAUDE.md", "commands/review.md"],
  "contents": {
    "instructions": ["CLAUDE.md"],
    "commands": ["review"]
  }
}
```

### 4. Update index.json

Add your profile to the root `index.json`.

### 5. Submit a Pull Request

- Title: `Add profile: your-username/your-profile-name`
- Description: What your profile does and who it's for

## Guidelines

### Profile Names
- Lowercase letters, numbers, and hyphens
- Be descriptive: `python-testing` not `my-profile`

### Descriptions
- Clearly explain what the profile does
- Mention key features or use cases
- Keep it under 200 characters

### Tags
Use relevant tags:
- `code-review`, `testing`, `documentation`
- `security`, `debugging`, `refactoring`
- `python`, `javascript`, `typescript`, `go`, `rust`
- `frontend`, `backend`, `fullstack`, `devops`
- `beginner`, `advanced`

### Security
- Never include credentials, tokens, or API keys
- Review your snapshot before publishing
