import { PREditPage } from "@/src/features/purchase-requisitions/pr-edit-page";
import { LoadingState } from "@/src/components/factory/patterns";
import { Suspense } from "react";
import { requireAuthenticatedFactoryModule } from "@/src/server/auth/server-auth";
type Props = { params: Promise<{ prId: string }> };
async function Content({ params }: Props) {
  await requireAuthenticatedFactoryModule("pr");
  const { prId } = await params;
  return <PREditPage key={prId} id={prId} />;
}
export default function Page(props: Props) {
  return (
    <Suspense fallback={<LoadingState />}>
      <Content {...props} />
    </Suspense>
  );
}
