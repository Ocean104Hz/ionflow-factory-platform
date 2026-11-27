// NAN_LAB_ITECH_THEME_V1
"use client";

import { useRef, useState, type ComponentProps, type ReactNode } from "react";
import { ChevronDown, Eye, Pencil } from "lucide-react";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

export function RowActionMenu({
  children,
  label = "จัดการรายการ",
  readOnly = false,
  containsDialog = false,
  triggerId,
  appearance = "default",
}: {
  children: ReactNode;
  label?: string;
  readOnly?: boolean;
  containsDialog?: boolean;
  triggerId?: string;
  appearance?: "default" | "itech";
}) {
  const [keepMounted, setKeepMounted] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const Icon = readOnly ? Eye : Pencil;
  const isItech = appearance === "itech";

  return (
    <DropdownMenu modal={false} onOpenChange={(open) => {
      if (open && containsDialog) setKeepMounted(true);
      if (containsDialog) requestAnimationFrame(() => {
        const active = document.activeElement;
        if (open && active === trigger.current) {
          menu.current?.querySelector<HTMLElement>('[role="menuitem"]:not([data-disabled])')?.focus();
        } else if (!open && (active === document.body || menu.current?.contains(active))) {
          trigger.current?.focus();
        }
      });
    }}>
      <DropdownMenuTrigger asChild>
        <Button ref={trigger} id={triggerId} type="button" variant={isItech ? "outline" : "ghost"} size={isItech ? "sm" : "icon"} className={isItech ? "factory-itech-action-trigger" : undefined} aria-label={label}>
          {isItech ? <>จัดการ <ChevronDown className="size-3.5" aria-hidden="true" /></> : <Icon aria-hidden="true" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        ref={menu}
        align="end"
        forceMount={keepMounted ? true : undefined}
        className={isItech ? "factory-itech-action-menu data-[state=closed]:hidden" : "min-w-40 data-[state=closed]:hidden"}
      >
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function RowActionItem({
  disabled,
  children,
  ...props
}: ComponentProps<typeof Button>) {
  return (
    <DropdownMenuItem asChild disabled={disabled}>
      <Button type="button" disabled={disabled} variant="ghost" size="sm" className="w-full justify-start" {...props}>
        {children}
      </Button>
    </DropdownMenuItem>
  );
}
