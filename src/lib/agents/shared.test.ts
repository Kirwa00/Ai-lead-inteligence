import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  callAgentJson,
  llmConfigured,
  llmProvidersAvailable,
  resolveLlmProvider,
  usableProviders,
} from "@/lib/agents/shared";

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

/**
 * One bad key must not take the AI workforce offline. A structurally broken key
 * is skipped without spending a network call; a key the provider rejects at
 * runtime fails over to the other provider.
 */
describe("provider failover", () => {
  const schema = { type: "object" };
  const ANTHROPIC_OK = {
    content: [{ type: "text", text: '{"ok":true}' }],
    usage: { input_tokens: 5, output_tokens: 7 },
  };
  const DEEPSEEK_OK = {
    choices: [{ message: { content: '{"ok":true}' } }],
    usage: { prompt_tokens: 3, completion_tokens: 4 },
  };

  function mockFetch(handler: (url: string) => { status: number; body: unknown }) {
    return vi.fn(async (url: string) => {
      const { status, body } = handler(String(url));
      return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
        text: async () => JSON.stringify(body),
      } as unknown as Response;
    });
  }

  afterEach(() => vi.unstubAllGlobals());

  it("skips a malformed key and uses the healthy provider instead", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-••••••"; // masked paste
    process.env.DEEPSEEK_API_KEY = "sk-deepseek-real";

    const fetchMock = mockFetch(() => ({ status: 200, body: DEEPSEEK_OK }));
    vi.stubGlobal("fetch", fetchMock);

    const { model } = await callAgentJson("hi", schema, 10, "anthropic");

    expect(model).toContain("deepseek");
    // The broken key never cost us a request.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("deepseek.com");
  });

  it("fails over when the preferred provider rejects the key at runtime", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-looks-fine";
    process.env.DEEPSEEK_API_KEY = "sk-deepseek-real";

    const fetchMock = mockFetch((url) =>
      url.includes("anthropic.com")
        ? { status: 401, body: { error: "invalid x-api-key" } }
        : { status: 200, body: DEEPSEEK_OK }
    );
    vi.stubGlobal("fetch", fetchMock);

    const { model } = await callAgentJson("hi", schema, 10, "anthropic");

    expect(model).toContain("deepseek");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("honours the requested provider when its key works", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-looks-fine";
    process.env.DEEPSEEK_API_KEY = "sk-deepseek-real";

    const fetchMock = mockFetch(() => ({ status: 200, body: ANTHROPIC_OK }));
    vi.stubGlobal("fetch", fetchMock);

    const { model } = await callAgentJson("hi", schema, 10, "anthropic");

    expect(model).toContain("claude");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  /** A malformed request fails the same way everywhere — retrying just doubles the cost. */
  it("does not fail over on an error the other provider would also give", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-looks-fine";
    process.env.DEEPSEEK_API_KEY = "sk-deepseek-real";

    const fetchMock = mockFetch(() => ({ status: 400, body: { error: "bad request" } }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(callAgentJson("hi", schema, 10, "anthropic")).rejects.toThrow(/Anthropic 400/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("surfaces the requested provider's problem when nothing is usable", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-••••";

    await expect(callAgentJson("hi", schema, 10, "anthropic")).rejects.toThrow(
      /ANTHROPIC_API_KEY[\s\S]*masked key/
    );
  });

  it("reports a malformed key as unavailable rather than offering it in Settings", () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-••••";
    process.env.DEEPSEEK_API_KEY = "sk-deepseek-real";

    expect(llmProvidersAvailable()).toEqual({ anthropic: false, deepseek: true });
    expect(usableProviders()).toEqual(["deepseek"]);
    // And the effective provider silently becomes the working one.
    expect(resolveLlmProvider("anthropic")).toBe("deepseek");
  });
});
