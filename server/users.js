import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = process.env.USERS_FILE || path.join(__dirname, "users.json");

let users = {};
try {
  users = JSON.parse(fs.readFileSync(FILE, "utf8"));
} catch {}

export function userHash(email) {
  return crypto.createHash("sha1").update(email.toLowerCase()).digest("hex").slice(0, 16);
}

export function recordUser(session, isLogin = false) {
  if (!session?.email) return;
  const email = session.email.toLowerCase();
  const now = Date.now();
  const u = users[email];
  if (u && !isLogin && now - u.lastSeen < 60_000 && u.name === session.name) return;
  users[email] = {
    email,
    name: session.name || u?.name || email,
    folder: userHash(email),
    firstSeen: u?.firstSeen || now,
    lastSeen: now,
    logins: (u?.logins || 0) + (isLogin ? 1 : 0),
    visits: (u?.visits || 0) + (isLogin ? 0 : 1),
  };
  try {
    fs.writeFileSync(FILE + ".tmp", JSON.stringify(users, null, 2));
    fs.renameSync(FILE + ".tmp", FILE);
  } catch (e) {
    console.error("users.json:", e.message);
  }
}
