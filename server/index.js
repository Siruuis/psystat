import "dotenv/config";
import express from "express";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { registerAuth, requireAuth } from "./auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const PORT = Number(process.env.PORT || 3010);

fs.mkdirSync(DATA_DIR, { recursive: true });

const app = express();
app.use(express.json({ limit: "25mb" }));

registerAuth(app);

function userDir(email) {
  const hash = crypto.createHash("sha1").update(email.toLowerCase()).digest("hex").slice(0, 16);
  const dir = path.join(DATA_DIR, hash);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
const safeId = (id) => String(id).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40);

app.get("/api/projects", requireAuth, (req, res) => {
  const dir = userDir(req.user.email);
  const items = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => {
    try {
      const p = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
      return { id: p.id, name: p.name, savedAt: p.savedAt, variables: p.data?.variables?.length || 0, rows: p.data?.rows?.length || 0 };
    } catch {
      return null;
    }
  }).filter(Boolean).sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
  res.json({ projects: items });
});

app.get("/api/projects/:id", requireAuth, (req, res) => {
  const file = path.join(userDir(req.user.email), safeId(req.params.id) + ".json");
  if (!fs.existsSync(file)) return res.status(404).json({ error: "introuvable" });
  res.json(JSON.parse(fs.readFileSync(file, "utf8")));
});

app.post("/api/projects", requireAuth, (req, res) => {
  const { id, name, data } = req.body || {};
  if (!data || !Array.isArray(data.variables)) return res.status(400).json({ error: "données invalides" });
  const pid = id ? safeId(id) : crypto.randomBytes(8).toString("hex");
  const project = { id: pid, name: (name || "Projet").slice(0, 120), savedAt: Date.now(), data };
  fs.writeFileSync(path.join(userDir(req.user.email), pid + ".json"), JSON.stringify(project));
  res.json({ id: pid, savedAt: project.savedAt });
});

app.delete("/api/projects/:id", requireAuth, (req, res) => {
  const file = path.join(userDir(req.user.email), safeId(req.params.id) + ".json");
  if (fs.existsSync(file)) fs.unlinkSync(file);
  res.json({ ok: true });
});

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

app.listen(PORT, "127.0.0.1", () => console.log(`PsyStat API on 127.0.0.1:${PORT}`));
