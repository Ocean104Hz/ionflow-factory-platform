import { createServer } from "node:http";
import { createSettingsStore, SettingsError } from "../src/server/settings-postgres.ts";
import { assertLocalSettingsRequest, settingsLocalOrigin } from "../src/server/settings-local-access.ts";

// Explicit development opt-in. Never bind this developer-only service to a public interface.
const store = createSettingsStore();
const server = createServer(async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  try {
    assertLocalSettingsRequest(req);
    res.setHeader("Access-Control-Allow-Origin", settingsLocalOrigin());
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
    if (req.url !== "/masters") throw new SettingsError(404, "ไม่พบ Settings endpoint");
    let result;
    if (req.method === "GET") result = await store.read();
    else if (req.method === "POST") {
      if (req.headers["content-type"] !== "application/json") throw new SettingsError(415, "ต้องใช้ JSON");
      let bytes = 0;
      const chunks = [];
      for await (const chunk of req) {
        bytes += chunk.length;
        if (bytes > 65536) throw new SettingsError(413, "ข้อมูลเกินขนาด");
        chunks.push(chunk);
      }
      let body;
      try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw new SettingsError(400, "JSON ไม่ถูกต้อง"); }
      if (!body || typeof body !== "object" || Array.isArray(body)) throw new SettingsError(400, "ข้อมูลไม่ถูกต้อง");
      result = await store.save(body.row, body.expectedVersion);
    } else if (req.method === "DELETE") result = await store.remove();
    else throw new SettingsError(405, "ไม่รองรับวิธีนี้");
    res.end(JSON.stringify({ ok: true, data: result }));
  } catch (error) {
    const known = error instanceof SettingsError;
    res.writeHead(known ? error.status : 503);
    res.end(JSON.stringify({ ok: false, error: known ? error.message : "Settings PostgreSQL ไม่พร้อมใช้งาน" }));
  }
});
server.listen(4317, "127.0.0.1", () => console.log("Local Settings API listening on loopback port 4317"));
server.on("error", () => { console.error("SETTINGS_LISTEN_FAILED"); process.exitCode = 1; void store.close(); });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => {
  server.close(() => { void store.close().finally(() => process.exit()); });
});
