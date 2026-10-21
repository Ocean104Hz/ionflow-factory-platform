import "server-only";
import type { IncomingMessage } from "node:http";
import { SettingsError } from "./settings-postgres.ts";

export function settingsLocalOrigin(env = process.env): string {
  const origin = env.FACTORY_SETTINGS_APP_ORIGIN ?? "http://localhost:3002";
  let url: URL;
  try { url = new URL(origin); } catch { throw new SettingsError(403, "Local Settings origin ไม่ถูกต้อง"); }
  if (url.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(url.hostname) ||
    url.origin !== origin || url.username || url.password) throw new SettingsError(403, "Local Settings origin ไม่ถูกต้อง");
  return origin;
}
export function assertLocalSettingsRequest(req: Pick<IncomingMessage, "headers" | "socket">, env = process.env) {
  if (env.NODE_ENV !== "development" || env.FACTORY_SETTINGS_ENABLED !== "true" ||
    !["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.socket.remoteAddress ?? "") ||
    req.headers.host !== "127.0.0.1:4317" || req.headers.origin !== settingsLocalOrigin(env))
    throw new SettingsError(403, "Settings API เปิดเฉพาะ browser origin และ loopback socket ที่อนุญาต");
  // Forwarding headers are never evidence of locality; this service is not proxy-deployable.
  if (req.headers.forwarded || req.headers["x-forwarded-for"] || req.headers["x-forwarded-host"])
    throw new SettingsError(403, "ไม่อนุญาต proxy สำหรับ Local Settings");
}
