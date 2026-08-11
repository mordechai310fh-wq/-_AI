import { build } from "esbuild";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

await build({
  entryPoints: [path.join(root, "server/socket-server.ts")],
  outfile: path.join(root, "dist-server/socket-server.js"),
  platform: "node",
  target: "node18",
  format: "cjs",
  bundle: true,
  // Keep everything from node_modules external (resolved at runtime),
  // only bundle our own local ../src/lib imports into one file.
  packages: "external",
});

console.log("Built dist-server/socket-server.js");
