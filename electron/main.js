import { app, BrowserWindow } from "electron";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import http from "node:http";
import net from "node:net";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");
const isDev = process.env.NODE_ENV === "development";

let enginePort = 8000;
let engineProcess = null;
let mainWindow = null;

function getFreePort() {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
  });
}

function enginePaths() {
  if (isDev) {
    return {
      mode: "python",
      python: path.join(rootDir, "engine", ".venv", "Scripts", "python.exe"),
      script: path.join(rootDir, "engine", "main.py"),
      cwd: path.join(rootDir, "engine"),
    };
  }
  const engineDir = path.join(process.resourcesPath, "engine");
  const binName = process.platform === "win32" ? "psystat-engine.exe" : "psystat-engine";
  return {
    mode: "frozen",
    bin: path.join(engineDir, binName),
    cwd: engineDir,
  };
}

function startEngine() {
  const info = enginePaths();
  if (info.mode === "frozen") {
    engineProcess = spawn(info.bin, [String(enginePort)], { cwd: info.cwd });
  } else {
    engineProcess = spawn(info.python, [info.script, String(enginePort)], { cwd: info.cwd });
  }
  engineProcess.stdout.on("data", (d) => console.log(`[engine] ${d}`));
  engineProcess.stderr.on("data", (d) => console.error(`[engine] ${d}`));
  engineProcess.on("exit", (code) => console.log(`[engine] exited ${code}`));
}

function waitForEngine(retries = 40) {
  return new Promise((resolve, reject) => {
    const attempt = (left) => {
      const req = http.get(
        { host: "127.0.0.1", port: enginePort, path: "/health", timeout: 500 },
        (res) => {
          res.resume();
          resolve();
        }
      );
      req.on("error", () => {
        if (left <= 0) return reject(new Error("Moteur Python indisponible"));
        setTimeout(() => attempt(left - 1), 300);
      });
      req.on("timeout", () => req.destroy());
    };
    attempt(retries);
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    backgroundColor: "#f4f5f7",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      additionalArguments: [`--engine-port=${enginePort}`],
    },
  });

  if (isDev) {
    await mainWindow.loadURL("http://localhost:5173");
  } else {
    await mainWindow.loadFile(path.join(rootDir, "dist", "index.html"));
  }
}

app.whenReady().then(async () => {
  enginePort = await getFreePort();
  startEngine();
  try {
    await waitForEngine();
  } catch (err) {
    console.error(err);
  }
  await createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (engineProcess) engineProcess.kill();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  if (engineProcess) engineProcess.kill();
});
