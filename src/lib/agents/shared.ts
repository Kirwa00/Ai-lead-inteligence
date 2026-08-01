// Shared LLM call for all agents — one place to configure/swap the provider.
// Each workspace picks anthropic or deepseek in Settings; both API keys can live
// in env at once — only the selected provider is used per run.
export type LlmProvider = "anthropic" | "deepseek";

const PROVIDER_ENV: Record<LlmProvider, { envVar: string; label: string }> = {
  anthropic: { envVar: "ANTHROPIC_API_KEY", label: "Anthropic API key" },
  deepseek: { envVar: "DEEPSEEK_API_KEY", label: "DeepSeek API key" },
};

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
function readApiKey(provider: LlmProvider): string {
  const { envVar, label } = PROVIDER_ENV[provider];
  const key = rawKey(provider);

  if (!key) throw new Error(`${label} is not configured — set ${envVar}.`);

  // Indexed loop rather than spread: this file compiles at a pre-ES2015 target.
  let badIndex = -1;
  for (let i = 0; i < key.length; i += 1) {
    const cp = key.charCodeAt(i);
    if (cp < 0x20 || cp > 0x7e) {
      badIndex = i;
      break;
    }
  }

  if (badIndex !== -1) {
    const cp = key.charCodeAt(badIndex);
    const hint =
      cp === 0x2022
        ? " That's a bullet character, which means a masked key was copied from a dashboard — copy the real value instead."
        : "";
    throw new Error(
      `${label} (${envVar}) contains a character that can't be sent in an HTTP header: ` +
        `position ${badIndex}, code point ${cp}.${hint}`
    );
  }

  return key;
}

function normalizeProvider(value?: string | null): LlmProvider | null {
  const p = (value || "").toLowerCase();
  if (p === "deepseek") return "deepseek";
  if (p === "anthropic") return "anthropic";
  return null;
}

export function resolveLlmProvider(preferred?: string | null): LlmProvider {
  const explicit = normalizeProvider(preferred ?? process.env.LLM_PROVIDER);
  if (explicit && rawKey(explicit)) return explicit;

  if (rawKey("deepseek")) return "deepseek";
  if (rawKey("anthropic")) return "anthropic";
  return "anthropic";
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

/** Which providers have server-side API keys configured. */
export function llmProvidersAvailable(): Record<LlmProvider, boolean> {
  return {
    anthropic: !!rawKey("anthropic"),
    deepseek: !!rawKey("deepseek"),
  };
}

/** True once the given provider has a key configured. */
export function llmConfigured(provider?: LlmProvider | string | null): boolean {
  return !!rawKey(resolveLlmProvider(provider));
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
  const p = resolveLlmProvider(provider);
  const model = getAgentModel(p);
  const { result, usage } =
    p === "deepseek"
      ? await callDeepSeek<T>(prompt, schema, maxTokens, model)
      : await callAnthropic<T>(prompt, schema, maxTokens, model);
  return { result, usage, model };
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
  if (!res.ok) throw new Error(`DeepSeek ${res.status}`);
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
  if (!res.ok) throw new Error(`Anthropic ${res.status}`);
  const data = await res.json();
  const usage: Usage = data.usage ?? { input_tokens: 0, output_tokens: 0 };
  const textBlock = (data.content as Array<{ type: string; text?: string }>)?.find(
    (b) => b.type === "text"
  );
  const result = JSON.parse(textBlock?.text ?? "{}") as T;
  return { result, usage };
}
