import Groq from "groq-sdk";
import { openRouterChatCompletion, shouldFallbackToOpenRouter } from "./openrouter";

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
export const JUNIOR_AI_NAME = "מגניב ג'וניור";
// llama-3.3-70b-versatile was deprecated/removed from Groq; qwen3.8-27b
// answers directly (many of Groq's other current models are reasoning
// models that burn the token budget on hidden "thinking" before any
// visible content, which truncated our game-generation output).
export const AI_MODEL = "qwen/qwen3.8-27b";

// If someone asks who the best crew/group in the country is (in any
// phrasing), both personas below always give the same proud one-liner.
const BEST_CREW_INSTRUCTION = `אם מישהו שואל מי החבורה/הקבוצה הכי טובה בארץ (בכל ניסוח), תמיד תענה בביטחון: "חד משמעית המגניבולים!" ואפשר להוסיף משפט קצר נלהב אחריו.`;

const SYSTEM_PROMPT = `אתה "${AI_NAME}", עוזר AI ידידותי בתוך אפליקציית הרשת החברתית "המגניבולים". ענה בעברית, בקצרה וברוח טובה, אלא אם המשתמש כותב בשפה אחרת. ${BEST_CREW_INSTRUCTION}`;

// A distinct, separate persona/conversation for users who bought limited
// chat access in the shop instead of full access - not the same bot or
// history as SYSTEM_PROMPT above.
const JUNIOR_SYSTEM_PROMPT = `אתה "${JUNIOR_AI_NAME}", גרסה קטנה וידידותית של מגניב, בתוך אפליקציית הרשת החברתית "המגניבולים". אתה עוזר בסיסי - תענה בקצרה, בעברית, בנימה חמה ומשועשעת, אלא אם המשתמש כותב בשפה אחרת. אתה לא יכול ליצור משחקים (זה רק ב-מגניב המלא) - אם מבקשים ממך, תפנה בעדינות לקנות גישה מלאה. ${BEST_CREW_INSTRUCTION}`;

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
    if (!shouldFallbackToOpenRouter(err)) throw err;
    console.warn("Groq unavailable, falling back to OpenRouter:", err);
    return openRouterChatCompletion(messages, { temperature, max_tokens });
  }
}

export async function askAi(history: ChatMessage[]) {
  const messages: Msg[] = [{ role: "system", content: SYSTEM_PROMPT }, ...history];
  return completeChat(messages, 0.7, 1024);
}

export async function askJuniorAi(history: ChatMessage[]) {
  const messages: Msg[] = [{ role: "system", content: JUNIOR_SYSTEM_PROMPT }, ...history];
  return completeChat(messages, 0.7, 512);
}

const GAME_SYSTEM_PROMPT = `אתה מחולל משחקי דפדפן. תפקידך להחזיר תשובה בפורמט מדויק הבא, ללא שום טקסט נוסף, הסברים, או markdown code fences (בלי \`\`\`):

השורה הראשונה חייבת להיות בדיוק בפורמט: CONTROLS: <תיאור קצר וברור בעברית של כפתורי השליטה, לדוגמה: "חצים לתזוזה, רווח לקפיצה">
השורה השנייה חייבת להיות בדיוק בפורמט: TITLE: <שם קליט ומגניב למשחק, כמו כותרת אמיתית של משחק, לא חזרה על התיאור שהתקבל - עד 5 מילים>
מיד אחריהן, קובץ HTML שלם ועצמאי (מ-<!DOCTYPE html> ועד </html>).

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
TITLE: קפיצת הכוכבים
<!DOCTYPE html>
...`;

const POINTS_INSTRUCTIONS = `
דרישה נוספת: זהו משחק עם מערכת נקודות אמיתיות. בכל פעם שהניקוד עולה, קרא מייד ל:
window.parent.postMessage({ type: "megnivolim-points", points: <כמות הנקודות שנוספו הפעם, לא הסכום הכולל> }, "*");
שלח רק את הנקודות שנוספו הפעם (ה-delta), לא את הניקוד הכולל.`;

const LEADERBOARD_INSTRUCTIONS = `
דרישה נוספת: למשחק יש טבלת שיאים (leaderboard) גלובלית שהשרת מנהל. כדי לקבל אותה:
1. שלח window.parent.postMessage({ type: "megnivolim-leaderboard-request" }, "*")
2. האזן ל-window.addEventListener("message", ...) ובדוק אם e.data.type === "megnivolim-leaderboard-data" - במקרה כזה e.data.entries הוא מערך של { username: string, score: number } ממוין מהגבוה לנמוך.
3. צייר את הטבלה הזו על גבי ה-canvas (למשל במסך "Game Over" או במסך הפתיחה) - הצג את שם המשתמש והניקוד של כל שחקן ברשימה.
בקש את הטבלה מחדש (שלח שוב את הבקשה) בכל פעם שהמשחק מסתיים, כדי שהטבלה תהיה עדכנית.`;

