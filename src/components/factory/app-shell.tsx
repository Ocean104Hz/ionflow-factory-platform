"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  useSyncExternalStore,
  type ReactNode,
  type CSSProperties,
  useState,
} from "react";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../ui/breadcrumb";
import { Archive, Bell, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Factory, FlaskConical, Package, Receipt, ShoppingCart, X, type LucideIcon } from "lucide-react";
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
import { FactoryFooter } from "./patterns";
import {
  navigation,
  navigationGroups,
  isNavigationActive,
  navigationModuleKey,
} from "@/src/lib/constants/navigation";
import { Alert, AlertDescription } from "../ui/alert";

type CurrentUser = Readonly<{
  displayName: string;
  email: string;
  roles: readonly string[];
  modules: readonly string[];
}>;

const SIDEBAR_STORAGE_KEY = "ionflow.sidebar.open";
const SIDEBAR_CHANGE_EVENT = "ionflow.sidebar.change";

let sidebarMemoryValue: boolean | null = null;

function getSidebarOpenSnapshot(): boolean {
  if (sidebarMemoryValue !== null) return sidebarMemoryValue;

  try {
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
}

function getServerSidebarOpenSnapshot(): boolean {
  return true;
}

function subscribeSidebarOpen(onChange: () => void): () => void {
  const handleStorageChange = (event: StorageEvent): void => {
    if (event.key !== SIDEBAR_STORAGE_KEY && event.key !== null) {
      return;
    }

    sidebarMemoryValue = null;
    onChange();
  };

  window.addEventListener("storage", handleStorageChange);
  window.addEventListener(SIDEBAR_CHANGE_EVENT, onChange);

  return () => {
    window.removeEventListener("storage", handleStorageChange);
    window.removeEventListener(SIDEBAR_CHANGE_EVENT, onChange);
  };
}

function updateSidebarOpen(value: boolean): void {
  sidebarMemoryValue = value;

  try {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(value));
    sidebarMemoryValue = null;
  } catch {
    sidebarMemoryValue = value;
  }

  window.dispatchEvent(new Event(SIDEBAR_CHANGE_EVENT));
}

