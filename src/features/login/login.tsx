"use client";
import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  Palette,
  Factory,
  ShieldCheck,
  ClipboardList,
} from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogHeader,
} from "@/src/components/ui/dialog";
import { FactoryLogo } from "@/src/components/factory/factory-logo";
import { BrandingEditor } from "@/src/components/factory/branding-editor";
import { useBranding } from "@/src/components/factory/branding-provider";

export function Login() {
  const { branding } = useBranding();
  const id = useId();
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <main className="grid min-h-dvh lg:grid-cols-[0.95fr_1.05fr]">
      <section className="login-showcase hidden flex-col justify-between gap-10 p-10 lg:flex xl:p-14">
        <FactoryLogo />
        <div className="relative max-w-xl space-y-7">
          <span className="inline-flex items-center gap-2 text-xs font-medium tracking-widest text-muted-foreground">
            FACTORY OPERATIONS / WORKSPACE
          </span>
          <p className="text-4xl font-semibold leading-[1.4] tracking-tight">
            พื้นที่ทำงานเดียว
            <br />
            สำหรับทุกขั้นตอนของโรงงาน
          </p>
          <p className="max-w-lg text-base leading-relaxed text-muted-foreground">
            {branding.factoryName} · จัดการคำสั่งผลิต การส่งสินค้า เอกสารขาย
            และราคากลาง ด้วยมาตรฐาน UI เดียวกัน
          </p>
          <div className="login-preview grid gap-6 p-6">
            {[
              {
                icon: Factory,
                title: "ภาพรวมการผลิต",
                text: "ติดตามคำสั่งและสถานะใน workspace เดียว",
              },
              {
                icon: ClipboardList,
                title: "เอกสารที่เป็นมาตรฐาน",
                text: "ฟอร์มและตารางที่ใช้ร่วมกันทุกโรงงาน",
              },
              {
                icon: ShieldCheck,
                title: "UI สาธิตเท่านั้น",
                text: "ไม่มีการตรวจบัญชีหรือเชื่อมต่อข้อมูลจริง",
              },
            ].map((item) => (
              <div key={item.title} className="flex gap-3">
                <item.icon className="mt-1 size-5 shrink-0" />
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {item.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs">{branding.shortName} · FACTORY UI STANDARD</p>
      </section>
      <section className="login-form-panel flex flex-col justify-between gap-5 p-5 sm:p-8 lg:p-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="lg:hidden">
            <FactoryLogo />
          </div>
          <BrandingEditor
            trigger={
              <Button variant="outline" size="sm" className="ml-auto">
                <Palette />
                ปรับแต่งโรงงาน
              </Button>
            }
          />
        </div>
        <div className="login-form-card mx-auto w-full max-w-lg px-2 py-6 sm:px-9 sm:py-9">
          <span className="mb-5 inline-flex size-11 items-center justify-center rounded-xl bg-accent text-primary">
            <LockKeyhole />
          </span>
          <h1 className="text-3xl font-semibold leading-relaxed tracking-tight">
            เข้าสู่ระบบ
          </h1>
          <p className="mt-3 break-words leading-relaxed text-muted-foreground">
            ยินดีต้อนรับสู่ {branding.factoryName}
          </p>
          <div className="my-6 rounded-lg border border-info/20 bg-info/5 p-3 text-xs leading-relaxed text-info">
            MOCK LOGIN · ใช้ข้อมูลตัวอย่างเท่านั้น ห้ามกรอกรหัสผ่านจริง
            ไม่มีการส่งหรือเก็บข้อมูลบัญชี
          </div>
          <form
            className="space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              e.currentTarget.reset();
              setShowPassword(false);
              startTransition(() => router.push("/dashboard"));
            }}
          >
            <div className="space-y-2">
              <Label htmlFor={`${id}-email`}>อีเมลตัวอย่าง</Label>
              <Input
                id={`${id}-email`}
                name="demo-email"
                type="email"
                required
                defaultValue="demo@example.test"
                autoComplete="off"
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${id}-password`}>รหัสผ่านตัวอย่าง</Label>
              <div className="relative">
                <Input
                  id={`${id}-password`}
                  name="demo-password"
                  type={showPassword ? "text" : "password"}
                  required
                  defaultValue="demo-only"
                  autoComplete="off"
                  className="h-11 pr-12"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1"
                  aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? <EyeOff /> : <Eye />}
                </Button>
              </div>
            </div>
            <div className="flex justify-end">
              <Dialog>
                <DialogTrigger asChild>
                  <Button type="button" variant="link" className="h-auto p-0">
                    ลืมรหัสผ่าน?
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-surface">
                  <DialogHeader>
                    <DialogTitle>การกู้คืนรหัสผ่าน · UI demo</DialogTitle>
                    <DialogDescription>
                      ไม่มีระบบบัญชีจริงใน phase นี้
                      จึงไม่ส่งอีเมลหรือสร้างลิงก์กู้คืน
                      ใช้ข้อมูลตัวอย่างที่ให้ไว้แล้วกดเข้าใช้งาน demo ได้ทันที
                    </DialogDescription>
                  </DialogHeader>
                </DialogContent>
              </Dialog>
            </div>
            <Button type="submit" disabled={pending} className="h-11 w-full">
              {pending ? "กำลังเปิด workspace…" : "เข้าใช้งาน Demo"}
              <ArrowRight />
            </Button>
          </form>
          <p className="mt-5 text-center text-xs leading-relaxed text-muted-foreground">
            หน้า workspace เปิดได้โดยตรง ไม่มี route guard หรือ authentication
          </p>
        </div>
        <footer className="text-center text-xs text-muted-foreground">
          {branding.shortName} · Factory Template · UI only
        </footer>
      </section>
    </main>
  );
}
