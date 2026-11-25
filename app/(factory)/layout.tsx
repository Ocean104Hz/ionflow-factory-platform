import { Suspense } from "react";
import { connection } from "next/server";
import { AppShell } from "@/src/components/factory/app-shell";
import { DemoProvider } from "@/src/components/factory/demo-provider";
import { PRProvider } from "@/src/features/purchase-requisitions/pr-provider";
import { BOMProvider } from "@/src/features/bom/bom-provider";
import { MixingProvider } from "@/src/features/fertilizer-powder-mixing/mixing-provider";
import { LoadingState } from "@/src/components/factory/patterns";
import { MasterDataProvider } from "@/src/features/master-data/master-provider";
import { SettingsPostgresProvider } from "@/src/components/factory/use-settings-postgres";
import { InventoryOperationsProvider } from "@/src/features/inventory/inventory-operations-provider";
import { ProductionQualityProvider } from "@/src/features/production-quality/production-quality-provider";
import { PackagingProvider } from "@/src/features/packaging-reports/packaging-provider";
import { requireAuthenticatedFactoryUser } from "@/src/server/auth/server-auth";

// The layout checks the session before rendering the protected workspace.
export const instant = false;

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

async function AuthenticatedFactory({
  children,
}: {
  children: React.ReactNode;
}) {
  await connection();

  const user = await requireAuthenticatedFactoryUser();
  return (
    <SettingsPostgresProvider>
      <MasterDataProvider>
        <MixingProvider>
          <DemoProvider>
            <PRProvider user={{ id: user.id, displayName: user.displayName, modules: user.modules }}>
              <BOMProvider enabled={user.modules.includes("bom") || user.modules.includes("product_production_orders_v1")}>
                <InventoryOperationsProvider>
                    <ProductionQualityProvider>
                      <PackagingProvider>
                        <AppShell
                          currentUser={{
                            displayName: user.displayName,
                            email: user.email,
                            roles: user.roles,
                            modules: user.modules,
                          }}
                        >
                          {children}
                        </AppShell>
                      </PackagingProvider>
                    </ProductionQualityProvider>
                </InventoryOperationsProvider>
              </BOMProvider>
            </PRProvider>
          </DemoProvider>
        </MixingProvider>
      </MasterDataProvider>
    </SettingsPostgresProvider>
  );
}
