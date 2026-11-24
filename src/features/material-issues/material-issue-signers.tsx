"use client";

import { SectionCard } from "@/src/components/factory/patterns";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import type { MaterialIssueSignersValues } from "./material-issue-domain";

type MaterialIssueSignersProps = {
  values: MaterialIssueSignersValues;
  onChange: (
    field: keyof MaterialIssueSignersValues,
    value: string,
  ) => void;
};

export function MaterialIssueSigners({
  values,
  onChange,
}: MaterialIssueSignersProps) {
  return (
    <SectionCard title="ผู้รับผิดชอบ">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="issue-requested-by">
            ผู้เบิก
          </Label>

          <Input
            id="issue-requested-by"
            value={values.requestedBy}
            placeholder="ระบุชื่อผู้เบิก"
            onChange={(event) =>
              onChange("requestedBy", event.target.value)
            }
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="issue-issued-by">
            ผู้จ่าย
          </Label>

          <Input
            id="issue-issued-by"
            value={values.issuedBy}
            placeholder="ระบุชื่อผู้จ่าย"
            onChange={(event) =>
              onChange("issuedBy", event.target.value)
            }
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="issue-inspected-by">
            ผู้ตรวจสอบ
          </Label>

          <Input
            id="issue-inspected-by"
            value={values.inspectedBy}
            placeholder="ระบุชื่อผู้ตรวจสอบ"
            onChange={(event) =>
              onChange("inspectedBy", event.target.value)
            }
          />
        </div>
      </div>
    </SectionCard>
  );
}