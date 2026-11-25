import type {
    MaterialIssueInput,
} from "./material-issue-types";

export class MaterialIssueValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "MaterialIssueValidationError";
    }
}

function fail(message: string): never {
    throw new MaterialIssueValidationError(message);
}

function readObject(
    value: unknown,
    label: string,
): Record<string, unknown> {
    if (
        typeof value !== "object" ||
        value === null ||
        Array.isArray(value)
    ) {
        return fail(`${label}ไม่ถูกต้อง`);
    }

    return value as Record<string, unknown>;
}

function readText(
    value: unknown,
    label: string,
    required = false,
): string {
    if (typeof value !== "string") {
        return fail(`${label}ไม่ถูกต้อง`);
    }

    const text = value.trim();

    if (required && !text) {
        return fail(`กรุณาระบุ${label}`);
    }

    if (text.includes("\0")) {
        return fail(`${label}มีอักขระไม่ถูกต้อง`);
    }

    return text;
}

function readDate(value: unknown): string {
    const date = readText(value, "วันที่", true);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return fail("รูปแบบวันที่ไม่ถูกต้อง");
    }

    const parsed = new Date(`${date}T00:00:00.000Z`);

    if (
        Number.isNaN(parsed.getTime()) ||
        date.startsWith("0000-") ||
        parsed.toISOString().slice(0, 10) !== date
    ) {
        return fail("วันที่ไม่ถูกต้อง");
    }

    return date;
}

function readQuantity(
    value: unknown,
    label: string,
    required = false,
    positive = false,
): string {
    const text = readText(value, label, required);

    if (!text) {
        return "";
    }

    // ตรงกับ NUMERIC(18,4)
    // เก็บเป็น string เพื่อรักษาความแม่นยำ
    if (!/^\d{1,14}(\.\d{1,4})?$/.test(text)) {
        return fail(
            `${label}ต้องเป็นตัวเลขไม่ติดลบ ` +
            `และมีทศนิยมไม่เกิน 4 ตำแหน่ง`,
        );
    }

    if (positive && !/[1-9]/.test(text)) {
        return fail(`${label}ต้องมากกว่า 0`);
    }

    return text;
}

export function validateMaterialIssueInput(
    value: unknown,
): MaterialIssueInput {
    const input = readObject(value, "ข้อมูลเอกสาร");

    const header = readObject(
        input.header,
        "ข้อมูลหัวเอกสาร",
    );

    const signers = readObject(
        input.signers,
        "ข้อมูลผู้รับผิดชอบ",
    );

    if (!Array.isArray(input.items)) {
        return fail("รายการวัสดุไม่ถูกต้อง");
    }

    const items: MaterialIssueInput["items"] = [];

    for (const [index, value] of input.items.entries()) {
        const row = readObject(
            value,
            `รายการวัสดุที่ ${index + 1}`,
        );

        const item = {
            id: readText(row.id, "รหัสแถว"),
            materialCode: readText(
                row.materialCode,
                "รหัสวัสดุ",
            ),
            materialName: readText(
                row.materialName,
                "ชื่อวัสดุ",
            ),
            quantity: readText(
                row.quantity,
                "จำนวนวัสดุ",
            ),
            unit: readText(row.unit, "หน่วย"),
            damagedQuantity: readText(
                row.damagedQuantity,
                "จำนวนชำรุด",
            ),
            additionalQuantity: readText(
                row.additionalQuantity,
                "จำนวนเบิกเพิ่ม",
            ),
        };

        const hasData = [
            item.materialCode,
            item.materialName,
            item.quantity,
            item.unit,
            item.damagedQuantity,
            item.additionalQuantity,
        ].some((text) => text !== "");

        // ไม่บันทึกแถวว่างที่แสดงอยู่ในฟอร์ม
        if (!hasData) {
            continue;
        }

        const line = index + 1;

        if (!item.materialCode) {
            return fail(
                `กรุณาระบุรหัสวัสดุในรายการที่ ${line}`,
            );
        }

        if (!item.materialName) {
            return fail(
                `กรุณาระบุชื่อวัสดุในรายการที่ ${line}`,
            );
        }

        if (!item.unit) {
            return fail(
                `กรุณาระบุหน่วยในรายการที่ ${line}`,
            );
        }

        items.push({
            ...item,

            quantity: readQuantity(
                item.quantity,
                `จำนวนวัสดุรายการที่ ${line}`,
                true,
                true,
            ),

            damagedQuantity: readQuantity(
                item.damagedQuantity,
                `จำนวนชำรุดรายการที่ ${line}`,
            ),

            additionalQuantity: readQuantity(
                item.additionalQuantity,
                `จำนวนเบิกเพิ่มรายการที่ ${line}`,
            ),
        });
    }

    if (items.length === 0) {
        return fail("กรุณาระบุรายการวัสดุอย่างน้อย 1 รายการ");
    }

    return {
        header: {
            location: readText(
                header.location,
                "สถานที่",
                true,
            ),

            productName: readText(
                header.productName,
                "ชื่อผลิตภัณฑ์",
                true,
            ),

            quantity: readQuantity(
                header.quantity,
                "จำนวนผลิตภัณฑ์",
                true,
                true,
            ),

            issueDate: readDate(header.issueDate),

            department: readText(
                header.department,
                "ฝ่าย",
                true,
            ),
        },

        items,

        signers: {
            requestedBy: readText(
                signers.requestedBy,
                "ผู้เบิก",
            ),

            issuedBy: readText(
                signers.issuedBy,
                "ผู้จ่าย",
            ),

            inspectedBy: readText(
                signers.inspectedBy,
                "ผู้ตรวจสอบ",
            ),
        },
    };
}