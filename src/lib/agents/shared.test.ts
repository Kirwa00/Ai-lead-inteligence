import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { callAgentJson, llmConfigured, resolveLlmProvider } from "@/lib/agents/shared";

const KEYS = ["ANTHROPIC_API_KEY", "DEEPSEEK_API_KEY", "LLM_PROVIDER"] as const;
let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
  for (const k of KEYS) delete process.env[k];
});

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("LLM provider resolution", () => {
  it("defaults to anthropic when no provider is supplied and no key is configured", () => {
    expect(resolveLlmProvider(undefined)).toBe("anthropic");
  });

  it("uses deepseek when explicitly requested and the key is available", () => {
    process.env.DEEPSEEK_API_KEY = "test-key";
    expect(resolveLlmProvider("deepseek")).toBe("deepseek");
  });

  it("falls back to a provider that actually has a key", () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    // DeepSeek requested but unconfigured — don't pick a provider we can't call.
    expect(resolveLlmProvider("deepseek")).toBe("anthropic");
  });

  it("treats a whitespace-only key as not configured", () => {
    process.env.DEEPSEEK_API_KEY = "   ";
    expect(llmConfigured("deepseek")).toBe(false);
    expect(resolveLlmProvider("deepseek")).toBe("anthropic");
  });
});

/**
 * Regression: a malformed key used to surface as
 * "Cannot convert argument to a ByteString because the character at index 8
 * has a value of 8226" — thrown from inside fetch, naming neither the key nor
 * the cause, and then persisted as the agent job's failure message.
 */
describe("API key validation", () => {
  const schema = { type: "object" };

  it("rejects a masked key pasted from a dashboard, naming the env var", async () => {
    process.env.DEEPSEEK_API_KEY = "sk-••••••••••••";

    await expect(callAgentJson("hi", schema, 10, "deepseek")).rejects.toThrow(
      /DEEPSEEK_API_KEY[\s\S]*code point 8226[\s\S]*masked key/
    );
  });

  it("rejects a key containing a newline from a multi-line paste", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-abc\ndef";

    await expect(callAgentJson("hi", schema, 10, "anthropic")).rejects.toThrow(
      /ANTHROPIC_API_KEY[\s\S]*can't be sent in an HTTP header/
    );
  });

  it("reports a clear message when the key is missing entirely", async () => {
    await expect(callAgentJson("hi", schema, 10, "anthropic")).rejects.toThrow(
      /Anthropic API key is not configured — set ANTHROPIC_API_KEY\./
    );
  });

  it("tolerates surrounding whitespace rather than failing on it", () => {
    process.env.DEEPSEEK_API_KEY = "  sk-realkey123  \n";
    // Trimmed, so it counts as configured and would be sent cleanly.
    expect(llmConfigured("deepseek")).toBe(true);
  });
});
