import {
  newReport,
  newSet,
  newContext,
  newObservation,
  type PackagingReport,
} from "@/src/features/packaging-reports/packaging-domain";
import {
  packagingProfiles,
  type PackagingProfileId,
} from "@/src/features/packaging-reports/packaging-profiles";
function fixture(
  id: string,
  profileId: PackagingProfileId,
  date: string,
  draft = false,
): PackagingReport {
  const r = newReport(profileId);
  r.id = id;
  r.documentNumber = `PACK-DEMO-${id}`;
  r.documentDate = date;
  r.location = packagingProfiles[profileId].locations[0];
  r.status = draft ? "DRAFT" : "RECORDED";
  r.createdAt = `${date}T01:00:00Z`;
  r.updatedAt = `${date}T08:00:00Z`;
  r.sets = Array.from({ length: profileId === "IFOAM" ? 2 : 1 }, (_, i) => {
    const s = newSet(`${id}-set-${i}`, i + 1);
    s.contexts = [
      {
        ...newContext(`${s.id}-context`),
        fertilizerName: `สูตรสาธิต ${i + 1}`,
        productionDate: date,
        packageType: "กระสอบ",
        packageWeight: "25.000",
        packageUnit: "kg",
        quantity: "120",
        lotCode: `LOT-DEMO-${id}-${i + 1}`,
      },
    ];
    s.inspections = ["09:00", "10:15"].map((time, n) => ({
      ...newObservation(`${s.id}-check-${n}`, s.contexts[0].id),
      packingTime: time,
      bagWeight1: "25.125",
      bagWeight2: "25.075",
      physicalCondition: n === 0 ? true : null,
      bagCodeMarking: true,
      bagSealing: n === 1 ? false : true,
      hourlySamplingTime: profileId === "IFOAM" ? time : "",
      moisture: "12.50",
      waterSolubility: "1.30",
      dust: "0.00",
    }));
    s.loadCells = [{ id: `${s.id}-lc`, time: "09:15", weight: "25.001" }];
    s.comparisons = [
      {
        id: `${s.id}-master`,
        time: "09:00",
        qcWeight: "25.010",
        masterWeight: "25.000",
      },
    ];
    s.remarks =
      profileId === "IFOAM" ? `หมายเหตุ SET ${i + 1} · สมมติเท่านั้น` : "";
    return s;
  });
  if (profileId === "ITECH") {
    const second = {
      ...r.sets[0].contexts[0],
      id: `${id}-second-context`,
      fertilizerName: "สูตรสาธิตต่างบริบท",
      lotCode: `LOT-DEMO-${id}-B`,
    };
    r.sets[0].contexts.push(second);
    r.sets[0].inspections[1].contextId = second.id;
  }
  r.signers = r.signers.map((s, i) => ({
    ...s,
    name: `ผู้ลงชื่อสาธิต ${i + 1}`,
    date: i === 0 ? date : "",
  }));
  r.remarks = "รายงานสมมติ ไม่ใช่หลักฐานอนุมัติคุณภาพ และไม่เปลี่ยนสต็อก";
  return r;
}
export const demoPackagingReports = [
  fixture("001", "ITECH", "2026-09-15"),
  fixture("002", "ITECH", "2026-10-10", true),
  fixture("003", "IFOAM", "2026-09-20"),
  fixture("004", "IFOAM", "2026-10-18"),
];
