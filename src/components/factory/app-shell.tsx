"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode, type CSSProperties } from "react";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../ui/breadcrumb";
import { Bell, ChevronDown, CircleHelp, X } from "lucide-react";
import { Button } from "../ui/button";
import { Avatar, AvatarFallback } from "../ui/avatar";

import {
  Sidebar,
  SidebarProvider,
  SidebarInset,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "../ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from "../ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { Separator } from "../ui/separator";
import { useBranding } from "./branding-provider";
import { FactoryLogo } from "./factory-logo";
import {
  navigation,
  navigationGroups,
  isNavigationActive,
} from "@/src/lib/constants/navigation";
import { Alert, AlertDescription } from "../ui/alert";

type CurrentUser = Readonly<{
  displayName: string;
  email: string;
  roles: readonly string[];
}>;

export function AppShell({
  children,
  currentUser,
}: {
  children: ReactNode;
  currentUser: CurrentUser;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  useEffect(() => {
    try {
      setSidebarOpen(
        window.localStorage.getItem("ionflow.sidebar.open") !== "false",
      );
    } catch {}
  }, []);
  return (
    <SidebarProvider
      open={sidebarOpen}
      onOpenChange={(value) => {
        setSidebarOpen(value);
        try {
          window.localStorage.setItem("ionflow.sidebar.open", String(value));
        } catch {}
      }}
      style={{ "--sidebar-width-icon": "4rem" } as CSSProperties}
    >
      <FactoryShell currentUser={currentUser}>{children}</FactoryShell>
    </SidebarProvider>
  );
}

function FactoryShell({
  children,
  currentUser,
}: {
  children: ReactNode;
  currentUser: CurrentUser;
}) {
  const pathname = usePathname();
  const { branding } = useBranding();
  const current = navigation.find(
    (item) =>
      !item.alias && item.href && isNavigationActive(pathname, item.href),
  );
  const [previewMenu, setPreviewMenu] = useState("");
  return (
    <>
      <a
        href="#main-content"
        className="sr-only z-[100] rounded bg-surface p-3 focus:not-sr-only focus:fixed"
      >
        ข้ามไปเนื้อหา
      </a>
      <AppSidebar currentUser={currentUser} onPreview={setPreviewMenu} />
      <SidebarInset className="min-w-0 bg-background">
        <SiteHeader
          currentUser={currentUser}
          title={
            pathname.startsWith("/settings")
              ? "ตั้งค่า"
              : (current?.title ?? branding.factoryName)
          }
        />
        <div
          id="main-content"
          className="factory-content @container/main mx-auto w-full max-w-[1680px] space-y-5 px-4 py-5 lg:px-6"
        >
          {previewMenu && (
            <Alert role="status">
              <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {previewMenu} · เพิ่มชื่อเมนูแล้ว แต่ยังไม่มีหน้าสาธิตใน
                  Factory Platform
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setPreviewMenu("")}
                >
                  ปิดข้อความ
                </Button>
              </AlertDescription>
            </Alert>
          )}
          {children}
          <footer className="no-print flex flex-wrap justify-between gap-2 pt-4 text-[10px] tracking-wide text-muted-foreground">
            <span>{branding.shortName} FACTORY · UI STANDARD / 01</span>
            <span>ข้อมูลสมมติเท่านั้น · ไม่ใช้เป็นเอกสารทางธุรกิจ</span>
          </footer>
        </div>
      </SidebarInset>
    </>
  );
}
function AppSidebar({
  currentUser,
  onPreview,
}: {
  currentUser: CurrentUser;
  onPreview: (title: string) => void;
}) {
  const pathname = usePathname();
  const { branding } = useBranding();
  const { state, isMobile, setOpenMobile } = useSidebar();
  const compact = !isMobile && state === "collapsed";
  function menu(group: string) {
    return (
      <SidebarMenu>
        {navigation
          .filter((item) => item.group === group)
          .map((item) => (
            <SidebarMenuItem key={item.title}>
              {item.href ? (
                <SidebarMenuButton
                  asChild
                  isActive={
                    !item.alias && isNavigationActive(pathname, item.href)
                  }
                  tooltip={item.title}
                  className="h-9"
                  aria-label={item.title}
                >
                  <Link
                    href={item.href}
                    onClick={() => {
                      onPreview("");
                      setOpenMobile(false);
                    }}
                    aria-current={
                      !item.alias && isNavigationActive(pathname, item.href)
                        ? "page"
                        : undefined
                    }
                  >
                    <item.icon aria-hidden="true" />
                    {!compact && <span>{item.title}</span>}
                  </Link>
                </SidebarMenuButton>
              ) : (
                <SidebarMenuButton
                  tooltip={`${item.title} · ยังไม่มีหน้าสาธิต`}
                  aria-label={`${item.title} · ยังไม่มีหน้าสาธิต`}
                  className="h-9"
                  onClick={() => {
                    onPreview(item.title);
                    setOpenMobile(false);
                  }}
                >
                  <item.icon aria-hidden="true" />
                  {!compact && (
                    <>
                      <span
                        title={item.title}
                        className="min-w-0 flex-1 truncate text-muted-foreground"
                      >
                        {item.title}
                      </span>
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        เร็วๆนี้
                      </span>
                    </>
                  )}
                </SidebarMenuButton>
              )}
            </SidebarMenuItem>
          ))}
      </SidebarMenu>
    );
  }

  return (
    <Sidebar
      id="factory-sidebar"
      collapsible="icon"
      className="factory-sidebar no-print"
    >
      <SidebarHeader className="px-3 py-5">
        <Link
          href="/dashboard"
          aria-label={branding.factoryName}
          onClick={() => setOpenMobile(false)}
        >
          <FactoryLogo compact={compact} />
        </Link>
        {isMobile && (
          <Button
            variant="ghost"
            size="icon"
            aria-label="ปิดเมนู"
            onClick={() => setOpenMobile(false)}
          >
            <X />
          </Button>
        )}
      </SidebarHeader>
      <SidebarSeparator />
      <SidebarContent className="group-data-[collapsible=icon]:overflow-y-auto">
        <nav aria-label="เมนูโรงงาน">
          {navigationGroups.map((group) => (
            <SidebarGroup key={group.key}>
              {!compact && (
                <SidebarGroupLabel className="text-[11px] tracking-wide text-muted-foreground">
                  {group.title}
                </SidebarGroupLabel>
              )}
              <SidebarGroupContent>{menu(group.key)}</SidebarGroupContent>
            </SidebarGroup>
          ))}
        </nav>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-3">
        <div className="flex min-w-0 items-center gap-2 rounded-lg bg-sidebar-accent/40 p-2">
          <Avatar className="size-8 shrink-0">
            <AvatarFallback className="bg-accent text-primary text-xs">
              {branding.shortName.slice(0, 2)}
            </AvatarFallback>
          </Avatar>

          {!compact && (
            <div className="min-w-0">
              <p className="truncate text-xs font-medium">
                {currentUser.displayName}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {currentUser.email}
              </p>
            </div>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
function SiteHeader({
  title,
  currentUser,
}: {
  title: string;
  currentUser: CurrentUser;
}) {
  const { branding } = useBranding();
  const router = useRouter();
  const [logoutPending, setLogoutPending] = useState(false);
  const { state, isMobile, openMobile } = useSidebar();
  const compact = !isMobile && state === "collapsed";
  return (
    <header className="no-print sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-3 border-b bg-card/95 px-4 backdrop-blur lg:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <SidebarTrigger
          aria-label={
            isMobile ? "เปิดเมนู" : compact ? "ขยาย sidebar" : "ยุบ sidebar"
          }
          aria-expanded={isMobile ? openMobile : !compact}
          aria-controls="factory-sidebar"
        />
        <Separator orientation="vertical" className="mx-1 h-4" />
        <Breadcrumb>
          <BreadcrumbList className="flex-nowrap text-sm">
            <BreadcrumbItem className="hidden sm:block">
              <BreadcrumbLink asChild>
                <Link href="/dashboard">Factory</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="hidden sm:block" />
            <BreadcrumbItem>
              <BreadcrumbPage>{title}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="ข้อมูล demo"
              className="hidden sm:inline-flex"
            >
              <CircleHelp />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            ข้อมูลธุรกิจจะคืนค่าเมื่อโหลดใหม่ · branding บันทึกในเบราว์เซอร์
          </TooltipContent>
        </Tooltip>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="การแจ้งเตือนตัวอย่าง"
            >
              <Bell />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuLabel>การแจ้งเตือน · ข้อมูลสมมติ</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <p className="p-3 text-sm text-muted-foreground">
              มีคำสั่งรออนุมัติในหน้าคำสั่งการผลิต
            </p>
          </DropdownMenuContent>
        </DropdownMenu>
        <Separator orientation="vertical" className="h-7" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              aria-label="เมนูผู้ใช้งาน"
              className="h-auto gap-2 p-1"
            >
              <Avatar className="size-9">
                <AvatarFallback className="bg-accent text-primary text-xs font-semibold">
                  {branding.shortName.slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <span className="hidden text-left sm:block">
                <span className="block text-xs font-semibold">
                  {currentUser.displayName}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {currentUser.roles.join(", ") || currentUser.email}
                </span>
              </span>
              <ChevronDown className="size-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{currentUser.email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={logoutPending}
              onSelect={async (event) => {
                event.preventDefault();
                setLogoutPending(true);
                try {
                  const csrfToken = document.cookie
                    .split("; ")
                    .find((part) => part.startsWith("ionflow_factory_csrf="))
                    ?.slice("ionflow_factory_csrf=".length);
                  if (!csrfToken) return;
                  const response = await fetch("/api/auth/logout", {
                    method: "POST",
                    credentials: "same-origin",
                    headers: { "x-csrf-token": decodeURIComponent(csrfToken) },
                  });
                  if (response.ok) {
                    router.replace("/login");
                    router.refresh();
                  }
                } finally {
                  setLogoutPending(false);
                }
              }}
            >
              {logoutPending ? "กำลังออกจากระบบ…" : "ออกจากระบบ"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
