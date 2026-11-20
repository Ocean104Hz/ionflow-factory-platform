import { OrganicExtractionMaterialLedgerWorkspace } from "@/src/features/organic_extraction_material_ledger/organic_extraction_material_ledger_workspace";
import { demoOrganicExtractionMaterialLedgerSheets } from "@/src/lib/mock-data/organic-extraction-material-ledger";

export default function Page() {
  return (
    <OrganicExtractionMaterialLedgerWorkspace
      initialRecords={demoOrganicExtractionMaterialLedgerSheets}
    />
  );
}
