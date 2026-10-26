import { Suspense } from "react";
import { LoadingState } from "@/src/components/factory/patterns";
import { EquipmentDetail } from "@/src/features/repair-requests/equipment-workspace";
type Props={params:Promise<{equipmentId:string}>};
async function Content({params}:Props) {const {equipmentId}=await params;return <EquipmentDetail id={equipmentId}/>;}
export default function Page(props:Props) {return <Suspense fallback={<LoadingState/>}><Content {...props}/></Suspense>;}
