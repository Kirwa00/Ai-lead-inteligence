import { describe, expect, it } from "vitest";
import { resolveLlmProvider } from "@/lib/agents/shared";

describe("LLM provider resolution", () => {
  it("defaults to anthropic when no provider is supplied and no key is configured", () => {
    expect(resolveLlmProvider(undefined)).toBe("anthropic");
  });

  it("uses deepseek when explicitly requested and the key is available", () => {
    const previous = process.env.DEEPSEEK_API_KEY;
    process.env.DEEPSEEK_API_KEY = "test-key";
    try {
      expect(resolveLlmProvider("deepseek")).toBe("deepseek");
    } finally {
      if (previous === undefined) delete process.env.DEEPSEEK_API_KEY;
      else process.env.DEEPSEEK_API_KEY = previous;
    }
  });
});
