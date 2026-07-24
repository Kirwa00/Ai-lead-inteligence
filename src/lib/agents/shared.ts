// Shared LLM call for all agents — one place for the efficient config
// (Sonnet 5, low effort, structured JSON output). See ai-agent-build-playbook.
export const AGENT_MODEL = process.env.RESEARCH_MODEL || "claude-sonnet-5";

export type Usage = { input_tokens: number; output_tokens: number };

export async function callClaudeJson<T>(
  prompt: string,
  schema: object,
  maxTokens = 3000
): Promise<{ result: T; usage: Usage }> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY as string,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: AGENT_MODEL,
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
