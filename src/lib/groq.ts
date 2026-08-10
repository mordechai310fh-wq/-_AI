import Groq from "groq-sdk";
import { openRouterChatCompletion, isRateLimitError } from "./openrouter";

let client: Groq | null = null;

function getClient() {
  if (!client) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error("GROQ_API_KEY is not set");
    client = new Groq({ apiKey });
  }
  return client;
}

export const AI_NAME = "מגניב";
export const AI_MODEL = "llama-3.3-70b-versatile";

const SYSTEM_PROMPT = `אתה "${AI_NAME}", עוזר AI ידידותי בתוך אפליקציית הרשת החברתית "המגניבולים". ענה בעברית, בקצרה וברוח טובה, אלא אם המשתמש כותב בשפה אחרת.`;

export type ChatMessage = { role: "user" | "assistant"; content: string };
type Msg = { role: "system" | "user" | "assistant"; content: string };

// Groq's free tier has a tight tokens-per-minute cap; fall back to
// OpenRouter automatically when it's hit rather than surfacing an error.
async function completeChat(messages: Msg[], temperature: number, max_tokens: number) {
  try {
    const groq = getClient();
    const completion = await groq.chat.completions.create({
      model: AI_MODEL,
      messages,
      temperature,
      max_tokens,
    });
    return completion.choices[0]?.message?.content ?? "";
  } catch (err) {
    if (!isRateLimitError(err)) throw err;
    console.warn("Groq rate-limited, falling back to OpenRouter");
    return openRouterChatCompletion(messages, { temperature, max_tokens });
  }
}

export async function askAi(history: ChatMessage[]) {
  const messages: Msg[] = [{ role: "system", content: SYSTEM_PROMPT }, ...history];
  return completeChat(messages, 0.7, 1024);
}

const GAME_SYSTEM_PROMPT = `אתה מחולל משחקי דפדפן. תפקידך להחזיר תשובה בפורמט מדויק הבא, ללא שום טקסט נוסף, הסברים, או markdown code fences (בלי \`\`\`):

השורה הראשונה חייבת להיות בדיוק בפורמט: CONTROLS: <תיאור קצר וברור בעברית של כפתורי השליטה, לדוגמה: "חצים לתזוזה, רווח לקפיצה">
מיד אחריה, קובץ HTML שלם ועצמאי (מ-<!DOCTYPE html> ועד </html>).

דרישות מחייבות לקוד ה-HTML:
- מסמך HTML מלא ותקין.
- כל ה-CSS בתוך <style> ב-<head>. כל ה-JavaScript בתוך <script> לפני </body>.
- אסור להשתמש בספריות או קבצים חיצוניים - רק Canvas 2D API טהור (וניל JS).
- <canvas> שממלא את כל החלון (responsive, מגיב לשינוי גודל).
- שליטה במקלדת (חצים ו/או WASD) וגם במגע/עכבר כשרלוונטי. הקוד חייב לקרוא ל-focus() על עצמו או להשתמש ב-window לכפתורים כדי שהשליטה תעבוד מיד.
- לוגיקת משחק תקינה: ניקוד, מצב "Game Over", אפשרות להתחיל מחדש.
- עיצוב כהה ונעים לעין.
- קוד נקי ותקין ללא שגיאות JavaScript.

דוגמה לתחילת תשובה תקינה:
CONTROLS: חצים לתזוזה, רווח לקפיצה
<!DOCTYPE html>
...`;

const GAME_FALLBACK_HTML = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
body{margin:0;background:#050506;color:#f5f5f7;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center}
</style></head><body><div>מגניב לא הצליח ליצור את המשחק הפעם 😅<br/>נסה תיאור אחר.</div></body></html>`;

export type GeneratedGame = { code: string; controls: string | null };

function parseGameResponse(raw: string): GeneratedGame | null {
  let text = raw.trim();
  const fenced = text.match(/```(?:html)?\s*([\s\S]*?)```/i);
  if (fenced) text = fenced[1].trim();

  const controlsMatch = text.match(/^CONTROLS:\s*(.+)$/im);
  const controls = controlsMatch ? controlsMatch[1].trim() : null;

  const start = text.search(/<!DOCTYPE html>|<html/i);
  if (start === -1) return null;

  const endIdx = text.slice(start).search(/<\/html>/i);
  // No closing </html> usually means the response got cut off mid-script
  // (hit max_tokens) - treat as invalid rather than shipping broken JS.
  if (endIdx === -1) return null;

  const code = text.slice(start, start + endIdx + "</html>".length);
  return { code, controls };
}

function isValidGameHtml(html: string): boolean {
  return /<canvas/i.test(html) && /getContext\(\s*["']2d["']\s*\)/.test(html);
}

async function requestGame(prompt: string, temperature: number) {
  const messages: Msg[] = [
    { role: "system", content: GAME_SYSTEM_PROMPT },
    { role: "user", content: `תיאור המשחק המבוקש: ${prompt}` },
  ];
  // Groq's on-demand tier caps at 12k tokens/minute; keep this well under
  // half that so a retry attempt doesn't itself trip the rate limit.
  const raw = await completeChat(messages, temperature, 4000);
  return parseGameResponse(raw);
}

export async function generateGame(prompt: string): Promise<GeneratedGame> {
  const first = await requestGame(prompt, 0.5);
  if (first && isValidGameHtml(first.code)) return first;

  // Retry once, more deterministically, if the first attempt was missing,
  // truncated, or didn't actually use the Canvas 2D API.
  const second = await requestGame(prompt, 0.2);
  if (second && isValidGameHtml(second.code)) return second;

  const fallback = first ?? second;
  return fallback ?? { code: GAME_FALLBACK_HTML, controls: null };
}
