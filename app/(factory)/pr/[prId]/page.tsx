import { PRDetail } from "@/src/features/purchase-requisitions/pr-detail";
import { LoadingState } from "@/src/components/factory/patterns";
import { Suspense } from "react";
type Props = { params: Promise<{ prId: string }> };
async function Content({ params }: Props) {
  const { prId } = await params;
  return <PRDetail key={prId} id={prId} />;
}
export default function Page(props: Props) {
  return (
    <Suspense fallback={<LoadingState />}>
      <Content {...props} />
    </Suspense>
  );
}
