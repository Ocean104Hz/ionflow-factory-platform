import "server-only";
import { Pool, type PoolClient, type PoolConfig } from "pg";
import { readDatabaseConfig } from "../database/config.ts";
import {
  FactoryAuthError,
  type ActiveMembership,
  type AuthenticatedFactoryUser,
  type FactoryAuthRepository,
  type LocalCredential,
} from "./auth-service.ts";

export type AuthRuntimeConfig = Readonly<{
  host: "localhost" | "127.0.0.1" | "::1";
  port: 5432;
  database: "ionflow_inventory_dev";
  schema: "inventory_sandbox";
  user: "factory_auth_runtime";
  password: string;
  max: number;
  connectionTimeoutMillis: number;
  idleTimeoutMillis: number;
  statementTimeoutMillis: number;
}>;

export function readAuthRuntimeConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): AuthRuntimeConfig {
  if (
    env.NODE_ENV === "production" ||
    env.FACTORY_AUTH_ENABLED !== "true" ||
    env.FACTORY_AUTH_DB_USER !== "factory_auth_runtime" ||
    !env.FACTORY_AUTH_DB_PASSWORD
  )
    throw new FactoryAuthError("AUTH_UNAVAILABLE", 503);
  try {
    const config = readDatabaseConfig({
      ...env,
      FACTORY_DB_ENABLED: "true",
      FACTORY_DB_USER: env.FACTORY_AUTH_DB_USER,
      FACTORY_DB_PASSWORD: env.FACTORY_AUTH_DB_PASSWORD,
    });
    return { ...config, user: "factory_auth_runtime" };
  } catch {
    throw new FactoryAuthError("AUTH_UNAVAILABLE", 503);
  }
}

type AuthPool = Pick<Pool, "connect" | "on" | "end">;

function stringArray(value: unknown): readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? Object.freeze([...value])
    : Object.freeze([]);
}

function siteArray(
  value: unknown,
): readonly Readonly<{ authority: string; id: string }>[] {
  return Array.isArray(value) &&
    value.every(
      (site) =>
        site &&
        typeof site === "object" &&
        typeof site.authority === "string" &&
        typeof site.id === "string",
    )
    ? Object.freeze(
        value.map((site) =>
          Object.freeze({ authority: site.authority, id: site.id }),
        ),
      )
    : Object.freeze([]);
}

