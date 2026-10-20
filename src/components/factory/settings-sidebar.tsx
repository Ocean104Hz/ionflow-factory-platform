"use client";

import { useState } from "react";
import {
  Building2,
  ChevronDown,
  Factory,
  Package,
  Truck,
  Users,
  Wrench,
} from "lucide-react";
import {
  masterKinds,
  type MasterKind,
} from "@/src/features/master-data/master-domain";
import { Button } from "../ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../ui/collapsible";

export type SettingsDestination = MasterKind | "users" | "branding";
export const settingsGroups: {
  title: string;
  icon: typeof Users;
  items: SettingsDestination[];
}[] = [
  { title: "ผู้ใช้และสิทธิ์", icon: Users, items: ["users"] },
  {
    title: "องค์กรและพื้นที่",
    icon: Building2,
    items: ["sites", "areas", "warehouses", "departments"],
  },
  {
    title: "การปฏิบัติงาน",
    icon: Wrench,
    items: ["lines", "shifts", "vehicleTypes", "vehicles", "equipment"],
  },
  {
    title: "ข้อมูลสินค้า",
    icon: Package,
    items: ["units", "categories", "brands", "processes"],
  },
  { title: "ผู้ขายภายใน", icon: Truck, items: ["suppliers"] },
  { title: "ตั้งค่าโรงงาน", icon: Factory, items: ["branding"] },
];

export function settingsLabel(destination: SettingsDestination) {
  if (destination === "users") return "ผู้ใช้งาน";
  if (destination === "branding") return "ข้อมูลและแบรนด์โรงงาน";
  return masterKinds[destination];
}

export function SettingsSidebar({
  selected,
  onSelect,
}: {
  selected: SettingsDestination;
  onSelect: (destination: SettingsDestination) => void;
}) {
  const [expanded, setExpanded] = useState<string[]>(
    settingsGroups.map((group) => group.title),
  );
  return (
    <nav aria-label="เมนูตั้งค่า" className="space-y-1 p-2">
      {settingsGroups.map((group) => {
        const active = group.items.includes(selected);
        const open = active || expanded.includes(group.title);
        return (
          <Collapsible
            key={group.title}
            open={open}
            onOpenChange={(value) => {
              setExpanded((previous) =>
                value
                  ? [
                      ...previous.filter((title) => title !== group.title),
                      group.title,
                    ]
                  : previous.filter((title) => title !== group.title),
              );
            }}
          >
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                aria-expanded={open}
                className="h-10 w-full justify-start gap-2 px-3 text-sm font-medium"
              >
                <group.icon
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <span className="flex-1 text-left">{group.title}</span>
                <ChevronDown
                  aria-hidden="true"
                  className={`size-3.5 text-muted-foreground transition-transform duration-[var(--motion-fast)] ease-out motion-reduce:transition-none ${open ? "rotate-0" : "-rotate-90"}`}
                />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="data-[state=open]:animate-in data-[state=open]:fade-in-0 duration-[var(--motion-fast)] ease-out motion-reduce:animate-none">
              <ul className="my-1 ml-5 space-y-0.5 border-l pl-2">
                {group.items.map((destination) => (
                  <li key={destination}>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => onSelect(destination)}
                      aria-current={
                        selected === destination ? "page" : undefined
                      }
                      className={`h-auto min-h-9 w-full justify-start whitespace-normal rounded-md border-l-2 border-transparent px-3 py-2 text-left text-sm font-normal transition-colors duration-[var(--motion-fast)] ease-out motion-reduce:transition-none ${selected === destination ? "border-l-primary bg-primary/10 font-medium text-primary hover:bg-primary/15 hover:text-primary" : "text-muted-foreground"}`}
                    >
                      {settingsLabel(destination)}
                    </Button>
                  </li>
                ))}
              </ul>
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </nav>
  );
}
