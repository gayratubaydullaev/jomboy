import ExcelJS from 'exceljs';

export function cellToString(value: ExcelJS.CellValue): string {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value).trim();
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object' && 'text' in value && typeof (value as { text: string }).text === 'string') {
    return (value as { text: string }).text.trim();
  }
  if (typeof value === 'object' && 'result' in value) {
    return cellToString((value as { result: ExcelJS.CellValue }).result);
  }
  return String(value).trim();
}

export async function workbookToRowRecords(buffer: Buffer): Promise<Record<string, unknown>[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as Parameters<ExcelJS.Workbook['xlsx']['load']>[0]);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error('Excel faylida hech qanday varaq topilmadi');
  const headerRow = ws.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell((cell, col) => {
    headers[col - 1] = cellToString(cell.value);
  });
  const rows: Record<string, unknown>[] = [];
  ws.eachRow((row, rowNumber) => {
    if (rowNumber <= 1) return;
    const record: Record<string, unknown> = {};
    let hasValue = false;
    row.eachCell((cell, col) => {
      const key = headers[col - 1];
      if (!key) return;
      const val = cellToString(cell.value);
      if (val !== '') hasValue = true;
      record[key] = val;
    });
    if (hasValue) rows.push(record);
  });
  return rows;
}

export async function buildWorkbookBuffer(
  sheets: { name: string; rows: (string | number)[][]; colWidths?: number[] }[],
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  for (const sheet of sheets) {
    const ws = wb.addWorksheet(sheet.name);
    for (const row of sheet.rows) {
      ws.addRow(row);
    }
    if (sheet.colWidths?.length) {
      ws.columns = sheet.colWidths.map((wch) => ({ width: wch }));
    }
  }
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
