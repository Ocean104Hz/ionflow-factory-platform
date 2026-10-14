import Link from "next/link";
import { Button } from "@/src/components/ui/button";
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-2xl font-semibold">ไม่พบเอกสารสาธิตนี้</h1>
      <p className="text-muted-foreground">
        เลือกเอกสารจากรายการ mock data ที่มีอยู่
      </p>
      <Button asChild>
        <Link href="/dashboard">กลับแดชบอร์ด</Link>
      </Button>
    </main>
  );
}
