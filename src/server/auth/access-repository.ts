import "server-only";
import { Pool, type PoolClient } from "pg";
import { readDatabaseConfig } from "../database/config.ts";
import {
  FactoryAuthError,
  type AuthenticatedFactoryUser,
} from "./auth-service.ts";

export type AccessUser = Readonly<{
  id: string;
  firebaseUid: string;
  email: string;
  displayName: string;
  active: boolean;
  roleIds: readonly string[];
}>;
export type AccessRole = Readonly<{
  id: string;
  code: string;
  name: string;
  system: boolean;
  active: boolean;
  moduleKeys: readonly string[];
}>;
export type AccessModule = Readonly<{
  key: string;
  title: string;
  group: string;
  href: string;
  sortOrder: number;
}>;

function stringArray(value: unknown): readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? value
    : [];
}

function makePool(): Pool {
  const config = readDatabaseConfig();
  return new Pool({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    max: config.max,
    connectionTimeoutMillis: config.connectionTimeoutMillis,
    idleTimeoutMillis: config.idleTimeoutMillis,
    statement_timeout: config.statementTimeoutMillis,
    query_timeout: config.statementTimeoutMillis + 1000,
    lock_timeout: config.statementTimeoutMillis,
    application_name: "foliar-fertilizer-access",
    ssl: false,
    options: "-c search_path=pg_catalog",
  });
}

const cache = globalThis as typeof globalThis & { foliarAccessPool?: Pool };
export function getFactoryDatabasePool(): Pool {
  try {
    return (cache.foliarAccessPool ??= makePool());
  } catch {
    throw new FactoryAuthError("AUTH_UNAVAILABLE", 503);
  }
}

async function withClient<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  let client: PoolClient;
  try {
    client = await getFactoryDatabasePool().connect();
  } catch {
    throw new FactoryAuthError("AUTH_UNAVAILABLE", 503);
  }
  try {
    return await work(client);
  } catch (error) {
    if (error instanceof FactoryAuthError) throw error;
    throw new FactoryAuthError("AUTH_UNAVAILABLE", 503);
  } finally {
    client.release();
  }
}

