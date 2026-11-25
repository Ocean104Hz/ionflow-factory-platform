import type {
  MaterialIssueItem,
  MaterialIssueRecord,
} from "./material-issue-domain";

const SAMPLE_PRODUCTS = [
  "นาโน-อะมิโน ขนาด 1 ลิตร",
  "นาโน-อะมิโน ขนาด 3 ลิตร",
  "ปุ๋ยเคมี อัยย์ฟิลด์",
];

function createMockItems(
  count: number,
): MaterialIssueItem[] {
  const materials: MaterialIssueItem[] = [
    {
      id: "row-1",
      materialCode: "RM-001",
      materialName: "เม็ดพลาสติก",
      quantity: "100",
      unit: "กก.",
      damagedQuantity: "0",
      additionalQuantity: "0",
    },
    {
      id: "row-2",
      materialCode: "RM-002",
      materialName: "ถุงบรรจุ",
      quantity: "200",
      unit: "ใบ",
      damagedQuantity: "2",
      additionalQuantity: "5",
    },
    {
      id: "row-3",
      materialCode: "RM-003",
      materialName: "กล่องบรรจุภัณฑ์",
      quantity: "50",
      unit: "กล่อง",
      damagedQuantity: "0",
      additionalQuantity: "0",
    },
  ];

  return materials.slice(0, count);
}

export const MOCK_MATERIAL_ISSUE_HISTORY:
  MaterialIssueRecord[] = Array.from(
    { length: 6 },
    (_, index) => ({
      id: `material-issue-demo-${index + 1}`,

      documentNo: `MI-DEMO-${String(
        index + 1,
      ).padStart(4, "0")}`,

      header: {
        location: "โรงงานกาญ 2",

        productName:
          SAMPLE_PRODUCTS[
            index % SAMPLE_PRODUCTS.length
          ],

        quantity: String(
          [100, 200, 150][index % 3],
        ),

        issueDate: `2026-11-${String(
          15 + index,
        ).padStart(2, "0")}`,

        department: "ฝ่ายผลิต",
      },

      items: createMockItems(
        (index % 2) + 2,
      ),

      signers: {
        requestedBy: `ผู้เบิกตัวอย่าง ${index + 1}`,
        issuedBy: `ผู้จ่ายตัวอย่าง ${index + 1}`,
        inspectedBy: `ผู้ตรวจสอบตัวอย่าง ${index + 1}`,
      },
    }),
  );