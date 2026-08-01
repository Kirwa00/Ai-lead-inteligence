// Shared LLM call for all agents — one place to configure/swap the provider.
// Each workspace picks anthropic or deepseek in Settings; both API keys can live
// in env at once — only the selected provider is used per run.
export type LlmProvider = "anthropic" | "deepseek";

const ALL_PROVIDERS: LlmProvider[] = ["anthropic", "deepseek"];

const PROVIDER_ENV: Record<LlmProvider, { envVar: string; label: string }> = {
  anthropic: { envVar: "ANTHROPIC_API_KEY", label: "Anthropic API key" },
  deepseek: { envVar: "DEEPSEEK_API_KEY", label: "DeepSeek API key" },
};

/** Error carrying the upstream HTTP status so failover can reason about it. */
class ProviderError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "ProviderError";
    this.status = status;
  }
}

/** A key that is missing, blank, or whitespace-only counts as not configured. */
function rawKey(provider: LlmProvider): string {
  return (process.env[PROVIDER_ENV[provider].envVar] ?? "").trim();
}

/**
 * Reads an API key for outbound use, tolerating the stray whitespace and
 * newlines that copy-paste leaves behind, and rejecting anything that cannot
 * legally travel in an HTTP header.
 *
 * HTTP header values are a ByteString, so any code point above 255 makes
 * `fetch` throw "Cannot convert argument to a ByteString because the character
 * at index N has a value of X" — an error that names neither the offending key
 * nor the reason, and which then gets persisted as an agent job's failure
 * message. The overwhelmingly common cause is pasting a *masked* key straight
 * out of a provider dashboard, where the hidden characters are bullets (U+2022,
 * decimal 8226). We reject anything outside printable ASCII, which also catches
 * non-breaking spaces and smart quotes that would otherwise fail auth silently.
 */
export function keyProblem(provider: LlmProvider): string | null {
  const { envVar, label } = PROVIDER_ENV[provider];
  const key = rawKey(provider);

  if (!key) return `${label} is not configured — set ${envVar}.`;

  // Indexed loop rather than spread: this file compiles at a pre-ES2015 target.
  let badIndex = -1;
  for (let i = 0; i < key.length; i += 1) {
    const cp = key.charCodeAt(i);
    if (cp < 0x20 || cp > 0x7e) {
      badIndex = i;
      break;
    }
  }
  if (badIndex === -1) return null;

  const cp = key.charCodeAt(badIndex);
  const hint =
    cp === 0x2022
      ? " That's a bullet character, which means a masked key was copied from a dashboard — copy the real value instead."
      : "";
  return (
    `${label} (${envVar}) contains a character that can't be sent in an HTTP header: ` +
    `position ${badIndex}, code point ${cp}.${hint}`
  );
}

function readApiKey(provider: LlmProvider): string {
  const problem = keyProblem(provider);
  if (problem) throw new Error(problem);
  return rawKey(provider);
}

/** Providers whose key is present and structurally sendable. */
export function usableProviders(): LlmProvider[] {
  return ALL_PROVIDERS.filter((p) => keyProblem(p) === null);
}

/**
 * Preferred provider first, then any other usable one as a fallback. A key that
 * can't even be put in a header is skipped without spending a network call.
 */
function providerOrder(preferred?: LlmProvider | string | null): LlmProvider[] {
  const usable = usableProviders();
  const explicit = normalizeProvider(preferred ?? process.env.LLM_PROVIDER);
  if (explicit && usable.indexOf(explicit) !== -1) {
    return [explicit].concat(usable.filter((p) => p !== explicit));
  }
  return usable;
}

/**
 * Nothing is callable. Report the requested provider's problem when it has one,
 * so the message points at the key the user actually meant to use.
 */
function noUsableProviderError(preferred?: LlmProvider | string | null): Error {
  const explicit = normalizeProvider(preferred ?? process.env.LLM_PROVIDER);
  const ordered = explicit ? [explicit].concat(ALL_PROVIDERS.filter((p) => p !== explicit)) : ALL_PROVIDERS;
  const problems = ordered.map(keyProblem).filter((p): p is string => !!p);
  return new Error(problems[0] ?? "No AI provider is configured.");
}

/** Auth/permission/quota failures mean "this key won't work" — try the other. */
function shouldFailOver(err: unknown): boolean {
  const status = (err as { status?: number } | null)?.status;
  if (typeof status === "number") return status === 401 || status === 403 || status === 429 || status >= 500;
  // A structural key problem is caught before any call, so anything else here
  // (bad JSON, malformed request) would fail identically on the other provider.
  return false;
}

function normalizeProvider(value?: string | null): LlmProvider | null {
  const p = (value || "").toLowerCase();
  if (p === "deepseek") return "deepseek";
  if (p === "anthropic") return "anthropic";
  return null;
}

