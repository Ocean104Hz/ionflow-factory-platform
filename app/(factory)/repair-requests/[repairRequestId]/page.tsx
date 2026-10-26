import { Suspense } from "react";
import { LoadingState } from "@/src/components/factory/patterns";
import { RepairDetail } from "@/src/features/repair-requests/repair-detail";
type Props={params:Promise<{repairRequestId:string}>};
async function Content({params}:Props) {const {repairRequestId}=await params;return <RepairDetail id={repairRequestId}/>;}
export default function Page(props:Props) {return <Suspense fallback={<LoadingState/>}><Content {...props}/></Suspense>;}
