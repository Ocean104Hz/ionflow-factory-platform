import { ProductionOrdersProvider } from "@/src/features/production-orders/production-orders-provider";
export default function ProductionLayout({ children }: { children: React.ReactNode }) {
  return <ProductionOrdersProvider>{children}</ProductionOrdersProvider>;
}
