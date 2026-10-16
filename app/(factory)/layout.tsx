import { Suspense } from "react";
import { AppShell } from "@/src/components/factory/app-shell";
import { DemoProvider } from "@/src/components/factory/demo-provider";
import { PRProvider } from "@/src/features/purchase-requisitions/pr-provider";
import { BOMProvider } from "@/src/features/bom/bom-provider";
import { MixingProvider } from "@/src/features/fertilizer-powder-mixing/mixing-provider";
import { LoadingState } from "@/src/components/factory/patterns";
import { MasterDataProvider } from "@/src/features/master-data/master-provider";

export default function FactoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MasterDataProvider>
      <MixingProvider>
        <DemoProvider>
          <PRProvider>
            <BOMProvider>
              <Suspense fallback={<LoadingState />}>
                <AppShell>{children}</AppShell>
              </Suspense>
            </BOMProvider>
          </PRProvider>
        </DemoProvider>
      </MixingProvider>
    </MasterDataProvider>
  );
}