export function AppShell({
  children,
  currentUser,
}: {
  children: ReactNode;
  currentUser: CurrentUser;
}) {
  const sidebarOpen = useSyncExternalStore(
    subscribeSidebarOpen,
    getSidebarOpenSnapshot,
    getServerSidebarOpenSnapshot,
  );

  return (
    <SidebarProvider
      open={sidebarOpen}
      onOpenChange={updateSidebarOpen}
      style={{ "--sidebar-width": "18rem", "--sidebar-width-icon": "5rem" } as CSSProperties}
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
  const isSettingsPage = pathname === "/settings";
  const current = navigation.find(
    (item) =>
      !item.alias && item.href && isNavigationActive(pathname, item.href),
  );
  const [previewMenu, setPreviewMenu] = useState("");
  return (
    <>
      <a
        href="#main-content"
        className="sr-only z-100 rounded bg-surface p-3 focus:not-sr-only focus:fixed"
      >
        ข้ามไปเนื้อหา
      </a>
      <AppSidebar currentUser={currentUser} onPreview={setPreviewMenu} />
      <SidebarInset className="min-w-0 bg-background">
        <SiteHeader
          currentUser={currentUser}
          standaloneTitle={pathname === "/qc_raw_material"}
          title={
            pathname === "/qc_raw_material"
              ? "ใบตรวจสอบคุณภาพวัตถุดิบ"
              : pathname.startsWith("/settings")
              ? "ตั้งค่า"
              : (current?.title ?? branding.factoryName)
          }
        />
        <div
          id="main-content"
          className={`factory-content @container/main mx-auto w-full max-w-none space-y-5 px-4 py-5 ${isSettingsPage ? "lg:p-0" : ""}`}
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
          {!isSettingsPage && <FactoryFooter live={current?.group === "ORGANIC" || current?.group === "PACKING" || ["/production-orders", "/delivery-orders", "/invoices", "/products", "/audit_log", "/qc-organic-fertilizer", "/nc-reports", "/sample-submissions", "/sample-submission-log", "/lab_sample_receiving", "/qc_product_weight_check", "/raw-material-receiving", "/material-requisitions", "/material-issues"].some(path => pathname === path || pathname.startsWith(`${path}/`))} />}
        </div>
      </SidebarInset>
    </>
  );
}
// Match the i-Tech section icons without changing Factory navigation or permissions.
const ITECH_SECTION_ICONS: Readonly<Partial<Record<string, LucideIcon>>> = {
  PURCHASING: ShoppingCart,
  QC: FlaskConical,
  WAREHOUSE: Package,
  PRODUCTION: Factory,
  PACKING: Archive,
  LOGISTICS: Receipt,
  "SALES DOCUMENTS": Receipt,
};

function AppSidebar({
  currentUser,
  onPreview,
}: {
  currentUser: CurrentUser;
  onPreview: (title: string) => void;
}) {
  const pathname = usePathname();
  const { branding } = useBranding();
  const { state, isMobile, setOpenMobile, toggleSidebar } = useSidebar();
  const compact = !isMobile && state === "collapsed";
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  function toggleGroup(key: string) {
    setCollapsedGroups((previous) => ({
      ...previous,
      [key]: !(previous[key] ?? false),
    }));
  }
  function menu(group: string) {
    return (
      <SidebarMenu>
        {navigation
          .filter(
            (item) =>
              item.group === group &&
              item.href &&
              currentUser.modules.includes(navigationModuleKey(item.href)),
          )
          .map((item) => (
            <SidebarMenuItem key={item.title}>
              {item.href ? (
                <SidebarMenuButton
                  asChild
                  isActive={
                    !item.alias && isNavigationActive(pathname, item.href)
                  }
                  tooltip={compact ? { children: item.title, className: "factory-itech-tooltip", sideOffset: 10 } : undefined}
                  appearance="factory-itech"
                  className="factory-itech-nav-item"
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
                    {!compact && <span className="factory-itech-nav-label">{item.title}</span>}
                  </Link>
                </SidebarMenuButton>
              ) : null}
            </SidebarMenuItem>
          ))}
      </SidebarMenu>
    );
  }

  return (
    <Sidebar
      id="factory-sidebar"
      collapsible="icon"
      className="factory-sidebar factory-sidebar-itech no-print"
      mobileClassName="factory-sidebar factory-sidebar-itech no-print"
    >
      {!isMobile && (
        <button
          type="button"
          className="factory-itech-edge-toggle"
          onClick={toggleSidebar}
          aria-controls="factory-sidebar"
          aria-expanded={!compact}
          aria-label={compact ? "ขยายแถบเมนู" : "ยุบแถบเมนู"}
          title={compact ? "ขยายแถบเมนู" : "ยุบแถบเมนู"}
        >
          {compact ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
        </button>
      )}
      <SidebarHeader className="factory-itech-brand">
        <Link
          href="/dashboard"
          aria-label={branding.factoryName}
          className="factory-itech-brand-link"
          onClick={() => setOpenMobile(false)}
        >
          <FactoryLogo compact={compact} />
        </Link>
        {isMobile && (
          <Button
            variant="ghost"
            size="icon"
            aria-label="ปิดเมนู"
            className="factory-itech-mobile-close"
            onClick={() => setOpenMobile(false)}
          >
            <X />
          </Button>
        )}
      </SidebarHeader>
      <SidebarContent className="factory-itech-scroll group-data-[collapsible=icon]:overflow-y-auto">
        <nav aria-label="เมนูโรงงาน">
          {navigationGroups.filter((group) => group.key !== "MAINTENANCE").map((group) => {
            const visible = navigation.some(
              (item) => item.group === group.key && item.href &&
                currentUser.modules.includes(navigationModuleKey(item.href)),
            );
            if (!visible) return null;
            if (group.key === "OVERVIEW") {
              return (
                <div key={group.key} className="factory-itech-overview-links">
                  {menu(group.key)}
                  {!compact && <div aria-hidden="true" className="factory-itech-overview-divider" />}
                </div>
              );
            }
            const GroupIcon = ITECH_SECTION_ICONS[group.key] ?? navigation.find((item) => item.group === group.key)?.icon;
            const isCollapsed = collapsedGroups[group.key] ?? false;
            const contentId = `factory-sidebar-group-${group.key.toLowerCase().replaceAll(" ", "-")}`;
            return (
              <SidebarGroup key={group.key} className="factory-itech-group">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <SidebarGroupLabel asChild className="factory-itech-group-trigger">
                      <button
                        type="button"
                        aria-label={group.title}
                        aria-expanded={!isCollapsed}
                        aria-controls={contentId}
                        onClick={() => toggleGroup(group.key)}
                      >
                        {GroupIcon && <GroupIcon aria-hidden="true" className="factory-itech-group-icon" />}
                        {!compact && <span className="factory-itech-group-title">{group.title}</span>}
                        {!compact && <ChevronDown aria-hidden="true" className="factory-itech-group-chevron" />}
                      </button>
                    </SidebarGroupLabel>
                  </TooltipTrigger>
                  <TooltipContent side="right" align="center" sideOffset={10} hidden={!compact} className="factory-itech-tooltip">
                    {group.title}
                  </TooltipContent>
                </Tooltip>
                <SidebarGroupContent
                  id={contentId}
                  inert={isCollapsed}
                  aria-hidden={isCollapsed}
                  className="factory-itech-group-content"
                >
                  <div className="factory-itech-group-items">{menu(group.key)}</div>
                </SidebarGroupContent>
              </SidebarGroup>
            );
          })}
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
  standaloneTitle = false,
}: {
  title: string;
  currentUser: CurrentUser;
  standaloneTitle?: boolean;
}) {
  const { branding } = useBranding();
  const router = useRouter();
  const [logoutPending, setLogoutPending] = useState(false);
  const { isMobile, openMobile } = useSidebar();
  return (
    <header className="no-print sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-3 border-b bg-card/95 px-4 backdrop-blur lg:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <SidebarTrigger
          className="md:hidden"
          aria-label={openMobile ? "ปิดเมนู" : "เปิดเมนู"}
          aria-expanded={isMobile && openMobile}
          aria-controls="factory-sidebar"
        />
        <Separator orientation="vertical" className="mx-1 h-4 md:hidden" />
        {standaloneTitle ? (
          <h1 className="min-w-0 truncate text-base font-bold text-[#173b63] sm:text-xl" title={title}>{title}</h1>
        ) : (
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
        )}
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
