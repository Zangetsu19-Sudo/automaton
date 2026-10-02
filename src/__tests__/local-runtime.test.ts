import BetterSqlite3 from "better-sqlite3";
import { describe, expect, it, vi } from "vitest";
import { buildTickContext } from "../heartbeat/tick-context.js";

const heartbeatConfig = {
  entries: [],
  defaultIntervalMs: 60_000,
  lowComputeMultiplier: 4,
};

function createDb() {
  const db = new BetterSqlite3(":memory:");
  db.exec(`
    CREATE TABLE kv (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT
    );
  `);
  return db;
}

describe("local runtime accounting", () => {
  it("uses the configured $5 local treasury without calling Conway", async () => {
    const db = createDb();
    const getCreditsBalance = vi.fn(async () => {
      throw new Error("Conway should not be called in local mode");
    });

    const ctx = await buildTickContext(
      db,
      { getCreditsBalance } as any,
      heartbeatConfig,
      undefined,
      "evm",
      "local",
      500,
    );

    expect(ctx.creditBalance).toBe(500);
    expect(ctx.survivalTier).toBe("normal");
    expect(getCreditsBalance).not.toHaveBeenCalled();

    db.close();
  });

  it("reads the persisted local treasury balance on later ticks", async () => {
    const db = createDb();
    db.prepare(
      "INSERT INTO kv (key, value, updated_at) VALUES (?, ?, datetime('now'))",
    ).run("local_treasury_cents", "37");

    const getCreditsBalance = vi.fn(async () => 99_999);

    const ctx = await buildTickContext(
      db,
      { getCreditsBalance } as any,
      heartbeatConfig,
      undefined,
      "evm",
      "local",
      500,
    );

    expect(ctx.creditBalance).toBe(37);
    expect(ctx.survivalTier).toBe("low_compute");
    expect(getCreditsBalance).not.toHaveBeenCalled();

    db.close();
  });

  it("preserves Conway credit polling in Conway mode", async () => {
    const db = createDb();
    const getCreditsBalance = vi.fn(async () => 777);

    const ctx = await buildTickContext(
      db,
      { getCreditsBalance } as any,
      heartbeatConfig,
      undefined,
      "evm",
      "conway",
      500,
    );

    expect(ctx.creditBalance).toBe(777);
    expect(ctx.survivalTier).toBe("high");
    expect(getCreditsBalance).toHaveBeenCalledTimes(1);

    db.close();
  });
});
