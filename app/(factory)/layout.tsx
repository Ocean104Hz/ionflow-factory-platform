import { Suspense } from "react";
import { AppShell } from "@/src/components/factory/app-shell";
import { DemoProvider } from "@/src/components/factory/demo-provider";
import { PRProvider } from "@/src/features/purchase-requisitions/pr-provider";
import { BOMProvider } from "@/src/features/bom/bom-provider";
import { MixingProvider } from "@/src/features/fertilizer-powder-mixing/mixing-provider";
import { LoadingState } from "@/src/components/factory/patterns";
import { MasterDataProvider } from "@/src/features/master-data/master-provider";
import { InventoryOperationsProvider } from "@/src/features/inventory/inventory-operations-provider";
import { ProductionQualityProvider } from "@/src/features/production-quality/production-quality-provider";
import { PackagingProvider } from "@/src/features/packaging-reports/packaging-provider";

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
              <InventoryOperationsProvider>
                <ProductionQualityProvider>
                  <PackagingProvider>
                    <Suspense fallback={<LoadingState />}>
                      <AppShell>{children}</AppShell>
                    </Suspense>
                  </PackagingProvider>
                </ProductionQualityProvider>
              </InventoryOperationsProvider>
            </BOMProvider>
          </PRProvider>
        </DemoProvider>
      </MixingProvider>
    </MasterDataProvider>
  );
}
