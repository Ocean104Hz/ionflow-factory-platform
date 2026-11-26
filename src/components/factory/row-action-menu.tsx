"use client";

import { useRef, useState, type ComponentProps, type ReactNode } from "react";
import { Eye, Pencil } from "lucide-react";
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
}: {
  children: ReactNode;
  label?: string;
  readOnly?: boolean;
  containsDialog?: boolean;
  triggerId?: string;
}) {
  const [keepMounted, setKeepMounted] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const Icon = readOnly ? Eye : Pencil;

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
        <Button ref={trigger} id={triggerId} type="button" variant="ghost" size="icon" aria-label={label}>
          <Icon aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        ref={menu}
        align="end"
        forceMount={keepMounted ? true : undefined}
        onInteractOutside={(event) => {
          // The mounted layer also sees the toggle click as an outside interaction.
          // Let the trigger handle it once, including when reopening the hidden menu.
          const target = event.target;
          if (target instanceof Node && trigger.current?.contains(target)) {
            event.preventDefault();
          }
        }}
        className="min-w-40 data-[state=closed]:hidden"
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