export function createPostgresAuthRepository(
  config: AuthRuntimeConfig,
  makePool: (options: PoolConfig) => AuthPool = (options) => new Pool(options),
): FactoryAuthRepository & { close(): Promise<void> } {
  const pool = makePool({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    ssl: false,
    max: config.max,
    connectionTimeoutMillis: config.connectionTimeoutMillis,
    idleTimeoutMillis: config.idleTimeoutMillis,
    statement_timeout: config.statementTimeoutMillis,
    query_timeout: config.statementTimeoutMillis + 1000,
    lock_timeout: config.statementTimeoutMillis,
    application_name: "ionflow-factory-local-auth",
    options: "-c search_path=pg_catalog",
  });
  pool.on("error", () => console.error("FACTORY_AUTH_IDLE_CONNECTION_FAILED"));

  async function transaction<T>(
    write: boolean,
    work: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    let client: PoolClient;
    try {
      client = await pool.connect();
    } catch {
      throw new FactoryAuthError("AUTH_UNAVAILABLE", 503);
    }
    let broken = false;
    try {
      await client.query(write ? "BEGIN" : "BEGIN READ ONLY");
      const identity = await client.query(
        `SELECT current_database()=$1
          AND current_user=$2
          AND inet_server_port()=5432
          AND inet_server_addr() IN ('127.0.0.1'::inet,'::1'::inet)
          AND NOT r.rolsuper
          AND NOT r.rolcreatedb
          AND NOT r.rolcreaterole
          AND NOT r.rolreplication
          AND NOT r.rolbypassrls
          AND NOT EXISTS (
            SELECT 1 FROM pg_catalog.pg_roles inherited
            WHERE inherited.oid<>r.oid
              AND inherited.rolname<>'pg_database_owner'
              AND pg_catalog.pg_has_role(r.oid,inherited.oid,'MEMBER')
          )
          AND to_regclass('inventory_sandbox.factory_users') IS NOT NULL
          AND to_regclass('inventory_sandbox.factory_local_credentials') IS NOT NULL
          AND to_regclass('inventory_sandbox.factory_memberships') IS NOT NULL
          AND to_regclass('inventory_sandbox.factory_sessions') IS NOT NULL
          AS safe
         FROM pg_catalog.pg_roles r
         WHERE r.rolname=current_user`,
        [config.database, config.user],
      );
      if (identity.rows[0]?.safe !== true)
        throw new FactoryAuthError("AUTH_UNAVAILABLE", 503);
      if (write) await client.query("SELECT pg_advisory_xact_lock(20261021,6)");
      const result = await work(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {
        broken = true;
      }
      if (error instanceof FactoryAuthError) throw error;
      throw new FactoryAuthError("AUTH_UNAVAILABLE", 503);
    } finally {
      client.release(broken);
    }
  }

  return {
    async findLocalCredential(emailNormalized): Promise<LocalCredential | null> {
      return transaction(false, async (client) => {
        const result = await client.query(
          `SELECT u.id AS user_id,u.email,u.display_name,u.is_active,
             c.password_hash,c.hash_algorithm,c.hash_version,
             c.disabled_at IS NOT NULL AS credential_disabled,
             c.revoked_at IS NOT NULL AS credential_revoked
           FROM inventory_sandbox.factory_users u
           JOIN inventory_sandbox.factory_local_credentials c ON c.user_id=u.id
           WHERE u.email_normalized=$1`,
          [emailNormalized],
        );
        const row = result.rows[0];
        return row
          ? {
              userId: row.user_id,
              email: row.email,
              displayName: row.display_name,
              userActive: row.is_active === true,
              passwordHash: row.password_hash,
              hashAlgorithm: row.hash_algorithm,
              hashVersion: row.hash_version,
              credentialDisabled: row.credential_disabled === true,
              credentialRevoked: row.credential_revoked === true,
            }
          : null;
      });
    },

    async findSingleActiveMembership(
      userId,
      now,
    ): Promise<ActiveMembership | null> {
      return transaction(false, async (client) => {
        const result = await client.query(
          `SELECT m.id,m.tenant_authority,m.tenant_id,
             m.organization_authority,m.organization_id,
             COALESCE(jsonb_agg(DISTINCT jsonb_build_object(
               'authority',ms.site_authority,'id',ms.site_id
             )) FILTER (WHERE ms.id IS NOT NULL AND ms.revoked_at IS NULL),'[]') AS sites
           FROM inventory_sandbox.factory_memberships m
           LEFT JOIN inventory_sandbox.factory_membership_sites ms
             ON ms.membership_id=m.id AND ms.revoked_at IS NULL
           WHERE m.user_id=$1 AND m.is_active
             AND (m.expires_at IS NULL OR m.expires_at>$2)
           GROUP BY m.id,m.tenant_authority,m.tenant_id,
             m.organization_authority,m.organization_id
           ORDER BY m.id LIMIT 2`,
          [userId, now],
        );
        if (result.rows.length !== 1) return null;
        const row = result.rows[0];
        return {
          id: row.id,
          tenantAuthority: row.tenant_authority,
          tenantId: row.tenant_id,
          organizationAuthority: row.organization_authority,
          organizationId: row.organization_id,
          sites: siteArray(row.sites),
        };
      });
    },

    async createSession(input): Promise<boolean> {
      return transaction(true, async (client) => {
        const result = await client.query(
          `INSERT INTO inventory_sandbox.factory_sessions(
             id,user_id,membership_id,secret_hash,expires_at,created_at
           )
           SELECT $1,u.id,m.id,$4,$5,$6
           FROM inventory_sandbox.factory_users u
           JOIN inventory_sandbox.factory_local_credentials c ON c.user_id=u.id
           JOIN inventory_sandbox.factory_memberships m
             ON m.id=$3 AND m.user_id=u.id
           WHERE u.id=$2 AND u.is_active
             AND c.disabled_at IS NULL AND c.revoked_at IS NULL
             AND m.is_active AND (m.expires_at IS NULL OR m.expires_at>$6)
           RETURNING id`,
          [
            input.id,
            input.userId,
            input.membershipId,
            input.secretHash,
            input.expiresAt,
            input.now,
          ],
        );
        return result.rows.length === 1;
      });
    },

    async findSession(secretHash, now): Promise<AuthenticatedFactoryUser | null> {
      return transaction(false, async (client) => {
        const result = await client.query(
          `SELECT u.id,u.email,u.display_name,s.id AS session_id,
             s.expires_at,m.id AS membership_id,
             m.tenant_authority,m.tenant_id,
             m.organization_authority,m.organization_id,
             COALESCE(jsonb_agg(DISTINCT jsonb_build_object(
               'authority',ms.site_authority,'id',ms.site_id
             )) FILTER (WHERE ms.id IS NOT NULL AND ms.revoked_at IS NULL),'[]') AS sites,
             COALESCE(array_agg(DISTINCT ms.site_id)
               FILTER (WHERE ms.site_id IS NOT NULL AND ms.revoked_at IS NULL),'{}') AS site_ids,
             COALESCE(array_agg(DISTINCT r.code)
               FILTER (WHERE r.code IS NOT NULL AND mr.revoked_at IS NULL AND r.is_active),'{}') AS roles,
             COALESCE(array_agg(DISTINCT p.code)
               FILTER (WHERE p.code IS NOT NULL AND rp.revoked_at IS NULL AND p.is_active),'{}') AS permissions
           FROM inventory_sandbox.factory_sessions s
           JOIN inventory_sandbox.factory_users u ON u.id=s.user_id
           JOIN inventory_sandbox.factory_memberships m
             ON m.id=s.membership_id AND m.user_id=s.user_id
           LEFT JOIN inventory_sandbox.factory_membership_sites ms
             ON ms.membership_id=m.id AND ms.revoked_at IS NULL
           LEFT JOIN inventory_sandbox.factory_membership_roles mr
             ON mr.membership_id=m.id AND mr.revoked_at IS NULL
           LEFT JOIN inventory_sandbox.factory_roles r
             ON r.id=mr.role_id AND r.is_active
           LEFT JOIN inventory_sandbox.factory_role_permissions rp
             ON rp.role_id=r.id AND rp.revoked_at IS NULL
           LEFT JOIN inventory_sandbox.factory_permissions p
             ON p.code=rp.permission_code AND p.is_active
           WHERE s.secret_hash=$1 AND s.revoked_at IS NULL AND s.expires_at>$2
             AND u.is_active AND m.is_active
             AND (m.expires_at IS NULL OR m.expires_at>$2)
           GROUP BY u.id,u.email,u.display_name,s.id,s.expires_at,
             m.id,m.tenant_authority,m.tenant_id,
             m.organization_authority,m.organization_id`,
          [secretHash, now],
        );
        const row = result.rows[0];
        return row
          ? Object.freeze({
              id: row.id,
              email: row.email,
              displayName: row.display_name,
              sessionId: row.session_id,
              sessionExpiresAt: new Date(row.expires_at).toISOString(),
              membershipId: row.membership_id,
              tenantAuthority: row.tenant_authority,
              tenantId: row.tenant_id,
              organizationAuthority: row.organization_authority,
              organizationId: row.organization_id,
              sites: siteArray(row.sites),
              siteIds: stringArray(row.site_ids),
              roles: stringArray(row.roles),
              permissions: stringArray(row.permissions),
            })
          : null;
      });
    },

    async revokeSession(secretHash, now): Promise<void> {
      await transaction(true, async (client) => {
        await client.query(
          `UPDATE inventory_sandbox.factory_sessions
           SET revoked_at=$2,revocation_reason='USER_LOGOUT'
           WHERE secret_hash=$1 AND revoked_at IS NULL`,
          [secretHash, now],
        );
      });
    },

    close: () => pool.end(),
  };
}

const cache = globalThis as typeof globalThis & {
  factoryAuthRepository?: FactoryAuthRepository & { close(): Promise<void> };
};

export function getFactoryAuthRepository(): FactoryAuthRepository {
  return (cache.factoryAuthRepository ??= createPostgresAuthRepository(
    readAuthRuntimeConfig(),
  ));
}

export async function closeFactoryAuthRepository(): Promise<void> {
  const repository = cache.factoryAuthRepository;
  delete cache.factoryAuthRepository;
  if (repository) await repository.close();
}
