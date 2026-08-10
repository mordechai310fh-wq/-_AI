// Fallback provider used when Groq's rate limit (429) is hit. OpenRouter
// exposes an OpenAI-compatible REST API, so no extra SDK is needed.
type Msg = { role: string; content: string };

export async function openRouterChatCompletion(
  messages: Msg[],
  opts: { temperature?: number; max_tokens?: number } = {}
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");
  const model = process.env.OPENROUTER_MODEL || "google/gemma-4-26b-a4b-it:free";

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.max_tokens ?? 1024,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`OpenRouter error ${res.status}: ${text}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

export function isRateLimitError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  return (err as { status?: number }).status === 429;
}
