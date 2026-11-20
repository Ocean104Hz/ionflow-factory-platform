
import { OrganicExtractionTemperatureWorkspace } from "@/src/features/organic_extraction_temperature/organic_extraction_temperature_workspace";
import { demoOrganicExtractionTemperatureSheets } from "@/src/lib/mock-data/organic-extraction-temperature";

export default function Page() {
  return (
    <OrganicExtractionTemperatureWorkspace
      initialRecords={demoOrganicExtractionTemperatureSheets}
    />
  );
}