export async function findFactoryUserByUid(
  firebaseUid: string,
  identity?: Readonly<{ email?: string; name?: string }>,
): Promise<AuthenticatedFactoryUser | null> {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT u.id::text,u.firebase_uid,u.email,u.display_name,u.is_active,
              COALESCE(array_agg(DISTINCT r.code) FILTER (WHERE r.code IS NOT NULL AND r.is_active),'{}') roles,
              COALESCE(array_agg(DISTINCT rm.module_key) FILTER (WHERE rm.module_key IS NOT NULL AND m.is_active),'{}') modules
         FROM foliar_fertilizer.app_users u
         LEFT JOIN foliar_fertilizer.app_user_roles ur ON ur.user_id=u.id
         LEFT JOIN foliar_fertilizer.app_roles r ON r.id=ur.role_id AND r.is_active
         LEFT JOIN foliar_fertilizer.app_role_modules rm ON rm.role_id=r.id
         LEFT JOIN foliar_fertilizer.app_modules m ON m.module_key=rm.module_key
        WHERE u.firebase_uid=$1
        GROUP BY u.id`,
      [firebaseUid],
    );
    const row = result.rows[0];
    if (!row || !row.is_active || stringArray(row.roles).length === 0) return null;
    if (identity) {
      const email = identity.email?.trim().toLowerCase();
      const displayName = identity.name?.trim();
      await client.query(
        `UPDATE foliar_fertilizer.app_users
            SET email=COALESCE($2,email),display_name=COALESCE($3,display_name),
                last_login_at=clock_timestamp(),updated_at=clock_timestamp()
          WHERE id=$1`,
        [row.id, email || null, displayName || null],
      );
    }
    return {
      id: row.id,
      firebaseUid: row.firebase_uid,
      email: identity?.email?.trim().toLowerCase() || row.email,
      displayName: identity?.name?.trim() || row.display_name,
      roles: stringArray(row.roles),
      modules: stringArray(row.modules),
    };
  });
}

export async function listAccessAdministration(): Promise<{
  users: readonly AccessUser[];
  roles: readonly AccessRole[];
  modules: readonly AccessModule[];
}> {
  return withClient(async (client) => {
    const [users, roles, modules] = await Promise.all([
      client.query(`SELECT u.id::text,u.firebase_uid,u.email,u.display_name,u.is_active,
        COALESCE(array_agg(ur.role_id::text) FILTER (WHERE ur.role_id IS NOT NULL),'{}') role_ids
        FROM foliar_fertilizer.app_users u LEFT JOIN foliar_fertilizer.app_user_roles ur ON ur.user_id=u.id
        GROUP BY u.id ORDER BY u.display_name,u.email`),
      client.query(`SELECT r.id::text,r.code,r.name,r.is_system,r.is_active,
        COALESCE(array_agg(rm.module_key) FILTER (WHERE rm.module_key IS NOT NULL),'{}') module_keys
        FROM foliar_fertilizer.app_roles r LEFT JOIN foliar_fertilizer.app_role_modules rm ON rm.role_id=r.id
        GROUP BY r.id ORDER BY r.is_system DESC,r.name`),
      client.query(`SELECT module_key,title,group_key,href,sort_order FROM foliar_fertilizer.app_modules
        WHERE is_active ORDER BY sort_order`),
    ]);
    return {
      users: users.rows.map((row) => ({
        id: row.id, firebaseUid: row.firebase_uid, email: row.email,
        displayName: row.display_name, active: row.is_active,
        roleIds: stringArray(row.role_ids),
      })),
      roles: roles.rows.map((row) => ({
        id: row.id, code: row.code, name: row.name, system: row.is_system,
        active: row.is_active, moduleKeys: stringArray(row.module_keys),
      })),
      modules: modules.rows.map((row) => ({
        key: row.module_key, title: row.title, group: row.group_key,
        href: row.href, sortOrder: row.sort_order,
      })),
    };
  });
}

export async function findAccessUserUid(id: string): Promise<string | null> {
  return withClient(async (client) => {
    const result = await client.query<{ firebase_uid: string }>(
      "SELECT firebase_uid FROM foliar_fertilizer.app_users WHERE id=$1",
      [id],
    );
    return result.rows[0]?.firebase_uid ?? null;
  });
}

export async function saveAccessUser(input: {
  firebaseUid: string;
  email: string;
  displayName: string;
  active: boolean;
  roleIds: readonly string[];
}): Promise<void> {
  await withClient(async (client) => {
    await client.query("BEGIN");
    try {
      const saved = await client.query(
        `INSERT INTO foliar_fertilizer.app_users(firebase_uid,email,display_name,is_active)
         VALUES($1,$2,$3,$4)
         ON CONFLICT(firebase_uid) DO UPDATE SET email=excluded.email,display_name=excluded.display_name,
           is_active=excluded.is_active,updated_at=clock_timestamp() RETURNING id`,
        [input.firebaseUid, input.email, input.displayName, input.active],
      );
      const userId = saved.rows[0].id;
      const validRoles = await client.query(
        `SELECT id::text FROM foliar_fertilizer.app_roles WHERE is_active AND id::text=ANY($1::text[])`,
        [input.roleIds],
      );
      if (validRoles.rowCount !== input.roleIds.length)
        throw new FactoryAuthError("INVALID_REQUEST", 400);
      const admin = await client.query(
        `SELECT r.id::text FROM foliar_fertilizer.app_roles r WHERE r.code='factory_admin'`,
      );
      const adminRoleId = admin.rows[0]?.id;
      const removesAdmin = !input.active || !input.roleIds.includes(adminRoleId);
      if (removesAdmin) {
        const remaining = await client.query(
          `SELECT count(DISTINCT u.id)::integer count
             FROM foliar_fertilizer.app_users u
             JOIN foliar_fertilizer.app_user_roles ur ON ur.user_id=u.id
             JOIN foliar_fertilizer.app_roles r ON r.id=ur.role_id
            WHERE u.is_active AND r.code='factory_admin' AND u.id<>$1`,
          [userId],
        );
        const wasAdmin = await client.query(
          `SELECT 1 FROM foliar_fertilizer.app_user_roles WHERE user_id=$1 AND role_id=$2`,
          [userId, adminRoleId],
        );
        if (wasAdmin.rowCount && remaining.rows[0].count === 0)
          throw new FactoryAuthError("ACCESS_DENIED", 403);
      }
      await client.query(`DELETE FROM foliar_fertilizer.app_user_roles WHERE user_id=$1`, [userId]);
      await client.query(
        `INSERT INTO foliar_fertilizer.app_user_roles(user_id,role_id)
         SELECT $1,id FROM foliar_fertilizer.app_roles WHERE id::text=ANY($2::text[])`,
        [userId, input.roleIds],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });
}

export async function saveAccessRole(input: {
  id?: string;
  code: string;
  name: string;
  active: boolean;
  moduleKeys: readonly string[];
}): Promise<void> {
  await withClient(async (client) => {
    await client.query("BEGIN");
    try {
      const modules = await client.query(
        `SELECT module_key FROM foliar_fertilizer.app_modules WHERE is_active AND module_key=ANY($1::text[])`,
        [input.moduleKeys],
      );
      if (modules.rowCount !== input.moduleKeys.length)
        throw new FactoryAuthError("INVALID_REQUEST", 400);
      const saved = input.id
        ? await client.query(
            `UPDATE foliar_fertilizer.app_roles SET code=$2,name=$3,is_active=$4,updated_at=clock_timestamp()
             WHERE id=$1 AND NOT is_system RETURNING id`,
            [input.id, input.code, input.name, input.active],
          )
        : await client.query(
            `INSERT INTO foliar_fertilizer.app_roles(code,name,is_active) VALUES($1,$2,$3) RETURNING id`,
            [input.code, input.name, input.active],
          );
      if (!saved.rowCount) throw new FactoryAuthError("ACCESS_DENIED", 403);
      const roleId = saved.rows[0].id;
      await client.query(`DELETE FROM foliar_fertilizer.app_role_modules WHERE role_id=$1`, [roleId]);
      await client.query(
        `INSERT INTO foliar_fertilizer.app_role_modules(role_id,module_key)
         SELECT $1,module_key FROM foliar_fertilizer.app_modules WHERE module_key=ANY($2::text[])`,
        [roleId, input.moduleKeys],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });
}
