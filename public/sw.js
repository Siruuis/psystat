// Service Worker PsyStat : cache persistant du runtime Pyodide et des paquets Python.
// Après le 1er chargement, tout est servi depuis le Cache Storage (rapide + hors-ligne).
const CACHE = "psystat-pyodide-v1";
const CACHED_HOSTS = ["cdn.jsdelivr.net", "files.pythonhosted.org", "pypi.org"];

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET") return;
  if (!CACHED_HOSTS.some((h) => url.hostname === h || url.hostname.endsWith("." + h))) return;
  if (!/pyodide|\.whl|\.wasm|\.zip|\.data|\.json|\.js$/i.test(url.pathname) && !url.hostname.includes("pythonhosted") && !url.hostname.includes("pypi")) return;

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(event.request);
      if (hit) return hit;
      try {
        const res = await fetch(event.request);
        if (res && (res.ok || res.type === "opaque")) cache.put(event.request, res.clone());
        return res;
      } catch (e) {
        const fallback = await cache.match(event.request);
        if (fallback) return fallback;
        throw e;
      }
    })
  );
});
