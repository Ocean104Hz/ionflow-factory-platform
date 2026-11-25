import { OrganicExtractionMaterialLedgerWorkspace } from "@/src/features/organic_extraction_material_ledger/organic_extraction_material_ledger_workspace";
import { requireAuthenticatedFactoryModule } from "@/src/server/auth/server-auth";

export default async function Page() {
  await requireAuthenticatedFactoryModule("organic_extraction_material_ledger");
  return <OrganicExtractionMaterialLedgerWorkspace />;
}
