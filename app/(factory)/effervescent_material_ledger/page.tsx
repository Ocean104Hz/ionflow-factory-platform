import { EffervescentMaterialLedgerWorkspace } from "@/src/features/effervescent_material_ledger/effervescent_material_ledger_workspace";
import { requireAuthenticatedFactoryModule } from "@/src/server/auth/server-auth";

export default async function Page() {
  await requireAuthenticatedFactoryModule("effervescent_material_ledger");
  return <EffervescentMaterialLedgerWorkspace />;
}
