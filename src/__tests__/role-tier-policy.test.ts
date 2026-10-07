import { describe, expect, it } from "vitest";
import { selectWorkerModelTier } from "../inference/role-tier-policy.js";

describe("role-aware worker model tiers", () => {
  it("uses reasoning for strategic and review roles", () => {
    expect(selectWorkerModelTier("planner")).toBe("reasoning");
    expect(selectWorkerModelTier("security-reviewer")).toBe("reasoning");
    expect(selectWorkerModelTier("treasury-risk")).toBe("reasoning");
  });

  it("uses fast for coding, research, and specialist roles", () => {
    expect(selectWorkerModelTier("coding-agent")).toBe("fast");
    expect(selectWorkerModelTier("market-researcher")).toBe("fast");
    expect(selectWorkerModelTier("integration-specialist")).toBe("fast");
  });

  it("uses cheap for repetitive operational roles", () => {
    expect(selectWorkerModelTier("monitor")).toBe("cheap");
    expect(selectWorkerModelTier("qa-tester")).toBe("cheap");
    expect(selectWorkerModelTier("data-collector")).toBe("cheap");
  });

  it("honors an explicit tier for unknown roles", () => {
    expect(selectWorkerModelTier("generalist", "cheap")).toBe("cheap");
    expect(selectWorkerModelTier("generalist", "reasoning")).toBe("reasoning");
  });
});
