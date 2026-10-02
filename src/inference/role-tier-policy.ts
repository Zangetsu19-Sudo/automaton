import type { ModelTier } from "./provider-registry.js";

const REASONING_ROLE_HINTS = [
  "planner",
  "architect",
  "strategy",
  "strategist",
  "reviewer",
  "critic",
  "security",
  "risk",
  "finance",
  "treasury",
];

const FAST_ROLE_HINTS = [
  "coder",
  "coding",
  "developer",
  "engineer",
  "research",
  "analyst",
  "specialist",
  "integration",
  "data",
  "marketing",
  "product",
];

const CHEAP_ROLE_HINTS = [
  "monitor",
  "ops",
  "operator",
  "scraper",
  "collector",
  "formatter",
  "summarizer",
  "support",
  "qa",
  "tester",
  "validation",
];

export function selectWorkerModelTier(
  role: string | null | undefined,
  requestedTier?: string,
): ModelTier {
  const normalizedRole = (role ?? "").trim().toLowerCase();

  if (matchesAny(normalizedRole, REASONING_ROLE_HINTS)) {
    return "reasoning";
  }

  if (matchesAny(normalizedRole, CHEAP_ROLE_HINTS)) {
    return "cheap";
  }

  if (matchesAny(normalizedRole, FAST_ROLE_HINTS)) {
    return "fast";
  }

  if (
    requestedTier === "reasoning" ||
    requestedTier === "fast" ||
    requestedTier === "cheap"
  ) {
    return requestedTier;
  }

  return "fast";
}

function matchesAny(role: string, hints: string[]): boolean {
  return hints.some((hint) => role.includes(hint));
}
