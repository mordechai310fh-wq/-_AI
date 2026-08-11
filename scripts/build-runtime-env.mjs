import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

// Only what the packaged server actually needs at runtime. DATABASE_URL and
// SOCKET_PORT are set by electron/main.js itself (userData path, fixed port).
const KEYS = ["JWT_SECRET", "GROQ_API_KEY", "OPENROUTER_API_KEY", "OPENROUTER_MODEL"];

const env = {};
for (const key of KEYS) {
  if (process.env[key]) env[key] = process.env[key];
}

const missing = KEYS.filter((k) => !env[k]);
if (missing.length) {
  console.warn("Warning: missing from .env, packaged app won't have these:", missing.join(", "));
}

const outPath = path.join(root, "resources", "runtime-env.json");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(env, null, 2));
console.log("Wrote", outPath, "with keys:", Object.keys(env).join(", "));
