import crypto from "node:crypto";

const MS_TENANT = process.env.MS_TENANT || "common";
const MS_CLIENT_ID = process.env.MS_CLIENT_ID || "";
const MS_CLIENT_SECRET = process.env.MS_CLIENT_SECRET || "";
const MS_REDIRECT_URI = process.env.MS_REDIRECT_URI || "";
const APP_URL = process.env.APP_URL || "/";
const SESSION_SECRET = process.env.SESSION_SECRET || "change-me";
const RAW_DOMAINS = process.env.ALLOWED_EMAIL_DOMAINS || "uir.ac.ma";
const ALLOW_ANY_DOMAIN = RAW_DOMAINS.trim() === "*";
const ALLOWED_EMAIL_DOMAINS = ALLOW_ANY_DOMAIN
  ? []
  : RAW_DOMAINS.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

export const AUTH_ENABLED = !!(MS_CLIENT_ID && MS_REDIRECT_URI);
const AUTHORIZE_URL = `https://login.microsoftonline.com/${MS_TENANT}/oauth2/v2.0/authorize`;
const TOKEN_URL = `https://login.microsoftonline.com/${MS_TENANT}/oauth2/v2.0/token`;
const COOKIE_NAME = "psystat_session";
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000;

function b64urlEncode(buf) {
  return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  return Buffer.from(str, "base64");
}
function hmac(body) {
  return b64urlEncode(crypto.createHmac("sha256", SESSION_SECRET).update(body).digest());
}
function sign(payload) {
  const body = b64urlEncode(JSON.stringify(payload));
  return `${body}.${hmac(body)}`;
}
function verify(token) {
  if (!token || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  if (sig !== hmac(body)) return null;
  try {
    const payload = JSON.parse(b64urlDecode(body).toString("utf8"));
    if (payload.exp && payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
function parseCookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || "").split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
function setSessionCookie(res, payload) {
  const token = sign({ ...payload, exp: Date.now() + COOKIE_MAX_AGE });
  res.setHeader("Set-Cookie",
    `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${Math.floor(COOKIE_MAX_AGE / 1000)}`);
}
function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
}
export function getSession(req) {
  const raw = parseCookies(req)[COOKIE_NAME];
  return raw ? verify(raw) : null;
}
function decodeIdToken(idToken) {
  const parts = (idToken || "").split(".");
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(b64urlDecode(parts[1]).toString("utf8"));
  } catch {
    return null;
  }
}
export function isEmailAllowed(email) {
  if (!email) return false;
  if (ALLOW_ANY_DOMAIN) return true;
  const lower = email.toLowerCase();
  return ALLOWED_EMAIL_DOMAINS.some((d) => lower.endsWith(`@${d}`));
}

export function requireAuth(req, res, next) {
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: "unauthenticated" });
  req.user = session;
  next();
}

export function registerAuth(app) {
  app.get("/api/auth/login", (req, res) => {
    if (!AUTH_ENABLED) return res.status(503).send("Auth non configurée");
    const state = crypto.randomBytes(16).toString("hex");
    res.setHeader("Set-Cookie", `oauth_state=${state}; Path=/api/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=600`);
    const params = new URLSearchParams({
      client_id: MS_CLIENT_ID,
      response_type: "code",
      redirect_uri: MS_REDIRECT_URI,
      response_mode: "query",
      scope: "openid profile email",
      prompt: "select_account",
      state,
    });
    res.redirect(`${AUTHORIZE_URL}?${params.toString()}`);
  });

  app.get("/api/auth/callback", async (req, res) => {
    if (!AUTH_ENABLED) return res.status(503).send("Auth non configurée");
    const { code, state, error, error_description } = req.query;
    if (error) return res.status(400).send(`Erreur login : ${error} - ${error_description || ""}`);
    if (!state || state !== parseCookies(req).oauth_state) return res.status(400).send("État invalide");
    if (!code) return res.status(400).send("Code manquant");
    try {
      const body = new URLSearchParams({
        client_id: MS_CLIENT_ID,
        code: String(code),
        redirect_uri: MS_REDIRECT_URI,
        grant_type: "authorization_code",
      });
      if (MS_CLIENT_SECRET) body.set("client_secret", MS_CLIENT_SECRET);
      const r = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });
      const tokens = await r.json();
      if (!r.ok) return res.status(400).send(`Échec token : ${tokens.error_description || tokens.error || "inconnu"}`);
      const claims = decodeIdToken(tokens.id_token);
      if (!claims) return res.status(400).send("id_token invalide");
      const email = (claims.preferred_username || claims.email || "").toLowerCase();
      const name = claims.name || email;
      if (!isEmailAllowed(email)) {
        return res.status(403).send(
          `Accès refusé : ${email}<br>Réservé aux emails ${ALLOWED_EMAIL_DOMAINS.map((d) => "@" + d).join(", ")}.<br><a href="${APP_URL}">Retour</a>`
        );
      }
      setSessionCookie(res, { email, name });
      res.setHeader("Set-Cookie", [res.getHeader("Set-Cookie"), `oauth_state=; Path=/api/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=0`].flat());
      res.redirect(APP_URL);
    } catch (e) {
      console.error("Callback error:", e);
      res.status(500).send("Erreur interne d'authentification");
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  app.get("/api/me", (req, res) => {
    const session = getSession(req);
    if (!session) return res.json({ authenticated: false, authEnabled: AUTH_ENABLED });
    res.json({ authenticated: true, email: session.email, name: session.name });
  });
}
