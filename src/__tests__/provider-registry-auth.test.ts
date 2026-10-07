import { afterEach, describe, expect, it } from "vitest";
import {
  ProviderRegistry,
  type ProviderConfig,
} from "../inference/provider-registry.js";

const savedEnv = { ...process.env };

afterEach(() => {
  process.env = { ...savedEnv };
});

function provider(overrides: Partial<ProviderConfig> = {}): ProviderConfig {
  return {
    id: "test",
    name: "Test Provider",
    baseUrl: "http://localhost:9999/v1",
    apiKeyEnvVar: "TEST_PROVIDER_API_KEY",
    apiKeyOptional: false,
    models: [
      {
        id: "test-model",
        tier: "fast",
        contextWindow: 8192,
        maxOutputTokens: 1024,
        costPerInputToken: 0,
        costPerOutputToken: 0,
        supportsTools: true,
        supportsVision: false,
        supportsStreaming: true,
      },
    ],
    maxRequestsPerMinute: 60,
    maxTokensPerMinute: 100000,
    priority: 1,
    enabled: true,
    ...overrides,
  };
}

describe("OpenAI-compatible provider authentication", () => {
  it("skips a provider whose required API key is missing", () => {
    delete process.env.TEST_PROVIDER_API_KEY;
    const registry = new ProviderRegistry([provider()]);

    expect(registry.resolveCandidates("fast")).toHaveLength(0);
    expect(registry.getProviders()[0].enabled).toBe(false);
  });

  it("accepts a required-key provider when its key exists", () => {
    process.env.TEST_PROVIDER_API_KEY = "test-key";
    const registry = new ProviderRegistry([provider()]);

    const candidates = registry.resolveCandidates("fast");
    expect(candidates).toHaveLength(1);
    expect(candidates[0].provider.id).toBe("test");
  });

  it("accepts keyless local/OpenAI-compatible providers when configured", () => {
    delete process.env.TEST_PROVIDER_API_KEY;
    const registry = new ProviderRegistry([
      provider({ id: "hermes-local", apiKeyOptional: true }),
    ]);

    const candidates = registry.resolveCandidates("fast");
    expect(candidates).toHaveLength(1);
    expect(candidates[0].provider.id).toBe("hermes-local");
  });
});
