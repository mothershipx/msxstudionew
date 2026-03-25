#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const expectedAgentCount = Number(process.env.MSX_EXPECT_OPENCLAW_AGENTS ?? "157");
const openclawConfigPath =
  process.env.OPENCLAW_CONFIG_PATH ?? path.join(os.homedir(), ".openclaw", "openclaw.json");
const agencyAgentsDir =
  process.env.OPENCLAW_AGENCY_AGENTS_DIR ?? path.join(os.homedir(), ".openclaw", "agency-agents");

function log(message) {
  console.log(`[bootstrap-openclaw-fleet] ${message}`);
}

function fail(message) {
  console.error(`[bootstrap-openclaw-fleet] ${message}`);
  process.exit(1);
}

function run(command, args, options = {}) {
  try {
    return execFileSync(command, args, {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      ...options,
    });
  } catch (error) {
    if (error && typeof error === "object" && "stderr" in error && typeof error.stderr === "string") {
      throw new Error(error.stderr.trim() || `${command} ${args.join(" ")} failed.`);
    }
    throw error;
  }
}

function ensureCommand(name, versionArgs = ["--version"]) {
  try {
    const output = run(name, versionArgs).trim();
    log(`${name} ok: ${output.split("\n")[0]}`);
  } catch (error) {
    fail(`Missing required command \`${name}\`. Install it and try again.`);
  }
}

function readOpenClawConfig() {
  if (!existsSync(openclawConfigPath)) {
    fail(
      `OpenClaw config not found at ${openclawConfigPath}. ` +
        "Install OpenClaw and make sure this machine has the fleet locally.",
    );
  }

  try {
    return JSON.parse(readFileSync(openclawConfigPath, "utf8"));
  } catch (error) {
    fail(`Could not parse ${openclawConfigPath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function loadAgentsFromCli() {
  try {
    return JSON.parse(run("openclaw", ["agents", "list", "--json"]));
  } catch (error) {
    log(`OpenClaw CLI agent probe failed, falling back to config file: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

function loadAgentsFromConfig(config) {
  const agents = config?.agents?.list;
  return Array.isArray(agents) ? agents : [];
}

function uniqueAgentIds(agents) {
  return [...new Set(agents.map((agent) => agent?.id).filter(Boolean))];
}

function countSpecialistDirectories(directory) {
  if (!existsSync(directory)) {
    return 0;
  }

  return readdirSync(directory, { withFileTypes: true }).filter((entry) => entry.isDirectory()).length;
}

function validateFleet(agentIds, specialistCount) {
  if (!agentIds.includes("main")) {
    fail("OpenClaw fleet is missing the `main` agent.");
  }
  if (!agentIds.includes("agents-orchestrator")) {
    fail("OpenClaw fleet is missing the `agents-orchestrator` agent.");
  }

  if (expectedAgentCount > 0 && agentIds.length < expectedAgentCount) {
    fail(
      `Expected at least ${expectedAgentCount} OpenClaw agents, but found ${agentIds.length}. ` +
        "Install or copy the full fleet first, or set MSX_EXPECT_OPENCLAW_AGENTS=0 to skip the count check.",
    );
  }

  if (expectedAgentCount > 0 && specialistCount > 0 && specialistCount < expectedAgentCount - 1) {
    fail(
      `Expected at least ${expectedAgentCount - 1} specialist workspaces in ${agencyAgentsDir}, ` +
        `but found ${specialistCount}. Bring over the fleet workspaces first.`,
    );
  }
}

function main() {
  log("Checking local prerequisites.");
  ensureCommand("pnpm");
  ensureCommand("openclaw", ["--version"]);

  const openclawConfig = readOpenClawConfig();
  const agents = loadAgentsFromCli() ?? loadAgentsFromConfig(openclawConfig);
  const agentIds = uniqueAgentIds(agents);
  const specialistCount = countSpecialistDirectories(agencyAgentsDir);

  log(`Discovered ${agentIds.length} OpenClaw agents.`);
  if (existsSync(agencyAgentsDir)) {
    log(`Discovered ${specialistCount} specialist workspaces in ${agencyAgentsDir}.`);
  } else {
    log(`No agency workspace directory found at ${agencyAgentsDir}.`);
  }

  validateFleet(agentIds, specialistCount);

  log("Syncing the local OpenClaw fleet into MSX.");
  execFileSync("pnpm", ["sync:openclaw-fleet"], {
    cwd: repoRoot,
    stdio: "inherit",
  });

  log("Fleet bootstrap complete.");
  log("Next: start MSX with `pnpm dev` and open http://127.0.0.1:3100.");
}

main();
