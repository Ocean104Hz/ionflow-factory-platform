import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("migration creates the identity access model without local credentials", () => {
  const sql = read("migrations/0001_foliar_fertilizer_access.up.sql");
  for (const table of [
    "app_users",
    "app_roles",
    "app_modules",
    "app_user_roles",
    "app_role_modules",
  ])
    assert.match(sql, new RegExp(`CREATE TABLE foliar_fertilizer\\.${table}`));
  assert.doesNotMatch(sql, /password|local_credentials|factory_sessions/i);
  assert.match(sql, /current_database\(\) <> 'production'/);
  assert.match(sql, /current_user <> 'foliar_fertilizer_owner'/);
});

test("every implemented sidebar route has a seeded module", () => {
  const navigation = read("src/lib/constants/navigation.ts");
  const sql = read("migrations/0001_foliar_fertilizer_access.up.sql");
  const hrefs = [...navigation.matchAll(/href:\s*"(\/[a-z0-9_/-]+)"/g)].map(
    (match) => match[1],
  );
  const seededHrefs = new Set(
    [...sql.matchAll(/\('[a-z][a-z0-9_]+','[^']+','[^']+','(\/[a-z0-9_/-]+)',\d+\)/g)].map(
      (match) => match[1],
    ),
  );
  assert.equal(new Set(hrefs).size, 43);
  assert.deepEqual([...new Set(hrefs)].filter((href) => !seededHrefs.has(href)), []);
});

test("runtime source has no development bypass or local password repository", () => {
  const source = [
    "src/server/auth/auth-service.ts",
    "src/server/auth/server-auth.ts",
    "src/server/auth/auth-http.ts",
    "app/api/auth/login/route.ts",
    ".env.example",
  ].map(read).join("\n");
  assert.doesNotMatch(source, /FACTORY_DEV_AUTH|loginWithLocalPassword|factory_local_credentials/);
  assert.match(source, /verifyFirebaseIdToken/);
  assert.match(source, /HttpOnly|httpOnly/);
});
