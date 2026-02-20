#!/usr/bin/env node

// Installs a cpm marketplace profile directly — no cpm CLI required.
// Suitable for use in Codespaces postCreateCommand, devcontainers, and CI.
//
// Usage:
//   node install-profile.mjs <author> <profile> [claude|github]
//
//   # Claude Code (default)
//   node install-profile.mjs marketplace devtools
//   node install-profile.mjs marketplace devtools claude
//
//   # GitHub Copilot
//   node install-profile.mjs myorg frontend-team github
//
// Environment variables (optional):
//   PROVIDER=claude|github      Provider override (default: claude)
//   SKIP_CLAUDE_INSTALL=1       Skip installing Claude Code CLI
//   PROFILE_BRANCH=main         Branch to fetch profiles from
//   CLAUDE_HOME=<path>          Override the Claude config directory
//   GITHUB_HOME=<path>          Override the .github directory (default: .github in cwd)

import { execSync } from "child_process";
import { mkdirSync, writeFileSync, appendFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const [author, profile, providerArg] = process.argv.slice(2);
if (!author || !profile) {
  console.error("Usage: install-profile.mjs <author> <profile> [claude|github]");
  process.exit(1);
}

const provider = (providerArg || process.env.PROVIDER || "claude").toLowerCase();
if (provider !== "claude" && provider !== "github") {
  console.error(`Unknown provider: ${provider}. Must be 'claude' or 'github'.`);
  process.exit(1);
}

const REPO   = "brrichards/cli-profile-manager";
const BRANCH = process.env.PROFILE_BRANCH || "main";
const PROFILES_BASE = `profiles/${provider}`;
const RAW_BASE = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${PROFILES_BASE}/${author}/${profile}`;

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.text();
}

// ─── Claude Code ─────────────────────────────────────────────────────────────

async function installClaude() {
  if (process.env.SKIP_CLAUDE_INSTALL !== "1") {
    try {
      execSync("claude --version", { stdio: "ignore" });
      console.log("==> Claude Code CLI already installed, skipping.");
    } catch {
      console.log("==> Installing Claude Code CLI...");
      execSync("npm install -g @anthropic-ai/claude-code", { stdio: "inherit" });
    }
  }

  // Resolve install directory: check cwd/.claude first, then ~/.claude
  const CLAUDE_DIR =
    process.env.CLAUDE_HOME ||
    (existsSync(join(process.cwd(), ".claude"))
      ? join(process.cwd(), ".claude")
      : join(homedir(), ".claude"));

  console.log(`==> Fetching Claude profile: ${author}/${profile}...`);
  const manifest = JSON.parse(await fetchText(`${RAW_BASE}/profile.json`));
  const contents = manifest.contents || {};

  // Instructions (appended to CLAUDE.md)
  for (const file of contents.instructions || []) {
    console.log(`    Installing instruction: ${file}`);
    const body = await fetchText(`${RAW_BASE}/${file}`);
    mkdirSync(CLAUDE_DIR, { recursive: true });
    appendFileSync(join(CLAUDE_DIR, "CLAUDE.md"), body + "\n");
  }

  // Commands
  for (const cmd of contents.commands || []) {
    console.log(`    Installing command: ${cmd}`);
    const cmdDir = join(CLAUDE_DIR, "commands");
    mkdirSync(cmdDir, { recursive: true });
    const body = await fetchText(`${RAW_BASE}/commands/${cmd}.md`);
    writeFileSync(join(cmdDir, `${cmd}.md`), body);
  }

  // Skills
  for (const skill of contents.skills || []) {
    console.log(`    Installing skill: ${skill}`);
    const skillDir = join(CLAUDE_DIR, "skills", skill);
    mkdirSync(skillDir, { recursive: true });
    const body = await fetchText(`${RAW_BASE}/skills/${skill}/SKILL.md`);
    writeFileSync(join(skillDir, "SKILL.md"), body);
  }

  // Agents
  for (const agent of contents.agents || []) {
    console.log(`    Installing agent: ${agent}`);
    const agentsDir = join(CLAUDE_DIR, "agents");
    mkdirSync(agentsDir, { recursive: true });
    const body = await fetchText(`${RAW_BASE}/agents/${agent}.md`);
    writeFileSync(join(agentsDir, `${agent}.md`), body);
  }

  // Hooks
  for (const hook of contents.hooks || []) {
    console.log(`    Installing hook: ${hook}`);
    const hooksDir = join(CLAUDE_DIR, "hooks");
    mkdirSync(hooksDir, { recursive: true });
    const body = await fetchText(`${RAW_BASE}/hooks/${hook}.md`);
    writeFileSync(join(hooksDir, `${hook}.md`), body);
  }

  console.log(`\n==> Done! Claude profile '${author}/${profile}' installed to ${CLAUDE_DIR}`);
}

// ─── GitHub Copilot ───────────────────────────────────────────────────────────

async function installGitHub() {
  // Profiles are installed to .github/<profile-name>/ in the current project.
  // Override with GITHUB_HOME env var if needed.
  const githubDir =
    process.env.GITHUB_HOME ||
    (existsSync(join(process.cwd(), ".github"))
      ? join(process.cwd(), ".github")
      : join(homedir(), ".github"));

  const destDir = join(githubDir, profile);

  console.log(`==> Fetching GitHub Copilot profile: ${author}/${profile}...`);
  const manifest = JSON.parse(await fetchText(`${RAW_BASE}/profile.json`));
  const contents = manifest.contents || {};

  mkdirSync(destDir, { recursive: true });

  // copilot-instructions.md
  for (const file of contents.instructions || []) {
    if (file === "copilot-instructions.md") {
      console.log(`    Installing instructions: ${file}`);
      const body = await fetchText(`${RAW_BASE}/${file}`);
      writeFileSync(join(destDir, "copilot-instructions.md"), body);
    }
  }

  // Skills
  for (const skill of contents.skills || []) {
    console.log(`    Installing skill: ${skill}`);
    const skillDir = join(destDir, "skills", skill);
    mkdirSync(skillDir, { recursive: true });
    const body = await fetchText(`${RAW_BASE}/skills/${skill}/SKILL.md`);
    writeFileSync(join(skillDir, "SKILL.md"), body);
  }

  // Agents
  for (const agent of contents.agents || []) {
    console.log(`    Installing agent: ${agent}`);
    const agentsDir = join(destDir, "agents");
    mkdirSync(agentsDir, { recursive: true });
    const body = await fetchText(`${RAW_BASE}/agents/${agent}.md`);
    writeFileSync(join(agentsDir, `${agent}.md`), body);
  }

  // Custom instructions
  for (const instruction of contents.instructions || []) {
    if (instruction === "copilot-instructions.md") continue; // handled above
    console.log(`    Installing instruction: ${instruction}`);
    const instructionsDir = join(destDir, "instructions");
    mkdirSync(instructionsDir, { recursive: true });
    const body = await fetchText(`${RAW_BASE}/instructions/${instruction}.md`);
    writeFileSync(join(instructionsDir, `${instruction}.md`), body);
  }

  // MCP config
  if ((contents.mcp || []).includes("mcp-config.json")) {
    console.log(`    Installing mcp-config.json`);
    const body = await fetchText(`${RAW_BASE}/mcp-config.json`);
    writeFileSync(join(destDir, "mcp-config.json"), body);
  }

  console.log(`\n==> Done! GitHub Copilot profile '${author}/${profile}' installed to ${destDir}`);
}

// ─── Entry point ─────────────────────────────────────────────────────────────

async function main() {
  if (provider === "claude") {
    await installClaude();
  } else {
    await installGitHub();
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
