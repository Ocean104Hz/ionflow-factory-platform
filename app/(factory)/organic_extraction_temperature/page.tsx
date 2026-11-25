import { OrganicExtractionTemperatureWorkspace } from "@/src/features/organic_extraction_temperature/organic_extraction_temperature_workspace";
import { requireAuthenticatedFactoryModule } from "@/src/server/auth/server-auth";

export default async function Page() {
  await requireAuthenticatedFactoryModule("organic_extraction_temperature");
  return <OrganicExtractionTemperatureWorkspace />;
}
