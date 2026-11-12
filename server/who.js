import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
let users = {};
try {
  users = JSON.parse(fs.readFileSync(path.join(dir, "users.json"), "utf8"));
} catch {}
const dataDir = path.join(dir, "data");
const fmt = (t) => new Date(t).toLocaleString("fr-FR", { timeZone: "Africa/Casablanca" });
const list = Object.values(users).sort((a, b) => b.lastSeen - a.lastSeen);
const known = new Set(list.map((u) => u.folder));
console.log(`${list.length} utilisateur(s) identifie(s)\n`);
for (const u of list) {
  const f = path.join(dataDir, u.folder);
  const n = fs.existsSync(f) ? fs.readdirSync(f).filter((x) => x.endsWith(".json")).length : 0;
  console.log(`${u.name} <${u.email}>  | projets cloud: ${n} | 1re visite: ${fmt(u.firstSeen)} | derniere: ${fmt(u.lastSeen)} | connexions: ${u.logins}`);
}
const unknown = fs.existsSync(dataDir) ? fs.readdirSync(dataDir).filter((d) => !known.has(d)) : [];
console.log(`\n${unknown.length} compte(s) cloud pas encore identifie(s) (apparaitront a leur prochaine visite)`);
