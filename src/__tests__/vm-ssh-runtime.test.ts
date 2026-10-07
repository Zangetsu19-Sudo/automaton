import { describe, expect, it } from "vitest";
import {
  normalizeVmConfig,
  resolveGuestWorkspacePath,
} from "../runtime/vm-ssh.js";

describe("VM SSH runtime configuration", () => {
  it("normalizes a valid guest configuration", () => {
    const cfg = normalizeVmConfig({
      host: "192.0.2.10",
      port: 2222,
      user: "automaton",
      workspaceRoot: "/home/automaton/workspace",
      identityFile: "C:/keys/automaton_vm",
    });

    expect(cfg.host).toBe("192.0.2.10");
    expect(cfg.port).toBe(2222);
    expect(cfg.user).toBe("automaton");
    expect(cfg.workspaceRoot).toBe("/home/automaton/workspace");
  });

  it("rejects invalid VM connection parameters", () => {
    expect(() =>
      normalizeVmConfig({
        host: "",
        user: "automaton",
      }),
    ).toThrow(/host is required/i);

    expect(() =>
      normalizeVmConfig({
        host: "example.com",
        user: "bad user",
      }),
    ).toThrow(/user contains invalid/i);

    expect(() =>
      normalizeVmConfig({
        host: "example.com",
        port: 70000,
        user: "automaton",
      }),
    ).toThrow(/port/i);

    expect(() =>
      normalizeVmConfig({
        host: "example.com",
        user: "automaton",
        workspaceRoot: "relative/path",
      }),
    ).toThrow(/absolute POSIX path/i);
  });

  it("confines guest paths to the configured workspace", () => {
    const root = "/home/automaton/workspace";

    expect(resolveGuestWorkspacePath("notes/test.txt", root)).toBe(
      "/home/automaton/workspace/notes/test.txt",
    );
    expect(resolveGuestWorkspacePath("~/notes/test.txt", root)).toBe(
      "/home/automaton/workspace/notes/test.txt",
    );

    expect(() =>
      resolveGuestWorkspacePath("../escape.txt", root),
    ).toThrow(/escapes workspace root/i);

    expect(() =>
      resolveGuestWorkspacePath("/etc/passwd", root),
    ).toThrow(/escapes workspace root/i);
  });
});
