import { OrganicRawMaterialReceivingWorkspace } from "@/src/features/organic_raw_material_receiving/organic_raw_material_receiving_workspace";
import { requireAuthenticatedFactoryModule } from "@/src/server/auth/server-auth";

export default async function Page() {
  await requireAuthenticatedFactoryModule("organic_raw_material_receiving");
  return <OrganicRawMaterialReceivingWorkspace />;
}
