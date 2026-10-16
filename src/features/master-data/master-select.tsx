"use client";
import { SelectField } from "@/src/components/factory/patterns";
import { choices, type MasterSnapshot } from "./master-domain";
import { useMasterData } from "./master-provider";
export function MasterSelect({
  kind,
  label,
  value,
  onChange,
  reference,
  code = false,
  filter,
  optional = true,
}: {
  kind: MasterSnapshot["kind"];
  label: string;
  value: string;
  reference?: MasterSnapshot;
  onChange: (value: string, ref?: MasterSnapshot) => void;
  code?: boolean;
  filter?: (id: string) => boolean;
  optional?: boolean;
}) {
  const { state } = useMasterData();
  const rows = choices(state, kind).filter((r) => !filter || filter(r.id));
  const match =
    reference && reference.value === value
      ? rows.find((r) => r.id === reference.id)
      : rows.find(
          (r) =>
            (code ? r.code : r.name) === value ||
            ("aliases" in r &&
              Array.isArray(r.aliases) &&
              r.aliases.includes(value)),
        );
  const stale =
    !!value && (!match || (code ? match.code : match.name) !== value);
  const selected = stale ? "__existing" : (match?.id ?? "__none");
  return (
    <div className="grid min-w-0 gap-1">
      <SelectField
        label={label}
        value={selected}
        onChange={(id) => {
          if (id === "__existing") return;
          const row = rows.find((r) => r.id === id);
          if (!row) {
            onChange("");
            return;
          }
          const next = code ? row.code : row.name;
          onChange(next, {
            id: row.id,
            kind,
            code: row.code,
            name: row.name,
            value: next,
          });
        }}
        options={[
          {
            value: "__none",
            label: optional ? "ไม่ระบุ / เลือกข้อมูล" : "เลือกข้อมูล",
          },
          ...(stale
            ? [{ value: "__existing", label: `${value} (ค่าเดิม)` }]
            : []),
          ...rows.map((r) => ({ value: r.id, label: `${r.code} · ${r.name}` })),
        ]}
      />
      {stale && (
        <p className="text-xs text-muted-foreground">
          เก็บค่าเดิมไว้ · อาจเปลี่ยนชื่อ ปิดใช้งาน หรือยังไม่จับคู่
          หากต้องเปลี่ยนให้เลือกจากรายการที่เปิดใช้งาน
        </p>
      )}
    </div>
  );
}
