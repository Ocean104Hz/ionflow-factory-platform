import { RawMaterialInspections } from "@/src/features/raw-material-inspections/raw-material-inspections";
import { RawMaterialPaperWorkspace } from "@/src/features/raw-material-inspections/raw-material-paper-workspace";
import "@/src/features/raw-material-inspections/paper-theme.css";

export default function Page() {
  return (
    <div className="factory-qc-itech min-w-0">
      <RawMaterialPaperWorkspace>
        <RawMaterialInspections />
      </RawMaterialPaperWorkspace>
    </div>
  );
}