const PHONE_INSTRUCTIONS = `
דרישה נוספת: המשחק חייב להיות מותאם היטב לטלפון נייד:
- כפתורי מגע גדולים וברורים (לפחות 48x48 פיקסלים), לא רק הסתמכות על מקלדת.
- ללא הסתמכות על hover (זה לא עובד במגע).
- הקנבס חייב להתאים את עצמו לגודל מסך משתנה (window.innerWidth/innerHeight, ולהאזין ל-resize) ולתמוך גם בתצוגה לאורך (portrait, צר וגבוה).
- טקסטים וכפתורים בגודל קריא במסך קטן.`;

const GAME_FALLBACK_HTML = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
body{margin:0;background:#050506;color:#f5f5f7;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center}
</style></head><body><div>מגניב לא הצליח ליצור את המשחק הפעם 😅<br/>נסה תיאור אחר.</div></body></html>`;

// Shown in the game-creator UI as an autocomplete when the user types "/".
export const GAME_SLASH_COMMANDS = [
  { command: "/point", description: "הניקוד במשחק הופך למטבעות אמיתיים שאפשר להוציא בחנות" },
  { command: "/leaderboard", description: "מוסיף טבלת שיאים גלובלית שמראה את השחקנים המובילים" },
  { command: "/phone", description: "מתאים את המשחק במיוחד למסך מגע של טלפון" },
] as const;

export type GeneratedGame = { code: string; controls: string | null; title: string | null };

function parseGameResponse(raw: string): GeneratedGame | null {
  let text = raw.trim();
  const fenced = text.match(/```(?:html)?\s*([\s\S]*?)```/i);
  if (fenced) text = fenced[1].trim();

  const controlsMatch = text.match(/^CONTROLS:\s*(.+)$/im);
  const controls = controlsMatch ? controlsMatch[1].trim() : null;

  const titleMatch = text.match(/^TITLE:\s*(.+)$/im);
  const title = titleMatch ? titleMatch[1].trim() : null;

  const start = text.search(/<!DOCTYPE html>|<html/i);
  if (start === -1) return null;

  const endIdx = text.slice(start).search(/<\/html>/i);
  // No closing </html> usually means the response got cut off mid-script
  // (hit max_tokens) - treat as invalid rather than shipping broken JS.
  if (endIdx === -1) return null;

  const code = text.slice(start, start + endIdx + "</html>".length);
  return { code, controls, title };
}

function isValidGameHtml(html: string): boolean {
  return /<canvas/i.test(html) && /getContext\(\s*["']2d["']\s*\)/.test(html);
}

function referenceImageInstructions(imageUrl: string) {
  return `

המשתמש צירף תמונת רפרנס בכתובת: ${imageUrl}
טען אותה בקוד ה-JavaScript עם קוד כמו: const refImg = new Image(); refImg.src = "${imageUrl}";
המתן לאירוע refImg.onload לפני שהמשחק מתחיל לצייר אותה, והשתמש בה כסמל/דמות/אובייקט מרכזי במשחק (למשל דמות השחקן), מצוירת עם ctx.drawImage. אל תמציא כתובת אחרת - השתמש בדיוק בכתובת שסופקה.`;
}

type GameFlags = { points: boolean; leaderboard: boolean; phone: boolean };

async function requestGame(
  prompt: string,
  temperature: number,
  flags: GameFlags,
  imageUrl: string | null
) {
  let systemPrompt = GAME_SYSTEM_PROMPT;
  if (flags.points) systemPrompt += POINTS_INSTRUCTIONS;
  if (flags.leaderboard) systemPrompt += LEADERBOARD_INSTRUCTIONS;
  if (flags.phone) systemPrompt += PHONE_INSTRUCTIONS;
  if (imageUrl) systemPrompt += referenceImageInstructions(imageUrl);

  const messages: Msg[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: `תיאור המשחק המבוקש: ${prompt}` },
  ];
  // Groq's on-demand tier caps at 12k tokens/minute; keep this well under
  // half that so a retry attempt doesn't itself trip the rate limit.
  const raw = await completeChat(messages, temperature, 4000);
  return parseGameResponse(raw);
}

// Slash commands anywhere in the prompt toggle extra game behavior (real
// coins from /point, a global /leaderboard, /phone-optimized controls) -
// stripped out before sending the description itself to the model. An
// optional reference image (already uploaded to Cloudinary) gets wired into
// the game as a sprite - the model never needs to "see" it, just write code
// that loads the URL.
export async function generateGame(rawPrompt: string, imageUrl?: string | null): Promise<GeneratedGame> {
  const flags: GameFlags = {
    points: /\/point\b/i.test(rawPrompt),
    leaderboard: /\/leaderboard\b/i.test(rawPrompt),
    phone: /\/phone\b/i.test(rawPrompt),
  };
  const prompt = rawPrompt.replace(/\/(point|leaderboard|phone)\b/gi, "").trim();
  const ref = imageUrl ?? null;

  const first = await requestGame(prompt, 0.5, flags, ref);
  if (first && isValidGameHtml(first.code)) return first;

  // Retry once, more deterministically, if the first attempt was missing,
  // truncated, or didn't actually use the Canvas 2D API.
  const second = await requestGame(prompt, 0.2, flags, ref);
  if (second && isValidGameHtml(second.code)) return second;

  const fallback = first ?? second;
  return fallback ?? { code: GAME_FALLBACK_HTML, controls: null, title: null };
}
