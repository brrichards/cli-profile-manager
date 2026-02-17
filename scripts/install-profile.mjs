#!/usr/bin/env node

// Usage:
//   npx -y https://raw.githubusercontent.com/brrichards/cli-profile-manager/main/scripts/install-profile.mjs marketplace devtools
//   node install-profile.mjs <author> <profile>
//
// Environment variables (optional):
//   SKIP_CLAUDE_INSTALL=1   Skip installing Claude Code CLI
//   PROFILE_BRANCH=main     Branch to fetch profiles from
//   CLAUDE_HOME=<path>      Override the Claude config directory

import { execSync } from "child_process";
import { mkdirSync, writeFileSync, appendFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const [author, profile] = process.argv.slice(2);
if (!author || !profile) {
  console.error("Usage: install-profile.mjs <author> <profile>");
  process.exit(1);
}

const REPO = "brrichards/cli-profile-manager";
const BRANCH = process.env.PROFILE_BRANCH || "main";
const RAW_BASE = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/profiles/${author}/${profile}`;
const CLAUDE_DIR = process.env.CLAUDE_HOME || join(homedir(), ".claude");

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.text();
}

async function main() {
  // Install Claude Code CLI
  if (process.env.SKIP_CLAUDE_INSTALL !== "1") {
    try {
      execSync("claude --version", { stdio: "ignore" });
      console.log("==> Claude Code CLI already installed, skipping.");
    } catch {
      console.log("==> Installing Claude Code CLI...");
      execSync("npm install -g @anthropic-ai/claude-code", { stdio: "inherit" });
    }
  }

  // Fetch profile manifest
  console.log(`==> Fetching profile: ${author}/${profile}...`);
  const manifest = JSON.parse(await fetchText(`${RAW_BASE}/profile.json`));
  const contents = manifest.contents || {};

  // Install instructions (CLAUDE.md)
  for (const file of contents.instructions || []) {
    console.log(`    Installing instruction: ${file}`);
    const body = await fetchText(`${RAW_BASE}/${file}`);
    mkdirSync(CLAUDE_DIR, { recursive: true });
    appendFileSync(join(CLAUDE_DIR, "CLAUDE.md"), body + "\n");
  }

  // Install commands
  for (const cmd of contents.commands || []) {
    console.log(`    Installing command: ${cmd}`);
    const cmdDir = join(CLAUDE_DIR, "commands");
    mkdirSync(cmdDir, { recursive: true });
    const body = await fetchText(`${RAW_BASE}/commands/${cmd}.md`);
    writeFileSync(join(cmdDir, `${cmd}.md`), body);
  }

  // Install skills
  for (const skill of contents.skills || []) {
    console.log(`    Installing skill: ${skill}`);
    const skillDir = join(CLAUDE_DIR, "skills", skill);
    mkdirSync(skillDir, { recursive: true });
    const body = await fetchText(`${RAW_BASE}/skills/${skill}/SKILL.md`);
    writeFileSync(join(skillDir, "SKILL.md"), body);
  }

  // Install agents
  for (const agent of contents.agents || []) {
    console.log(`    Installing agent: ${agent}`);
    const agentsDir = join(CLAUDE_DIR, "agents");
    mkdirSync(agentsDir, { recursive: true });
    const body = await fetchText(`${RAW_BASE}/agents/${agent}.md`);
    writeFileSync(join(agentsDir, `${agent}.md`), body);
  }

  // Install hooks
  for (const hook of contents.hooks || []) {
    console.log(`    Installing hook: ${hook}`);
    const hooksDir = join(CLAUDE_DIR, "hooks");
    mkdirSync(hooksDir, { recursive: true });
    const body = await fetchText(`${RAW_BASE}/hooks/${hook}.md`);
    writeFileSync(join(hooksDir, `${hook}.md`), body);
  }

  console.log(`\n==> Done! Profile '${author}/${profile}' installed to ${CLAUDE_DIR}`);

  // TODO - Add plugin/MCP install (currently no default profile includes these, but good to support in the future) 
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
