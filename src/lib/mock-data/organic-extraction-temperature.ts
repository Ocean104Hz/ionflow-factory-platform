import {
  ORGANIC_EXTRACTION_TEMPERATURE_MINUTES,
  blankOrganicExtractionSheet,
  type OrganicExtractionMachine,
  type OrganicExtractionProductionRound,
  type OrganicExtractionTemperatureMinute,
  type OrganicExtractionTemperatureSheet,
} from "@/src/features/organic_extraction_temperature/organic_extraction_temperature_domain";

/**
 * UI MOCK ONLY: fictional production quantities, temperatures, pH, times,
 * people and dates. These are not factory measurements or process targets.
 * Actual material codes come from the domain. Material names stay blank
 * until the factory confirms the master list.
 * No database, API, or browser storage is used.
 */

const DEMO_DOCUMENT_COUNT = 6;

const DEMO_TEMPERATURES: Record<
  OrganicExtractionTemperatureMinute,
  readonly [number, number]
> = {
  90: [70, 72],
  120: [82, 83],
  150: [90, 91],
  180: [93, 94],
};

/** Two separate machine columns per round make the separation easy to inspect. */
function demoMachines(
  roundNumber: 1 | 2,
): readonly [OrganicExtractionMachine, OrganicExtractionMachine] {
  return roundNumber === 1 ? ["B2", "B3"] : ["B4", "B5"];
}

function createDemoRound(
  emptyRound: OrganicExtractionProductionRound,
  sheetNumber: number,
): OrganicExtractionProductionRound {
  // One document intentionally has only the first round filled in.
  if (sheetNumber === DEMO_DOCUMENT_COUNT && emptyRound.round_number === 2) {
    return emptyRound;
  }

  const roundNumber = emptyRound.round_number;
  const [firstMachine, secondMachine] = demoMachines(roundNumber);
  const code = String(sheetNumber).padStart(3, "0");

  return {
    ...emptyRound,
    production_name: `การผลิตสาธิต ${code} รอบที่ ${roundNumber}`,
    start_time: roundNumber === 1 ? "08:00" : "13:00",
    end_time: roundNumber === 1 ? "12:00" : "17:00",
    usage_rows: emptyRound.usage_rows.map((row) => {
      // Populate three of the printed 24 rows; leave the others empty.
      if (row.row_number > 3) {
        return row;
      }

      return {
        ...row,
        quantities: {
          ...row.quantities,
          [firstMachine]: String(sheetNumber * (roundNumber + row.row_number)),
          [secondMachine]: (sheetNumber * 0.5 + row.row_number).toFixed(2),
        },
        remark: row.row_number === 1 ? "ข้อมูลสาธิต" : "",
      };
    }),
    temperature_rows: emptyRound.temperature_rows.map((row) => {
      const [firstTemperature, secondTemperature] =
        DEMO_TEMPERATURES[row.minute];

      return {
        ...row,
        temperatures: {
          ...row.temperatures,
          [firstMachine]: String(firstTemperature + sheetNumber - 1),
          [secondMachine]: String(secondTemperature + sheetNumber - 1),
        },
        remark: row.minute === ORGANIC_EXTRACTION_TEMPERATURE_MINUTES[3]
          ? "ข้อมูลสาธิต"
          : "",
      };
    }),
    ph_values: {
      ...emptyRound.ph_values,
      [firstMachine]: "6.4",
      [secondMachine]: "6.6",
    },
    ph_remark: "ข้อมูลสาธิต",
  };
}

function createDemoSheet(sheetNumber: number): OrganicExtractionTemperatureSheet {
  const emptySheet = blankOrganicExtractionSheet();
  const code = String(sheetNumber).padStart(3, "0");
  const day = String(19 - sheetNumber).padStart(2, "0");
  const documentDate = `2026-11-${day}`;
  const savedAt = `${documentDate}T18:00:00+07:00`;

  return {
    ...emptySheet,
    id: `organic-extraction-demo-${code}`,
    document_date: documentDate,
    prepared_by: "ผู้จัดทำสาธิต",
    inspected_by: "ผู้ตรวจสอบสาธิต",
    created_at: savedAt,
    updated_at: savedAt,
    rounds: emptySheet.rounds.map((round) => createDemoRound(round, sheetNumber)),
  };
}

/** Ready to pass to <OrganicExtractionTemperatureWorkspace initialRecords={...} />. */
export const demoOrganicExtractionTemperatureSheets: OrganicExtractionTemperatureSheet[] =
  Array.from({ length: DEMO_DOCUMENT_COUNT }, (_, index) =>
    createDemoSheet(index + 1),
  );
