import path from "node:path";
import { spawnSync } from "node:child_process";
import type { ExecResult } from "../types.js";

export interface LocalVmConfig {
  host: string;
  port?: number;
  user: string;
  workspaceRoot?: string;
  identityFile?: string;
  knownHostsFile?: string;
}

export interface VmSshRuntime {
  exec(command: string, timeout?: number): ExecResult;
  readFile(filePath: string, timeout?: number): string;
  writeFile(filePath: string, content: string, timeout?: number): void;
  resolveGuestPath(filePath: string): string;
}

export function createVmSshRuntime(config: LocalVmConfig): VmSshRuntime {
  const normalized = normalizeVmConfig(config);

  const run = (
    remoteCommand: string,
    timeout = 30_000,
    input?: string,
  ): ExecResult => {
    const result = spawnSync("ssh", buildSshArgs(normalized, remoteCommand), {
      encoding: "utf-8",
      timeout,
      maxBuffer: 10 * 1024 * 1024,
      input,
      windowsHide: true,
    });

    if (result.error) {
      return {
        stdout: result.stdout || "",
        stderr: result.error.message,
        exitCode: typeof result.status === "number" ? result.status : 1,
      };
    }

    return {
      stdout: result.stdout || "",
      stderr: result.stderr || "",
      exitCode: typeof result.status === "number" ? result.status : 1,
    };
  };

  const resolveGuestPath = (filePath: string): string =>
    resolveGuestWorkspacePath(filePath, normalized.workspaceRoot);

  return {
    exec(command: string, timeout = 30_000): ExecResult {
      const workspace = shellQuote(normalized.workspaceRoot);
      const wrapped = [
        "set -eu",
        `mkdir -p ${workspace}`,
        `cd ${workspace}`,
        `export HOME=${workspace}`,
        `export TMPDIR=${workspace}/.tmp`,
        'mkdir -p "$TMPDIR"',
        command,
      ].join(" && ");
      return run(wrapped, timeout);
    },

    readFile(filePath: string, timeout = 30_000): string {
      const resolved = resolveGuestPath(filePath);
      const result = run(`cat -- ${shellQuote(resolved)}`, timeout);
      if (result.exitCode !== 0) {
        throw new Error(result.stderr || `Unable to read guest file: ${resolved}`);
      }
      return result.stdout;
    },

    writeFile(filePath: string, content: string, timeout = 30_000): void {
      const resolved = resolveGuestPath(filePath);
      const dir = path.posix.dirname(resolved);
      const command = `mkdir -p ${shellQuote(dir)} && cat > ${shellQuote(resolved)}`;
      const result = run(command, timeout, content);
      if (result.exitCode !== 0) {
        throw new Error(result.stderr || `Unable to write guest file: ${resolved}`);
      }
    },

    resolveGuestPath,
  };
}

export function normalizeVmConfig(config: LocalVmConfig): Required<
  Pick<LocalVmConfig, "host" | "port" | "user" | "workspaceRoot">
> & Pick<LocalVmConfig, "identityFile" | "knownHostsFile"> {
  const host = config.host?.trim();
  const user = config.user?.trim();
  const port = config.port ?? 22;
  const workspaceRoot = (config.workspaceRoot || "/home/automaton/workspace").trim();

  if (!host) throw new Error("VM host is required");
  if (!user) throw new Error("VM SSH user is required");
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("VM SSH port must be between 1 and 65535");
  }
  if (!workspaceRoot.startsWith("/")) {
    throw new Error("VM workspaceRoot must be an absolute POSIX path");
  }
  if (host.includes("/") || host.includes("\\") || /\s/.test(host)) {
    throw new Error("VM host contains invalid characters");
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(user)) {
    throw new Error("VM SSH user contains invalid characters");
  }

  return {
    host,
    port,
    user,
    workspaceRoot: path.posix.resolve(workspaceRoot),
    identityFile: config.identityFile,
    knownHostsFile: config.knownHostsFile,
  };
}

export function resolveGuestWorkspacePath(filePath: string, workspaceRoot: string): string {
  const root = path.posix.resolve(workspaceRoot);
  const expanded = filePath.startsWith("~")
    ? path.posix.join(root, filePath.slice(1))
    : filePath;
  const resolved = path.posix.resolve(root, expanded);

  if (resolved !== root && !resolved.startsWith(root + "/")) {
    throw new Error(
      `Guest path escapes workspace root: ${filePath} -> ${resolved}`,
    );
  }

  return resolved;
}

function buildSshArgs(
  config: ReturnType<typeof normalizeVmConfig>,
  remoteCommand: string,
): string[] {
  const args = [
    "-p",
    String(config.port),
    "-o",
    "BatchMode=yes",
    "-o",
    "StrictHostKeyChecking=yes",
    "-o",
    "ConnectTimeout=10",
  ];

  if (config.identityFile) {
    args.push("-i", config.identityFile);
  }
  if (config.knownHostsFile) {
    args.push("-o", `UserKnownHostsFile=${config.knownHostsFile}`);
  }

  args.push(`${config.user}@${config.host}`, remoteCommand);
  return args;
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}
