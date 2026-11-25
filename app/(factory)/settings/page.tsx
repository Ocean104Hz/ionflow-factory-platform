import { SettingsPage } from "@/src/components/factory/settings-page";
import { requireAuthenticatedFactoryRole } from "@/src/server/auth/server-auth";

export default async function Page() {
  await requireAuthenticatedFactoryRole("factory_admin");
  return <SettingsPage />;
}
