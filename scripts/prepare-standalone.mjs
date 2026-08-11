import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const src = path.join(root, ".next", "standalone");
const dest = path.join(root, "next-standalone");

fs.rmSync(dest, { recursive: true, force: true });
fs.cpSync(src, dest, { recursive: true });

// Next's standalone output doesn't include static chunks or the public
// folder by default - copy them in so the app actually renders.
fs.cpSync(path.join(root, ".next", "static"), path.join(dest, ".next", "static"), { recursive: true });
fs.cpSync(path.join(root, "public"), path.join(dest, "public"), { recursive: true });

console.log("Prepared", dest);
