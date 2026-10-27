-- PREPARED / NOT APPLIED. Local development authentication foundation only.
-- Independent of business migrations 0002-0004. Execute only after an approved
-- baseline/ledger review; never apply an unrelated business migration to fill a version gap.
BEGIN;

DO $$ BEGIN
  IF current_database() <> 'ionflow_inventory_dev'
     OR inet_server_port() <> 5432
     OR inet_server_addr() IS NULL
     OR inet_server_addr() NOT IN ('127.0.0.1'::inet, '::1'::inet)
     OR to_regnamespace('inventory_sandbox') IS NULL
     OR current_user IN (
       'factory_readonly',
       'factory_settings_writer',
       'factory_production_writer',
       'factory_bulk_writer',
       'factory_auth_runtime'
     ) THEN
    RAISE EXCEPTION 'Factory Auth migration target rejected';
  END IF;
END $$;

CREATE TABLE inventory_sandbox.factory_users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL CHECK (length(btrim(email)) BETWEEN 3 AND 320),
  email_normalized TEXT NOT NULL UNIQUE
    CHECK (email_normalized = lower(btrim(email))),
  display_name TEXT NOT NULL CHECK (length(btrim(display_name)) BETWEEN 1 AND 200),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  deactivated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (
    (is_active AND deactivated_at IS NULL)
    OR (NOT is_active AND deactivated_at IS NOT NULL)
  ),
  CHECK (updated_at >= created_at)
);

CREATE TABLE inventory_sandbox.factory_local_credentials (
  user_id UUID PRIMARY KEY
    REFERENCES inventory_sandbox.factory_users(id) ON DELETE RESTRICT,
  password_hash TEXT NOT NULL CHECK (
    length(password_hash) BETWEEN 80 AND 1024
    AND password_hash ~ '^\$argon2id\$v=19\$m=[0-9]+,t=[0-9]+,p=[0-9]+\$[A-Za-z0-9+/]+={0,2}\$[A-Za-z0-9+/]+={0,2}$'
  ),
  hash_algorithm TEXT NOT NULL CHECK (hash_algorithm = 'argon2id'),
  hash_version SMALLINT NOT NULL CHECK (hash_version = 19),
  password_updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  disabled_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (password_updated_at >= created_at),
  CHECK (revoked_at IS NULL OR revoked_at >= created_at),
  CHECK (disabled_at IS NULL OR disabled_at >= created_at)
);

CREATE TABLE inventory_sandbox.factory_identity_links (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL
    REFERENCES inventory_sandbox.factory_users(id) ON DELETE RESTRICT,
  provider TEXT NOT NULL CHECK (provider ~ '^[a-z][a-z0-9_-]{1,62}$'),
  issuer TEXT NOT NULL CHECK (length(btrim(issuer)) BETWEEN 1 AND 500),
  provider_subject TEXT NOT NULL
    CHECK (length(btrim(provider_subject)) BETWEEN 1 AND 500),
  linked_by_user_id UUID NOT NULL
    REFERENCES inventory_sandbox.factory_users(id) ON DELETE RESTRICT,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMPTZ,
  UNIQUE (provider, issuer, provider_subject),
  CHECK (revoked_at IS NULL OR revoked_at >= linked_at)
);

CREATE TABLE inventory_sandbox.factory_memberships (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL
    REFERENCES inventory_sandbox.factory_users(id) ON DELETE RESTRICT,
  tenant_authority TEXT NOT NULL
    CHECK (length(btrim(tenant_authority)) BETWEEN 1 AND 100),
  tenant_id TEXT NOT NULL CHECK (length(btrim(tenant_id)) BETWEEN 1 AND 200),
  organization_authority TEXT NOT NULL
    CHECK (length(btrim(organization_authority)) BETWEEN 1 AND 100),
  organization_id TEXT NOT NULL
    CHECK (length(btrim(organization_id)) BETWEEN 1 AND 200),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (
    user_id,
    tenant_authority,
    tenant_id,
    organization_authority,
    organization_id
  ),
  UNIQUE (id, user_id),
  CHECK (expires_at IS NULL OR expires_at > created_at),
  CHECK (updated_at >= created_at)
);

CREATE TABLE inventory_sandbox.factory_roles (
  id UUID PRIMARY KEY,
  code TEXT NOT NULL UNIQUE
    CHECK (code ~ '^[a-z][a-z0-9_]{1,62}$'),
  name TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 100),
  description TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (updated_at >= created_at)
);

