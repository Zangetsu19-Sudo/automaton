/**
 * State Versioning
 *
 * Version control the automaton's runtime-local state files (.automaton/).
 * Every self-modification triggers a git commit with a descriptive message.
 * The automaton's identity history remains version-controlled and replayable.
 */

import type { ConwayClient } from "../types.js";
import { gitInit, gitCommit, gitStatus, gitLog } from "./tools.js";

// This path is intentionally relative. ConwayClient sets the execution cwd to
// the active runtime root (/root remotely, local workspace root locally, or the
// configured VM workspace root). Keeping it relative prevents controller-host
// paths such as C:\\Users\\... from leaking into Linux guest commands.
const AUTOMATON_DIR = ".automaton";

/**
 * Initialize git repo for the automaton's runtime-local state directory.
 * Creates .gitignore to exclude sensitive files.
 */
export async function initStateRepo(
  conway: ConwayClient,
): Promise<void> {
  const dir = AUTOMATON_DIR;

  const checkResult = await conway.exec(
    `test -d ${dir}/.git && echo "exists" || echo "nope"`,
    5000,
  );
  const exists = checkResult.stdout.trim() === "exists";

  if (!exists) {
    await gitInit(conway, dir);
  }

  // Keep sensitive controller/runtime files out of state history.
  const gitignore = `# Sensitive files - never commit
wallet.json
automaton.json
config.json
state.db
state.db-wal
state.db-shm
logs/
*.log
*.err
`;
  await conway.writeFile(`${dir}/.gitignore`, gitignore);

  // Always ensure repository identity exists. A previous initialization may
  // have created .git before failing its first commit.
  await conway.exec(
    `cd ${dir} && git config user.name "Automaton" && git config user.email "automaton@local"`,
    5000,
  );

  if (!exists) {
    await gitCommit(conway, dir, "genesis: automaton state repository initialized");
  }
}

/**
 * Commit a state change with a descriptive message.
 * Called after any self-modification.
 */
export async function commitStateChange(
  conway: ConwayClient,
  description: string,
  category: string = "state",
): Promise<string> {
  const dir = AUTOMATON_DIR;

  const status = await gitStatus(conway, dir);
  if (status.clean) {
    return "No changes to commit";
  }

  const message = `${category}: ${description}`;
  return gitCommit(conway, dir, message);
}

/**
 * Commit after a SOUL.md update.
 */
export async function commitSoulUpdate(
  conway: ConwayClient,
  description: string,
): Promise<string> {
  return commitStateChange(conway, description, "soul");
}

/**
 * Commit after a skill installation or removal.
 */
export async function commitSkillChange(
  conway: ConwayClient,
  skillName: string,
  action: "install" | "remove" | "update",
): Promise<string> {
  return commitStateChange(
    conway,
    `${action} skill: ${skillName}`,
    "skill",
  );
}

/**
 * Commit after heartbeat config change.
 */
export async function commitHeartbeatChange(
  conway: ConwayClient,
  description: string,
): Promise<string> {
  return commitStateChange(conway, description, "heartbeat");
}

/**
 * Commit after config change.
 */
export async function commitConfigChange(
  conway: ConwayClient,
  description: string,
): Promise<string> {
  return commitStateChange(conway, description, "config");
}

/**
 * Get the state repo history.
 */
export async function getStateHistory(
  conway: ConwayClient,
  limit: number = 20,
) {
  return gitLog(conway, AUTOMATON_DIR, limit);
}
