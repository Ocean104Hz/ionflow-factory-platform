"use client";
import Image from "next/image";
import Link from "next/link";
import { Card } from "@/src/components/ui/card";
import { Alert, AlertDescription } from "@/src/components/ui/alert";
import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Palette,
  Factory,
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
import { useBranding } from "@/src/components/factory/branding-provider";

export function Login() {
  const { branding } = useBranding();
  const id = useId();
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      <section className="login-showcase relative hidden flex-col justify-between p-10 lg:flex">
        {branding.loginImageDataUrl && (
          <Image
            src={branding.loginImageDataUrl}
            alt=""
            fill
            unoptimized
            className="pointer-events-none object-cover opacity-15"
          />
        )}
        <FactoryLogo />
        <div className="relative mx-auto w-full max-w-md space-y-5">
          <Factory aria-hidden="true" className="size-12 text-primary" />
          <p className="text-xs tracking-widest text-muted-foreground">
            FACTORY WORKSPACE
          </p>
          <h2 className="text-3xl font-semibold leading-relaxed">
            พื้นที่ทำงานเดียว
            <br />
            สำหรับทุกขั้นตอนของโรงงาน
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {branding.factoryName} · คำสั่งผลิต การส่งสินค้า
            และเอกสารขายในมาตรฐานเดียว
          </p>
          <div className="grid grid-cols-3 gap-4 border-t border-sidebar-border pt-5">
            {["การผลิต", "ขนส่ง", "เอกสาร"].map((label) => (
              <p key={label} className="text-sm font-medium">
                {label}
              </p>
            ))}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {branding.shortName} · UI template · ข้อมูลสมมติเท่านั้น
        </p>
      </section>
      <section className="flex min-w-0 flex-col gap-4 bg-card p-6 md:p-10">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1 lg:hidden">
            <FactoryLogo />
          </div>
          <Button asChild variant="outline" size="sm" className="ml-auto">
            <Link href="/settings">
              <Palette aria-hidden="true" />
              ตั้งค่า
            </Link>
          </Button>
        </div>
        <div className="flex flex-1 items-center justify-center py-8">
          <Card className="login-form-card w-full max-w-sm gap-0 border-0 bg-transparent p-0 shadow-none">
            <div className="mb-6 space-y-2">
              <h1 className="text-2xl font-semibold">เข้าสู่ระบบ</h1>
              <p className="text-sm text-muted-foreground">
                ยินดีต้อนรับสู่ {branding.factoryName}
              </p>
            </div>
            <Alert role="note" className="mb-6 border-info/20 bg-info/5">
              <AlertDescription className="text-xs text-info">
                LOCAL LOGIN · ตรวจสอบบัญชีและ Session ผ่าน PostgreSQL Local
              </AlertDescription>
            </Alert>
            <form
              className="space-y-5"
              onSubmit={async (event) => {
                event.preventDefault();
                const form = event.currentTarget;
                const values = new FormData(form);
                setPending(true);
                setError("");
                try {
                  const response = await fetch("/api/auth/login", {
                    method: "POST",
                    credentials: "same-origin",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      email: values.get("email"),
                      password: values.get("password"),
                    }),
                  });
                  const result = await response.json().catch(() => null);
                  if (!response.ok)
                    throw new Error(
                      result?.message ?? "เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่",
                    );
                  form.reset();
                  setShowPassword(false);
                  router.replace("/dashboard");
                  router.refresh();
                } catch (reason) {
                  setError(
                    reason instanceof Error
                      ? reason.message
                      : "เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่",
                  );
                  const password = form.elements.namedItem("password");
                  if (password instanceof HTMLInputElement) {
                    password.value = "";
                    password.focus();
                  }
                } finally {
                  setPending(false);
                }
              }}
            >
              <div className="space-y-2">
                <Label htmlFor={`${id}-email`}>อีเมล</Label>
                <Input
                  id={`${id}-email`}
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${id}-password`}>รหัสผ่าน</Label>
                <div className="relative">
                  <Input
                    id={`${id}-password`}
                    name="password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
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
                      <DialogTitle>การกู้คืนรหัสผ่าน</DialogTitle>
                      <DialogDescription>
                        Local Login V1 ยังไม่มีระบบกู้คืนรหัสผ่าน
                        กรุณาติดต่อผู้ดูแล Factory เพื่อดำเนินการอย่างปลอดภัย
                      </DialogDescription>
                    </DialogHeader>
                  </DialogContent>
                </Dialog>
              </div>
              {error && (
                <p role="alert" className="text-sm text-danger">
                  {error}
                </p>
              )}
              <Button type="submit" disabled={pending} className="h-11 w-full">
                {pending ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
                <ArrowRight />
              </Button>
            </form>
            <p className="mt-5 text-center text-xs text-muted-foreground">
              Session มีอายุจำกัดและตรวจสอบสิทธิ์จาก Server ทุกครั้ง
            </p>
          </Card>
        </div>
        <footer className="text-center text-xs text-muted-foreground">
          {branding.shortName} · Factory Template · UI only
        </footer>
      </section>
    </main>
  );
}
