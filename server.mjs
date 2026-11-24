// Abhängigkeitsfreier lokaler Web- & Sync-Server für Mac + Heim-WLAN (iPhone/iPad).

import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, "data", "movies.json");
const PORT = Number(process.env.PORT || 3000);

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon"
};

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function getLanAddresses() {
  const nets = os.networkInterfaces();
  const ips = [];
  for (const entries of Object.values(nets)) {
    for (const net of entries || []) {
      if (net.family === "IPv4" && !net.internal) ips.push(net.address);
    }
  }
  return ips;
}

export function createAppServer({ dataPath = DATA_PATH, rootDir = __dirname } = {}) {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
      const pathname = decodeURIComponent(url.pathname);

      if (req.method === "GET" && pathname === "/api/health") {
        return sendJson(res, 200, { ok: true, mode: "local-server" });
      }

      if (req.method === "GET" && pathname === "/api/movies") {
        const raw = await fs.readFile(dataPath, "utf8");
        res.writeHead(200, {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store"
        });
        return res.end(raw);
      }

      if (req.method === "PUT" && pathname === "/api/movies") {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const body = Buffer.concat(chunks).toString("utf8");
        const parsed = JSON.parse(body);
        if (!parsed || !Array.isArray(parsed.items)) {
          return sendJson(res, 400, { error: "Ungültiges JSON: 'items'-Array erforderlich." });
        }
        const formatted = JSON.stringify({ version: parsed.version || 1, items: parsed.items }, null, 2) + "\n";
        const tmpPath = `${dataPath}.tmp`;
        await fs.writeFile(tmpPath, formatted, "utf8");
        await fs.rename(tmpPath, dataPath);
        return sendJson(res, 200, { ok: true, count: parsed.items.length });
      }

      if (req.method !== "GET" && req.method !== "HEAD") {
        return sendJson(res, 405, { error: "Methode nicht erlaubt" });
      }

      const relPath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
      const resolved = path.resolve(rootDir, relPath);
      if (!resolved.startsWith(rootDir + path.sep) && resolved !== rootDir) {
        return sendJson(res, 403, { error: "Zugriff verweigert" });
      }

      let filePath = resolved;
      try {
        const stat = await fs.stat(filePath);
        if (stat.isDirectory()) filePath = path.join(filePath, "index.html");
      } catch {
        return sendJson(res, 404, { error: "Nicht gefunden" });
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || "application/octet-stream";
      const content = await fs.readFile(filePath);
      res.writeHead(200, { "Content-Type": contentType });
      res.end(req.method === "HEAD" ? undefined : content);
    } catch (err) {
      sendJson(res, 500, { error: err.message || "Interner Serverfehler" });
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = createAppServer();
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`\n🎬 Filmabend läuft!`);
    console.log(`   Auf diesem Mac: http://localhost:${PORT}`);
    for (const ip of getLanAddresses()) {
      console.log(`   Im Heim-WLAN:   http://${ip}:${PORT}`);
    }
    console.log(`\n   Beenden mit Ctrl+C.\n`);
  });
}
