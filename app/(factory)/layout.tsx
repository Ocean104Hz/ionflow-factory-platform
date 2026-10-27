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
import { ProductionFlowProvider } from "@/src/features/production-flow/production-flow-provider";
import { requireAuthenticatedFactoryUser } from "@/src/server/auth/server-auth";

export default function FactoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<LoadingState />}>
      <AuthenticatedFactory>{children}</AuthenticatedFactory>
    </Suspense>
  );
}

async function AuthenticatedFactory({ children }: { children: React.ReactNode }) {
  const user = await requireAuthenticatedFactoryUser();
  return (
    <MasterDataProvider>
      <MixingProvider>
        <DemoProvider>
          <PRProvider>
            <BOMProvider>
              <InventoryOperationsProvider>
                <ProductionFlowProvider>
                  <ProductionQualityProvider>
                    <PackagingProvider>
                      <AppShell
                        currentUser={{
                          displayName: user.displayName,
                          email: user.email,
                          roles: user.roles,
                        }}
                      >
                        {children}
                      </AppShell>
                    </PackagingProvider>
                  </ProductionQualityProvider>
                </ProductionFlowProvider>
              </InventoryOperationsProvider>
            </BOMProvider>
          </PRProvider>
        </DemoProvider>
      </MixingProvider>
    </MasterDataProvider>
  );
}
