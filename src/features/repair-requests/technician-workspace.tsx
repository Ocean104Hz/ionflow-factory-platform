"use client";

import Link from "next/link";
import { useState } from "react";
import { useRepairs } from "./repair-store";
import type { Repair } from "./repair-domain";
import {
  Button,
  MaintenanceHeader,
  Metrics,
  PriorityBadge,
  RepairBadge,
  SectionCard,
  SelectField,
  useEquipment,
  useTechnicians,
} from "./repair-ui";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/components/ui/table";

const activeStatuses = ["ASSIGNED", "IN_PROGRESS", "WAITING_PARTS", "PENDING_INSPECTION"];

function WorkTable({
  requests,
  equipmentName,
  action,
  empty,
}: {
  requests: Repair[];
  equipmentName: (id: string) => string;
  action: (request: Repair) => React.ReactNode;
  empty: string;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>เลขที่</TableHead>
          <TableHead>อุปกรณ์ / อาการเสีย</TableHead>
          <TableHead>ความเร่งด่วน</TableHead>
          <TableHead>ผู้รับผิดชอบ</TableHead>
          <TableHead>สถานะ</TableHead>
          <TableHead>ดำเนินการ</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {requests.map(request => (
          <TableRow key={request.id}>
            <TableCell>
              <Link className="font-medium text-primary underline-offset-4 hover:underline" href={`/repair-requests/${request.id}`}>
                {request.number}
              </Link>
              <p className="text-xs text-muted-foreground">{request.requestDate}</p>
            </TableCell>
            <TableCell className="max-w-80 whitespace-normal">
              <p className="font-medium">{equipmentName(request.equipmentId)}</p>
              <p className="break-words text-sm text-muted-foreground">{request.title}</p>
            </TableCell>
            <TableCell><PriorityBadge priority={request.priority} /></TableCell>
            <TableCell>{request.technician || "ยังไม่มอบหมาย"}</TableCell>
            <TableCell><RepairBadge status={request.status} /></TableCell>
            <TableCell>{action(request)}</TableCell>
          </TableRow>
        ))}
        {!requests.length && (
          <TableRow>
            <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">{empty}</TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}

export function TechnicianWorkspace() {
  const store = useRepairs();
  const equipment = useEquipment();
  const technicians = useTechnicians();
  const [technicianId, setTechnicianId] = useState(technicians[0]?.id ?? "");
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const selected = technicians.find(value => value.id === technicianId) ?? technicians[0];
  const queue = store.requests.filter(request => ["SUBMITTED", "PENDING_ASSIGNMENT"].includes(request.status));
  const myWork = selected
    ? store.requests.filter(request => request.technician === selected.name && activeStatuses.includes(request.status))
    : [];
  const names = technicians.map(value => value.name);
  const equipmentName = (id: string) => equipment.find(value => value.id === id)?.name ?? "ไม่พบอุปกรณ์";

  function run(message: string, work: () => void) {
    try {
      work();
      setError("");
      setFeedback(message);
    } catch (cause) {
      setFeedback("");
      setError(cause instanceof Error ? cause.message : "ดำเนินการไม่สำเร็จ");
    }
  }

  function queueAction(request: Repair) {
    if (request.status === "SUBMITTED") {
      return <Button size="sm" onClick={() => run("ส่งงานเข้าคิวมอบหมายแล้ว", () => store.change(request.id, "PENDING_ASSIGNMENT"))}>ส่งเข้าคิว</Button>;
    }
    return (
      <Button
        size="sm"
        disabled={!selected}
        onClick={() => selected && run(`มอบหมายให้ ${selected.name} แล้ว`, () => store.assign(request.id, selected.name, names))}
      >
        มอบหมายให้ช่างที่เลือก
      </Button>
    );
  }

  function technicianAction(request: Repair) {
    if (request.status === "ASSIGNED" && !request.acceptedAt) {
      return <Button size="sm" onClick={() => run("รับงานแล้ว", () => store.accept(request.id))}>รับงาน</Button>;
    }
    if (request.status === "ASSIGNED") {
      return <Button size="sm" onClick={() => run("เริ่มงานซ่อมแล้ว", () => store.change(request.id, "IN_PROGRESS"))}>เริ่มซ่อม</Button>;
    }
    if (request.status === "WAITING_PARTS") {
      return <Button size="sm" onClick={() => run("กลับมาดำเนินงานซ่อมแล้ว", () => store.change(request.id, "IN_PROGRESS"))}>กลับมาซ่อม</Button>;
    }
    return <Button size="sm" variant="outline" asChild><Link href={`/repair-requests/${request.id}`}>{request.status === "IN_PROGRESS" ? "บันทึกผลซ่อม" : "ดูรายละเอียด"}</Link></Button>;
  }

  if (!technicians.length) {
    return (
      <div className="space-y-5">
        <MaintenanceHeader title="งานของช่าง" description="คิวงานและการดำเนินงานของทีมซ่อมบำรุง" />
        <SectionCard title="ยังไม่มีผู้ซ่อม">
          <p className="text-sm text-muted-foreground">เพิ่มบุคลากรที่เปิดใช้งานและอยู่ในแผนกซ่อมบำรุงก่อนมอบหมายงาน</p>
          <Button className="mt-4" variant="outline" asChild><Link href="/settings">ไปหน้าตั้งค่าบุคลากร</Link></Button>
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-5">
      <MaintenanceHeader title="งานของช่าง" description="มอบหมาย รับงาน และติดตามงานของผู้ซ่อมจากใบแจ้งซ่อมชุดเดียวกัน" />
      <SectionCard title="มุมมองผู้ซ่อม" subtitle="รายชื่อมาจากบุคลากรแผนกซ่อมบำรุงที่เปิดใช้งาน">
        <div className="max-w-md">
          <SelectField
            label="ผู้ซ่อมที่กำลังปฏิบัติงาน"
            value={selected?.id ?? ""}
            onChange={setTechnicianId}
            options={technicians.map(value => ({ value: value.id, label: `${value.name} · ${value.email}` }))}
          />
        </div>
        {feedback && <p role="status" className="mt-3 text-sm text-success">{feedback}</p>}
        {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
      </SectionCard>
      <Metrics items={[
        ["คิวรอมอบหมาย", queue.length],
        ["งานของช่างที่เลือก", myWork.length],
        ["กำลังซ่อม", myWork.filter(value => value.status === "IN_PROGRESS").length],
        ["รออะไหล่ / ตรวจรับ", myWork.filter(value => ["WAITING_PARTS", "PENDING_INSPECTION"].includes(value.status)).length],
      ]} />
      <SectionCard title="คิวงานส่วนกลาง" subtitle="ผู้ประสานงานส่งเข้าคิวและมอบหมายให้ช่างที่เลือก">
        <WorkTable requests={queue} equipmentName={equipmentName} action={queueAction} empty="ไม่มีงานรอมอบหมาย" />
      </SectionCard>
      <SectionCard title={`งานของ ${selected?.name ?? "ผู้ซ่อม"}`} subtitle="รับงานก่อนเริ่มซ่อม และบันทึกผลซ่อมในรายละเอียดใบงาน">
        <WorkTable requests={myWork} equipmentName={equipmentName} action={technicianAction} empty="ช่างที่เลือกยังไม่มีงานเปิด" />
      </SectionCard>
    </div>
  );
}
