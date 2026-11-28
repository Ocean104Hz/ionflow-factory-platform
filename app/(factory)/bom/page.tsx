import { Suspense } from "react";
import { BOMList } from "@/src/features/bom/bom-list";
import { requireAuthenticatedFactoryModule } from "@/src/server/auth/server-auth";

async function BOMContent() {
  await requireAuthenticatedFactoryModule("bom");

  return <BOMList />;
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <BOMContent />
    </Suspense>
  );
}