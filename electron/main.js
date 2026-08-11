const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");
const { fork } = require("child_process");
const http = require("http");

const isDev = !app.isPackaged;
const NEXT_PORT = 3000;
const SOCKET_PORT = 4001;

function resourcePath(...segments) {
  // In dev this repo's root; in a packaged app, electron-builder's
  // extraResources land in process.resourcesPath.
  const base = isDev ? path.join(__dirname, "..") : process.resourcesPath;
  return path.join(base, ...segments);
}

function loadRuntimeEnv() {
  try {
    return JSON.parse(fs.readFileSync(resourcePath("resources", "runtime-env.json"), "utf8"));
  } catch {
    return {};
  }
}

// The install directory is read-only once packaged; the DB and uploads
// need a writable, per-user location.
function ensureUserData() {
  const userDataDir = app.getPath("userData");
  const dbPath = path.join(userDataDir, "app.db");
  const uploadsDir = path.join(userDataDir, "uploads");

  if (!fs.existsSync(dbPath)) {
    fs.copyFileSync(resourcePath("resources", "app-template.db"), dbPath);
  }
  fs.mkdirSync(uploadsDir, { recursive: true });

  return { dbPath, uploadsDir };
}

let nextProcess = null;
let socketProcess = null;

function startServers() {
  const { dbPath, uploadsDir } = ensureUserData();
  const runtimeEnv = loadRuntimeEnv();

  const commonEnv = {
    ...process.env,
    ...runtimeEnv,
    DATABASE_URL: `file:${dbPath}`,
    UPLOADS_DIR: uploadsDir,
  };

  const nextServerPath = resourcePath("next-standalone", "server.js");
  nextProcess = fork(nextServerPath, [], {
    cwd: path.dirname(nextServerPath),
    env: { ...commonEnv, PORT: String(NEXT_PORT), HOSTNAME: "127.0.0.1" },
    silent: false,
  });
  nextProcess.on("exit", (code) => {
    if (code) console.error("Next server exited with code", code);
  });

  const socketServerPath = resourcePath("dist-server", "socket-server.js");
  socketProcess = fork(socketServerPath, [], {
    env: { ...commonEnv, SOCKET_PORT: String(SOCKET_PORT) },
    silent: false,
  });
  socketProcess.on("exit", (code) => {
    if (code) console.error("Socket server exited with code", code);
  });
}

function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      http
        .get(url, (res) => {
          res.resume();
          resolve();
        })
        .on("error", () => {
          if (Date.now() - start > timeoutMs) reject(new Error("Server did not start in time"));
          else setTimeout(tryOnce, 300);
        });
    };
    tryOnce();
  });
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    title: "המגניבולים",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  await waitForServer(`http://127.0.0.1:${NEXT_PORT}/login`);
  win.loadURL(`http://127.0.0.1:${NEXT_PORT}`);
}

app.whenReady().then(async () => {
  startServers();
  try {
    await createWindow();
  } catch (err) {
    console.error("Failed to start:", err);
    app.quit();
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  nextProcess?.kill();
  socketProcess?.kill();
});
