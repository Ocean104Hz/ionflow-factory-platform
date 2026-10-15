"use client";
import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/src/components/ui/popover";
import { productTypes, type Master } from "./bom-domain";

export function BOMMaterialPicker({
  masters,
  excluded,
  onSelect,
  label,
}: {
  masters: Master[];
  excluded: string[];
  onSelect: (master: Master) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const available = masters.filter(
    (m) =>
      !excluded.includes(m.id) &&
      `${m.code} ${m.name}`.toLowerCase().includes(search.trim().toLowerCase()),
  );
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline">
          <Plus />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[min(520px,calc(100vw-32px))] space-y-3"
      >
        <Label className="flex items-center gap-2">
          <Search className="size-4" />
          ค้นหาวัสดุ
          <Input
            aria-label={`ค้นหา${label}`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="รหัสหรือชื่อวัสดุ"
          />
        </Label>
        <p className="text-xs text-muted-foreground">
          เลือกข้อมูลหลักเพื่อเติมรหัส ชื่อ และหน่วยอัตโนมัติ
        </p>
        <div className="max-h-72 space-y-1 overflow-y-auto">
          {available.length ? (
            available.map((m) => (
              <Button
                type="button"
                key={m.id}
                variant="ghost"
                className="h-auto w-full justify-between gap-3 py-3 text-left whitespace-normal"
                onClick={() => {
                  onSelect(m);
                  setOpen(false);
                  setSearch("");
                }}
              >
                <span>
                  <span className="block font-medium">
                    {m.code} · {m.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {productTypes[m.type]}
                  </span>
                </span>
                <span className="shrink-0 text-xs">{m.unit}</span>
              </Button>
            ))
          ) : (
            <p className="p-4 text-sm text-muted-foreground">
              ไม่พบวัสดุที่เลือกเพิ่มได้
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
