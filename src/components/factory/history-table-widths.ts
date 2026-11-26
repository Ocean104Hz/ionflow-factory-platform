type WidthColumn = {
  key: string;
  width?: number;
  minWidth?: number;
  maxWidth?: number;
};

type Widths = Readonly<Record<string, number>>;

export function clampColumnWidth(column: WidthColumn, requested: number) {
  const min = Math.max(32, column.minWidth ?? 80);
  const max = Math.max(min, column.maxWidth ?? 650);
  return Math.round(Math.min(max, Math.max(min, Number.isNaN(requested) ? min : requested)));
}

function columnWidth(column: WidthColumn, widths: Widths) {
  return clampColumnWidth(column, widths[column.key] ?? column.width ?? 180);
}

// Match iTECH's proportional allocation of spare viewport width.
export function fillColumnWidths(columns: readonly WidthColumn[], widths: Widths, available: number) {
  const total = columns.reduce((sum, column) => sum + columnWidth(column, widths), 0);
  const extra = Math.max(0, available - total);
  return Object.fromEntries(columns.map((column) => {
    const width = columnWidth(column, widths);
    return [column.key, width + (total > 0 ? extra * width / total : 0)];
  }));
}
