"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode, CSSProperties } from "react";
import {
  LayoutDashboard,
  ClipboardList,
  Truck,
  ReceiptText,
  Package,
  Settings,
  Bell,
  ChevronDown,
  CircleHelp,
  ShoppingCart,
  Database,
  X,
} from "lucide-react";
import { Button } from "../ui/button";
import { Avatar, AvatarFallback } from "../ui/avatar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../ui/collapsible";
import {
  Sidebar,
  SidebarProvider,
  SidebarInset,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
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
import { BrandingEditor } from "./branding-editor";
import { FactoryLogo } from "./factory-logo";
const navigation = [
  {
    group: "",
    title: "แดชบอร์ด",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    group: "จัดซื้อ",
    title: "คำสั่งการผลิต",
    href: "/production-orders",
    icon: ClipboardList,
  },
  {
    group: "จ่าย",
    title: "ใบส่งสินค้า",
    href: "/delivery-orders",
    icon: Truck,
  },
  {
    group: "จ่าย",
    title: "ใบแจ้งหนี้",
    href: "/invoices",
    icon: ReceiptText,
  },
  {
    group: "ข้อมูลหลัก",
    title: "สินค้าและราคากลาง",
    href: "/products",
    icon: Package,
  },
];
const navigationGroups = [
  { title: "", icon: LayoutDashboard },
  { title: "จัดซื้อ", icon: ShoppingCart },
  { title: "จ่าย", icon: Truck },
  { title: "ข้อมูลหลัก", icon: Database },
];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider
      style={{ "--sidebar-width-icon": "5rem" } as CSSProperties}
    >
      <FactoryShell>{children}</FactoryShell>
    </SidebarProvider>
  );
}
function FactoryShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { branding } = useBranding();
  const { state, isMobile, openMobile, setOpenMobile } = useSidebar();
  const compact = !isMobile && state === "collapsed";
  const current = navigation.find((item) => pathname.startsWith(item.href));
  function menu(group: string) {
    return (
      <SidebarMenu>
        {navigation
          .filter((item) => item.group === group)
          .map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                asChild
                isActive={pathname.startsWith(item.href)}
                tooltip={item.title}
                className="min-h-11"
                aria-label={item.title}
              >
                <Link
                  href={item.href}
                  onClick={() => setOpenMobile(false)}
                  aria-current={
                    pathname.startsWith(item.href) ? "page" : undefined
                  }
                >
                  <item.icon aria-hidden="true" />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
      </SidebarMenu>
    );
  }
  return (
    <>
      <a
        href="#main-content"
        className="sr-only z-[100] rounded bg-surface p-3 focus:not-sr-only focus:fixed"
      >
        ข้ามไปเนื้อหา
      </a>
      <Sidebar
        id="factory-sidebar"
        collapsible="icon"
        className="factory-sidebar no-print"
      >
        <SidebarHeader className="px-4 py-6">
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
        <SidebarContent>
          <nav aria-label="เมนูโรงงาน">
            {navigationGroups.map((group) => (
              <SidebarGroup key={group.title}>
                {!group.title || compact ? (
                  <SidebarGroupContent>{menu(group.title)}</SidebarGroupContent>
                ) : (
                  <Collapsible defaultOpen className="group/factory-group">
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton className="mb-1 min-h-11 font-semibold">
                        <group.icon aria-hidden="true" />
                        <span>{group.title}</span>
                        <ChevronDown
                          aria-hidden="true"
                          className="ml-auto transition-transform group-data-[state=closed]/factory-group:-rotate-90 motion-reduce:transition-none"
                        />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarGroupContent className="ml-3 w-auto border-l border-sidebar-border pl-2">
                        {menu(group.title)}
                      </SidebarGroupContent>
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </SidebarGroup>
            ))}
          </nav>
        </SidebarContent>
        <SidebarFooter className="border-t border-sidebar-border p-3">
          <BrandingEditor
            trigger={
              <Button
                variant="ghost"
                aria-label="ปรับแต่งโรงงาน"
                className="w-full justify-start"
              >
                <Settings />
                {!compact && "ปรับแต่งโรงงาน"}
              </Button>
            }
          />
          {!compact && (
            <div className="factory-demo-panel rounded-lg border p-3">
              <p className="text-xs font-semibold">DEMO WORKSPACE</p>
              <p className="mt-1 text-xs text-muted-foreground">
                ข้อมูลสมมติ · ไม่เชื่อมต่อระบบจริง
              </p>
            </div>
          )}
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="min-w-0">
        <header className="no-print sticky top-0 z-30 flex h-18 items-center justify-between gap-3 border-b bg-surface/95 px-4 backdrop-blur sm:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <SidebarTrigger
              aria-label={
                isMobile ? "เปิดเมนู" : compact ? "ขยาย sidebar" : "ยุบ sidebar"
              }
              aria-expanded={isMobile ? openMobile : !compact}
              aria-controls="factory-sidebar"
            />
            <div className="min-w-0">
              <p className="truncate font-semibold">
                {current?.title ?? branding.factoryName}
              </p>
              <p
                className="mt-1 max-w-60 truncate text-xs text-muted-foreground"
                title={branding.factoryName}
              >
                {branding.factoryName} · {branding.shortName}
              </p>
            </div>
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
                <DropdownMenuLabel>
                  การแจ้งเตือน · ข้อมูลสมมติ
                </DropdownMenuLabel>
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
                  aria-label="เมนูผู้ใช้งานสาธิต"
                  className="h-auto gap-2 p-1"
                >
                  <Avatar className="size-9">
                    <AvatarFallback className="bg-accent text-primary text-xs font-semibold">
                      {branding.shortName.slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden text-left sm:block">
                    <span className="block text-xs font-semibold">
                      ผู้ใช้งานสาธิต
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      Factory administrator
                    </span>
                  </span>
                  <ChevronDown className="size-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>
                  บัญชีสมมติ · ไม่มี authentication
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/login">กลับหน้า Login (demo)</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main
          id="main-content"
          className="factory-content mx-auto w-full max-w-[1680px] space-y-6 px-4 py-7 sm:px-7 lg:px-8 lg:py-8"
        >
          {children}
          <footer className="no-print flex flex-wrap justify-between gap-2 pt-4 text-[10px] tracking-wide text-muted-foreground">
            <span>{branding.shortName} FACTORY · UI STANDARD / 01</span>
            <span>ข้อมูลสมมติเท่านั้น · ไม่ใช้เป็นเอกสารทางธุรกิจ</span>
          </footer>
        </main>
      </SidebarInset>
    </>
  );
}