CREATE TABLE inventory_sandbox.factory_permissions (
  code TEXT PRIMARY KEY
    CHECK (code ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$'),
  description TEXT NOT NULL CHECK (length(btrim(description)) BETWEEN 1 AND 300),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE inventory_sandbox.factory_sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  membership_id UUID NOT NULL,
  secret_hash BYTEA NOT NULL UNIQUE CHECK (octet_length(secret_hash) = 32),
  secret_hash_algorithm TEXT NOT NULL DEFAULT 'sha256'
    CHECK (secret_hash_algorithm = 'sha256'),
  secret_version SMALLINT NOT NULL DEFAULT 1 CHECK (secret_version > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMPTZ NOT NULL,
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revocation_reason TEXT
    CHECK (revocation_reason IS NULL OR revocation_reason ~ '^[A-Z0-9_]{1,64}$'),
  FOREIGN KEY (membership_id, user_id)
    REFERENCES inventory_sandbox.factory_memberships(id, user_id)
    ON DELETE RESTRICT,
  CHECK (expires_at > created_at),
  CHECK (last_used_at IS NULL OR last_used_at >= created_at),
  CHECK (revoked_at IS NULL OR revoked_at >= created_at),
  CHECK ((revoked_at IS NULL) = (revocation_reason IS NULL))
);

CREATE TABLE inventory_sandbox.factory_auth_events (
  id UUID PRIMARY KEY,
  event_type TEXT NOT NULL CHECK (event_type ~ '^[A-Z][A-Z0-9_]{1,63}$'),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actor_kind TEXT NOT NULL
    CHECK (actor_kind IN ('FACTORY_USER', 'TRUSTED_BOOTSTRAP', 'SYSTEM')),
  actor_user_id UUID
    REFERENCES inventory_sandbox.factory_users(id) ON DELETE RESTRICT,
  actor_principal TEXT NOT NULL
    CHECK (actor_principal ~ '^[A-Za-z0-9][A-Za-z0-9:._-]{2,199}$'),
  session_id UUID
    REFERENCES inventory_sandbox.factory_sessions(id) ON DELETE RESTRICT,
  outcome TEXT NOT NULL CHECK (outcome IN ('SUCCESS', 'DENIED', 'ERROR')),
  reason_code TEXT NOT NULL CHECK (reason_code ~ '^[A-Z][A-Z0-9_]{1,63}$'),
  request_id UUID UNIQUE,
  CHECK (
    (actor_kind = 'FACTORY_USER' AND actor_user_id IS NOT NULL)
    OR (actor_kind IN ('TRUSTED_BOOTSTRAP', 'SYSTEM') AND actor_user_id IS NULL)
  )
);

CREATE TABLE inventory_sandbox.factory_role_permissions (
  id UUID PRIMARY KEY,
  role_id UUID NOT NULL
    REFERENCES inventory_sandbox.factory_roles(id) ON DELETE RESTRICT,
  permission_code TEXT NOT NULL
    REFERENCES inventory_sandbox.factory_permissions(code) ON DELETE RESTRICT,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  assigned_event_id UUID NOT NULL
    REFERENCES inventory_sandbox.factory_auth_events(id) ON DELETE RESTRICT,
  revoked_at TIMESTAMPTZ,
  revoked_event_id UUID
    REFERENCES inventory_sandbox.factory_auth_events(id) ON DELETE RESTRICT,
  CHECK (
    (revoked_at IS NULL AND revoked_event_id IS NULL)
    OR (revoked_at IS NOT NULL AND revoked_at >= assigned_at
      AND revoked_event_id IS NOT NULL
      AND revoked_event_id <> assigned_event_id)
  )
);

CREATE TABLE inventory_sandbox.factory_membership_roles (
  id UUID PRIMARY KEY,
  membership_id UUID NOT NULL
    REFERENCES inventory_sandbox.factory_memberships(id) ON DELETE RESTRICT,
  role_id UUID NOT NULL
    REFERENCES inventory_sandbox.factory_roles(id) ON DELETE RESTRICT,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  assigned_event_id UUID NOT NULL
    REFERENCES inventory_sandbox.factory_auth_events(id) ON DELETE RESTRICT,
  revoked_at TIMESTAMPTZ,
  revoked_event_id UUID
    REFERENCES inventory_sandbox.factory_auth_events(id) ON DELETE RESTRICT,
  CHECK (
    (revoked_at IS NULL AND revoked_event_id IS NULL)
    OR (revoked_at IS NOT NULL AND revoked_at >= assigned_at
      AND revoked_event_id IS NOT NULL
      AND revoked_event_id <> assigned_event_id)
  )
);

CREATE TABLE inventory_sandbox.factory_membership_sites (
  id UUID PRIMARY KEY,
  membership_id UUID NOT NULL
    REFERENCES inventory_sandbox.factory_memberships(id) ON DELETE RESTRICT,
  site_authority TEXT NOT NULL
    CHECK (length(btrim(site_authority)) BETWEEN 1 AND 100),
  site_id TEXT NOT NULL CHECK (length(btrim(site_id)) BETWEEN 1 AND 200),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  assigned_event_id UUID NOT NULL
    REFERENCES inventory_sandbox.factory_auth_events(id) ON DELETE RESTRICT,
  revoked_at TIMESTAMPTZ,
  revoked_event_id UUID
    REFERENCES inventory_sandbox.factory_auth_events(id) ON DELETE RESTRICT,
  CHECK (
    (revoked_at IS NULL AND revoked_event_id IS NULL)
    OR (revoked_at IS NOT NULL AND revoked_at >= assigned_at
      AND revoked_event_id IS NOT NULL
      AND revoked_event_id <> assigned_event_id)
  )
);

CREATE INDEX factory_identity_links_user
  ON inventory_sandbox.factory_identity_links(user_id)
  WHERE revoked_at IS NULL;
CREATE INDEX factory_memberships_user_active
  ON inventory_sandbox.factory_memberships(user_id)
  WHERE is_active;
CREATE INDEX factory_memberships_scope
  ON inventory_sandbox.factory_memberships(
    tenant_authority,
    tenant_id,
    organization_authority,
    organization_id
  );
CREATE INDEX factory_role_permissions_permission
  ON inventory_sandbox.factory_role_permissions(permission_code, assigned_at DESC);
CREATE UNIQUE INDEX factory_role_permissions_active
  ON inventory_sandbox.factory_role_permissions(role_id, permission_code)
  WHERE revoked_at IS NULL;
CREATE INDEX factory_membership_roles_role
  ON inventory_sandbox.factory_membership_roles(role_id, assigned_at DESC);
CREATE UNIQUE INDEX factory_membership_roles_active
  ON inventory_sandbox.factory_membership_roles(membership_id, role_id)
  WHERE revoked_at IS NULL;
CREATE INDEX factory_membership_sites_scope
  ON inventory_sandbox.factory_membership_sites(site_authority, site_id, assigned_at DESC);
CREATE UNIQUE INDEX factory_membership_sites_active
  ON inventory_sandbox.factory_membership_sites(
    membership_id,
    site_authority,
    site_id
  ) WHERE revoked_at IS NULL;
CREATE INDEX factory_sessions_user_active
  ON inventory_sandbox.factory_sessions(user_id, expires_at)
  WHERE revoked_at IS NULL;
CREATE INDEX factory_sessions_membership_active
  ON inventory_sandbox.factory_sessions(membership_id, expires_at)
  WHERE revoked_at IS NULL;
CREATE INDEX factory_auth_events_recent
  ON inventory_sandbox.factory_auth_events(occurred_at DESC);
CREATE INDEX factory_auth_events_actor
  ON inventory_sandbox.factory_auth_events(actor_user_id, occurred_at DESC)
  WHERE actor_user_id IS NOT NULL;
CREATE INDEX factory_auth_events_session
  ON inventory_sandbox.factory_auth_events(session_id, occurred_at DESC)
  WHERE session_id IS NOT NULL;
CREATE UNIQUE INDEX factory_auth_single_development_bootstrap
  ON inventory_sandbox.factory_auth_events(event_type)
  WHERE event_type = 'DEVELOPMENT_BOOTSTRAP_COMPLETED' AND outcome = 'SUCCESS';

REVOKE ALL ON TABLE inventory_sandbox.factory_users FROM PUBLIC;
REVOKE ALL ON TABLE inventory_sandbox.factory_local_credentials FROM PUBLIC;
REVOKE ALL ON TABLE inventory_sandbox.factory_identity_links FROM PUBLIC;
REVOKE ALL ON TABLE inventory_sandbox.factory_memberships FROM PUBLIC;
REVOKE ALL ON TABLE inventory_sandbox.factory_roles FROM PUBLIC;
REVOKE ALL ON TABLE inventory_sandbox.factory_permissions FROM PUBLIC;
REVOKE ALL ON TABLE inventory_sandbox.factory_role_permissions FROM PUBLIC;
REVOKE ALL ON TABLE inventory_sandbox.factory_membership_roles FROM PUBLIC;
REVOKE ALL ON TABLE inventory_sandbox.factory_membership_sites FROM PUBLIC;
REVOKE ALL ON TABLE inventory_sandbox.factory_sessions FROM PUBLIC;
REVOKE ALL ON TABLE inventory_sandbox.factory_auth_events FROM PUBLIC;

COMMENT ON TABLE inventory_sandbox.factory_users IS
  'Provider-independent Factory users; not a tenant, organization, site or personnel master';
COMMENT ON TABLE inventory_sandbox.factory_identity_links IS
  'Explicit administrator-managed verified provider identities; never linked by email';
COMMENT ON TABLE inventory_sandbox.factory_sessions IS
  'Revocable server sessions; secret_hash stores SHA-256 of a high-entropy opaque secret only';
COMMENT ON TABLE inventory_sandbox.factory_auth_events IS
  'Authentication audit metadata only; raw credentials, session secrets and complete tokens are forbidden';
COMMENT ON TABLE inventory_sandbox.factory_role_permissions IS
  'Append-only permission assignments; revoke in place and retain assigning/revoking auth events';
COMMENT ON TABLE inventory_sandbox.factory_membership_roles IS
  'Append-only membership role assignments; runtime DELETE is forbidden';
COMMENT ON TABLE inventory_sandbox.factory_membership_sites IS
  'Append-only membership site assignments; scope must be resolved by a trusted server authority';

COMMIT;
