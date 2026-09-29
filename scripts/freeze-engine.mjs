import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const engineDir = path.join(__dirname, "..", "engine");
const python =
  process.platform === "win32"
    ? path.join(engineDir, ".venv", "Scripts", "python.exe")
    : path.join(engineDir, ".venv", "bin", "python");

console.log("Gel du moteur Python (PyInstaller)... cela peut prendre 15-20 min.");
const res = spawnSync(
  python,
  ["-m", "PyInstaller", "psystat_engine.spec", "--noconfirm", "--distpath", "dist", "--workpath", "build_pyi"],
  { cwd: engineDir, stdio: "inherit" }
);
process.exit(res.status ?? 1);
