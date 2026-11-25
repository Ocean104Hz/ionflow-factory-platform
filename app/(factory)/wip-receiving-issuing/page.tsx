import { WipReceivingIssuingWorkspace } from "@/src/features/wip_receiving_issuing/wip_receiving_issuing_workspace";
import { requireAuthenticatedFactoryModule } from "@/src/server/auth/server-auth";

export default async function Page() {
  await requireAuthenticatedFactoryModule("wip_receiving_issuing");
  return <WipReceivingIssuingWorkspace />;
}
