import pg from "pg";
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const email = process.env.FACTORY_BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
const ownerPassword = process.env.FACTORY_DB_OWNER_PASSWORD;
if (!email) throw new Error("กรุณาตั้ง FACTORY_BOOTSTRAP_ADMIN_EMAIL ใน .env.local");
if (!ownerPassword) throw new Error("กรุณาตั้ง FACTORY_DB_OWNER_PASSWORD ใน .env.local");
if (process.env.FIREBASE_PROJECT_ID !== "ionflow-central-identity")
  throw new Error("FIREBASE_PROJECT_ID ต้องเป็น ionflow-central-identity");

const identity = await getAuth(
  initializeApp({
    credential: applicationDefault(),
    projectId: "ionflow-central-identity",
  }),
).getUserByEmail(email);
if (identity.disabled || !identity.emailVerified)
  throw new Error("บัญชี Identity Platform ต้องเปิดใช้งานและยืนยันอีเมลแล้ว");

const client = new pg.Client({
  host: "127.0.0.1",
  port: 5433,
  database: "production",
  user: "foliar_fertilizer_owner",
  password: ownerPassword,
  application_name: "foliar-bootstrap-admin",
  ssl: false,
});

try {
  await client.connect();
  await client.query("BEGIN");
  const role = await client.query(
    "SELECT id FROM foliar_fertilizer.app_roles WHERE code='factory_admin' AND is_active AND is_system",
  );
  const roleId = role.rows[0]?.id;
  if (!roleId) throw new Error("ไม่พบ Role factory_admin ที่เปิดใช้งาน");
  const saved = await client.query(
    `INSERT INTO foliar_fertilizer.app_users(firebase_uid,email,display_name,is_active)
     VALUES($1,$2,$3,true)
     ON CONFLICT(firebase_uid) DO UPDATE SET email=excluded.email,display_name=excluded.display_name,
       is_active=true,updated_at=clock_timestamp() RETURNING id`,
    [identity.uid, email, identity.displayName || email],
  );
  await client.query(
    `INSERT INTO foliar_fertilizer.app_user_roles(user_id,role_id)
     VALUES($1,$2) ON CONFLICT DO NOTHING`,
    [saved.rows[0].id, roleId],
  );
  await client.query("COMMIT");
  console.log(`กำหนด ${email} เป็นผู้ดูแล Foliar Fertilizer แล้ว`);
} catch (error) {
  await client.query("ROLLBACK").catch(() => undefined);
  throw error;
} finally {
  await client.end();
}