/**
 * The provider that will actually be tried first. A workspace's choice is
 * honoured whenever its key is usable; otherwise we transparently fall back to
 * one that is, so a single broken key can't take the agents offline.
 */
export function resolveLlmProvider(preferred?: string | null): LlmProvider {
  return providerOrder(preferred)[0] ?? "anthropic";
}

export function getAgentModel(provider?: LlmProvider | string | null): string {
  const p = resolveLlmProvider(provider);
  return p === "deepseek"
    ? process.env.DEEPSEEK_MODEL || "deepseek-chat"
    : process.env.RESEARCH_MODEL || "claude-sonnet-5";
}

// Prisma's default interactive-transaction maxWait is 2s, which the Supabase
// pooler can miss under load (P2028). Give batch writes a generous budget.
export const TX_OPTS = { maxWait: 15_000, timeout: 30_000 } as const;

export type Usage = { input_tokens: number; output_tokens: number };

/**
 * Which providers are actually callable. A key that's present but malformed
 * counts as unavailable — it would fail on first use, so offering it in
 * Settings would just be a trap.
 */
export function llmProvidersAvailable(): Record<LlmProvider, boolean> {
  return {
    anthropic: keyProblem("anthropic") === null,
    deepseek: keyProblem("deepseek") === null,
  };
}

/** True when at least one provider can serve this request. */
export function llmConfigured(provider?: LlmProvider | string | null): boolean {
  return providerOrder(provider).length > 0;
}

/**
 * Ask the configured LLM for a JSON object matching `schema`, low-effort /
 * cheap config by default. Returns the parsed result plus token usage
 * (normalized to Anthropic's input/output naming regardless of provider).
 */
export async function callAgentJson<T>(
  prompt: string,
  schema: object,
  maxTokens = 3000,
  provider?: LlmProvider | string | null
): Promise<{ result: T; usage: Usage; model: string }> {
  const order = providerOrder(provider);
  if (order.length === 0) throw noUsableProviderError(provider);

  let lastError: unknown;

  for (let i = 0; i < order.length; i += 1) {
    const p = order[i];
    const model = getAgentModel(p);
    try {
      const { result, usage } =
        p === "deepseek"
          ? await callDeepSeek<T>(prompt, schema, maxTokens, model)
          : await callAnthropic<T>(prompt, schema, maxTokens, model);

      if (i > 0) {
        console.warn(`[llm] fell back to ${p} after ${order[0]} failed — check that key.`);
      }
      // Report the model actually used, so metering bills the right rate.
      return { result, usage, model };
    } catch (err) {
      lastError = err;
      const isLast = i === order.length - 1;
      if (isLast || !shouldFailOver(err)) throw err;
      console.warn(
        `[llm] ${p} rejected the request (${err instanceof Error ? err.message : err}); trying the next provider.`
      );
    }
  }

  throw lastError;
}

async function callDeepSeek<T>(
  prompt: string,
  schema: object,
  maxTokens: number,
  model: string
): Promise<{ result: T; usage: Usage }> {
  const apiKey = readApiKey("deepseek");
  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature: 0.3,
      // DeepSeek's JSON mode guarantees syntactically valid JSON, not a
      // guaranteed schema match (unlike Anthropic's json_schema) — so the
      // schema is passed as an instruction, and every caller already reads
      // fields defensively (?? fallbacks) to tolerate minor drift.
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `Respond with ONLY a single valid JSON object — no markdown, no prose. It must match this JSON schema:\n${JSON.stringify(schema)}`,
        },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new ProviderError(`DeepSeek ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`, res.status);
  }
  const data = await res.json();
  const usage: Usage = {
    input_tokens: data.usage?.prompt_tokens ?? 0,
    output_tokens: data.usage?.completion_tokens ?? 0,
  };
  const content = data.choices?.[0]?.message?.content ?? "{}";
  return { result: JSON.parse(content) as T, usage };
}

async function callAnthropic<T>(
  prompt: string,
  schema: object,
  maxTokens: number,
  model: string
): Promise<{ result: T; usage: Usage }> {
  const apiKey = readApiKey("anthropic");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      thinking: { type: "adaptive" },
      output_config: { effort: "low", format: { type: "json_schema", schema } },
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new ProviderError(`Anthropic ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`, res.status);
  }
  const data = await res.json();
  const usage: Usage = data.usage ?? { input_tokens: 0, output_tokens: 0 };
  const textBlock = (data.content as Array<{ type: string; text?: string }>)?.find(
    (b) => b.type === "text"
  );
  const result = JSON.parse(textBlock?.text ?? "{}") as T;
  return { result, usage };
}
