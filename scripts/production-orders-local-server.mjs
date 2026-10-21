import { createServer } from "node:http";
import { createProductionStore, assertLocalProductionRequest } from "../src/server/production-orders-postgres.ts";
import { ProductionOrderError } from "../src/features/production-orders/production-order-domain.ts";
const origin = process.env.FACTORY_PRODUCTION_APP_ORIGIN ?? "http://localhost:3000";
const parsed = new URL(origin);
if (parsed.origin !== origin || parsed.protocol !== "http:" || !["localhost","127.0.0.1"].includes(parsed.hostname) || parsed.username || parsed.password) throw Error("LOCAL_ORIGIN_REJECTED");
const store = createProductionStore();
const server = createServer(async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("X-Content-Type-Options", "nosniff");
  try {
    assertLocalProductionRequest(req);
    res.setHeader("Access-Control-Allow-Origin", origin); res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS"); res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
    if (req.url !== "/orders") throw new ProductionOrderError(404, "ไม่พบ endpoint");
    let result;
    if (req.method === "GET") result = await store.read();
    else if (["POST","DELETE"].includes(req.method ?? "")) {
      if (req.headers["content-type"] !== "application/json") throw new ProductionOrderError(415, "ต้องใช้ JSON");
      const chunks = []; let bytes = 0;
      for await (const chunk of req) { bytes += chunk.length; if (bytes > 262144) throw new ProductionOrderError(413, "ข้อมูลเกินขนาด"); chunks.push(chunk); }
      let body;
      try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw new ProductionOrderError(400, "JSON ไม่ถูกต้อง"); }
      if (!body || typeof body !== "object" || Array.isArray(body)) throw new ProductionOrderError(400, "ข้อมูลไม่ถูกต้อง");
      result = req.method === "POST" ? await store.save(body.order, body.expectedVersion, body.description) : await store.remove(typeof body.id === "string" ? body.id : "", body.expectedVersion);
    } else throw new ProductionOrderError(405, "ไม่รองรับวิธีนี้");
    res.end(JSON.stringify({ ok: true, data: result }));
  } catch (error) {
    res.writeHead(error instanceof ProductionOrderError ? error.status : 503);
    res.end(JSON.stringify({ ok: false, error: error instanceof ProductionOrderError ? error.message : "Production Orders PostgreSQL ไม่พร้อมใช้งาน" }));
  }
});
server.listen(4318,"127.0.0.1",()=>console.log("Local Production Orders API listening on loopback port 4318"));
server.on("error",()=>{ console.error("PRODUCTION_LISTEN_FAILED"); process.exitCode=1; void store.close(); });
for (const signal of ["SIGINT","SIGTERM"]) process.on(signal,()=>server.close(()=>void store.close().finally(()=>process.exit())));
