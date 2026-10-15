
import { Suspense } from "react";
import { AppShell } from "@/src/components/factory/app-shell";
import { DemoProvider } from "@/src/components/factory/demo-provider";
import { PRProvider } from "@/src/features/purchase-requisitions/pr-provider";
import { LoadingState } from "@/src/components/factory/patterns";

export default function FactoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DemoProvider>
      <PRProvider>
        <Suspense fallback={<LoadingState />}>
          <AppShell>{children}</AppShell>
        </Suspense>
      </PRProvider>
    </DemoProvider>
  );
}
