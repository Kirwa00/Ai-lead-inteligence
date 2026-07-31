// Shared LLM call for all agents — one place to configure/swap the provider.
// Each workspace picks anthropic or deepseek in Settings; both API keys can live
// in env at once — only the selected provider is used per run.
export type LlmProvider = "anthropic" | "deepseek";

export function resolveLlmProvider(preferred?: string | null): LlmProvider {
  const p = (preferred || process.env.LLM_PROVIDER || "anthropic").toLowerCase();
  return p === "deepseek" ? "deepseek" : "anthropic";
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
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    deepseek: !!process.env.DEEPSEEK_API_KEY,
  };
}

/** True once the given provider has a key configured. */
export function llmConfigured(provider?: LlmProvider | string | null): boolean {
  const p = resolveLlmProvider(provider);
  return p === "deepseek" ? !!process.env.DEEPSEEK_API_KEY : !!process.env.ANTHROPIC_API_KEY;
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
  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
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
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY as string,
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
