import { BOMProvider } from "@/src/features/bom/bom-provider";
import { BOMList } from "@/src/features/bom/bom-list";
export default function Page() {
  return (
    <BOMProvider>
      <BOMList />
    </BOMProvider>
  );
}
