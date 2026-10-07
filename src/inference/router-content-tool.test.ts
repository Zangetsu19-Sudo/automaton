import { describe, expect, it } from "vitest";
import { parseContentToolCall } from "./router.js";

const tools = [
  {
    type: "function",
    function: {
      name: "check_credits",
      description: "Check the current credit balance",
      parameters: { type: "object", properties: {} },
    },
  },
];

describe("parseContentToolCall", () => {
  it("promotes a strict JSON tool request for an advertised tool", () => {
    const calls = parseContentToolCall(
      '{"name":"check_credits","arguments":{}}',
      tools,
    );

    expect(calls).toHaveLength(1);
    expect(calls?.[0].function.name).toBe("check_credits");
    expect(calls?.[0].function.arguments).toBe("{}");
  });

  it("accepts a whole-message fenced JSON tool request", () => {
    const calls = parseContentToolCall(
      '```json\n{"name":"check_credits","arguments":{}}\n```',
      tools,
    );

    expect(calls).toHaveLength(1);
    expect(calls?.[0].function.name).toBe("check_credits");
  });

  it("does not promote prose containing JSON", () => {
    expect(
      parseContentToolCall(
        'I will call this next: {"name":"check_credits","arguments":{}}',
        tools,
      ),
    ).toBeUndefined();
  });

  it("does not promote an unadvertised tool", () => {
    expect(
      parseContentToolCall(
        '{"name":"delete_everything","arguments":{}}',
        tools,
      ),
    ).toBeUndefined();
  });

  it("requires arguments to be an object", () => {
    expect(
      parseContentToolCall(
        '{"name":"check_credits","arguments":"{}"}',
        tools,
      ),
    ).toBeUndefined();
  });
});
