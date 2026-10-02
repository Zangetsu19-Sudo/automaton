import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createConwayClient } from "../conway/client.js";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("local workspace runtime", () => {
  it("runs commands with cwd/HOME rooted in the configured workspace", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "automaton-workspace-"));
    roots.push(root);

    const client = createConwayClient({
      apiUrl: "https://api.conway.tech",
      apiKey: "",
      sandboxId: "",
      localRoot: root,
    });

    const result = await client.exec("pwd && printf '\\n%s' \"$HOME\"");

    expect(result.exitCode).toBe(0);
    const [cwd, home] = result.stdout.trim().split("\n");
    expect(path.resolve(cwd)).toBe(path.resolve(root));
    expect(path.resolve(home)).toBe(path.resolve(root));
  });

  it("keeps local file reads and writes inside the workspace", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "automaton-workspace-"));
    roots.push(root);

    const client = createConwayClient({
      apiUrl: "https://api.conway.tech",
      apiKey: "",
      sandboxId: "",
      localRoot: root,
    });

    await client.writeFile("notes/test.txt", "hello");
    expect(await client.readFile("notes/test.txt")).toBe("hello");
    expect(fs.readFileSync(path.join(root, "notes", "test.txt"), "utf8")).toBe("hello");

    await expect(client.writeFile("../escape.txt", "nope")).rejects.toThrow(
      /escapes workspace root/i,
    );
    await expect(client.readFile("../escape.txt")).rejects.toThrow(
      /escapes workspace root/i,
    );
  });
});
