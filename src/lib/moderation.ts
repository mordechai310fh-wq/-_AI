// Best-effort image content check before a post goes live. Video isn't
// screened (would need frame extraction, out of scope) - only images. Uses a
// free OpenRouter vision model dedicated to this check, separate from the
// OPENROUTER_MODEL used for AI chat fallback. If the check itself fails
// (model down, rate-limited, bad response), it fails OPEN - blocking every
// upload because a moderation call errored would be worse than the rare
// slip-through.
const MODERATION_MODEL = "minimax/minimax-m3:free";

export async function moderateImage(imageUrl: string): Promise<{ flagged: boolean }> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return { flagged: false };

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODERATION_MODEL,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Does this image contain nudity, sexual content, or graphic violence? Answer with exactly one word: YES or NO.",
              },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
        max_tokens: 200,
        temperature: 0,
      }),
    });

    if (!res.ok) {
      console.error("Image moderation request failed:", res.status, await res.text().catch(() => ""));
      return { flagged: false };
    }

    const data = await res.json();
    const answer = (data.choices?.[0]?.message?.content ?? "").trim().toUpperCase();
    return { flagged: answer.includes("YES") };
  } catch (err) {
    console.error("Image moderation check errored:", err);
    return { flagged: false };
  }
}
