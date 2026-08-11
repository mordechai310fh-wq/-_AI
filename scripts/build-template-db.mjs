import { execSync } from "child_process";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const dbPath = path.join(root, "resources", "app-template.db");

fs.mkdirSync(path.dirname(dbPath), { recursive: true });
fs.rmSync(dbPath, { force: true });

// Bundled with the packaged app; copied to the user's data dir on first
// launch so a fresh install already has a working, seeded database.
const env = { ...process.env, DATABASE_URL: `file:${dbPath}` };

execSync("npx prisma db push --skip-generate", { cwd: root, env, stdio: "inherit" });
execSync("node prisma/seed.mjs", { cwd: root, env, stdio: "inherit" });

console.log("Template DB written to", dbPath);
