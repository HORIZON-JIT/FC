import ExcelJS from 'exceljs';
import { WorkInstruction, CATEGORY_LABELS } from '@/types/instruction';

// Colors
const COLORS = {
  primary: '2563EB',       // blue-600
  primaryLight: 'DBEAFE',  // blue-100
  white: 'FFFFFF',
  dark: '1F2937',          // gray-800
  gray: '6B7280',          // gray-500
  grayLight: 'F3F4F6',     // gray-100
  border: 'D1D5DB',        // gray-300
  cautionBg: 'FEF3C7',    // amber-100
  cautionText: 'B45309',  // amber-700
  cautionBorder: 'F59E0B', // amber-400
};

function parseDataUrl(dataUrl: string): { base64: string; extension: 'png' | 'jpeg' } {
  const match = dataUrl.match(/^data:image\/(png|jpe?g|gif|webp);base64,(.+)$/);
  if (!match) return { base64: dataUrl, extension: 'png' };
  const mimeType = match[1];
  const base64 = match[2];
  const extension = mimeType === 'jpeg' || mimeType === 'jpg' ? 'jpeg' : 'png';
  return { base64, extension };
}

function downloadBuffer(buffer: ArrayBuffer, filename: string) {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function setBorder(cell: ExcelJS.Cell, style: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: COLORS.border } }) {
  cell.border = { top: style, bottom: style, left: style, right: style };
}

function mergeFill(
  sheet: ExcelJS.Worksheet,
  row: number,
  colStart: number,
  colEnd: number,
  value: string,
  font: Partial<ExcelJS.Font>,
  fill: ExcelJS.Fill | null,
  alignment?: Partial<ExcelJS.Alignment>,
) {
  sheet.mergeCells(row, colStart, row, colEnd);
  const cell = sheet.getCell(row, colStart);
  cell.value = value;
  cell.font = font;
  if (fill) cell.fill = fill;
  cell.alignment = { vertical: 'middle', wrapText: true, ...alignment };
  // Apply border to all cells in the merged range
  for (let c = colStart; c <= colEnd; c++) {
    setBorder(sheet.getCell(row, c));
  }
}

export async function exportToExcel(instruction: WorkInstruction): Promise<void> {
  const buffer = await buildExcelBuffer(instruction);
  downloadBuffer(buffer, `${instruction.title}_手順書.xlsx`);
}

export async function buildExcelBuffer(instruction: WorkInstruction): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('作業手順書', {
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1 },
    properties: { showGridLines: false },
  });

  // Column widths: A(3) + B(12) + C(20) + D(20) + E(20) + F(12) = ~87 chars wide
  ws.columns = [
    { width: 3 },   // A: margin
    { width: 14 },  // B: labels
    { width: 22 },  // C: content
    { width: 22 },  // D: content
    { width: 22 },  // E: content
    { width: 14 },  // F: dates/info
  ];

  let row = 1;

  // ===== HEADER SECTION =====
  // Title bar
  ws.getRow(row).height = 40;
  mergeFill(ws, row, 1, 6, instruction.title,
    { bold: true, size: 18, color: { argb: COLORS.white } },
    { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.primary } },
    { horizontal: 'center' },
  );
  row++;

  // Category / Date row
  ws.getRow(row).height = 24;
  ws.mergeCells(row, 1, row, 3);
  const catCell = ws.getCell(row, 1);
  catCell.value = `カテゴリ：${CATEGORY_LABELS[instruction.category]}`;
  catCell.font = { size: 10, color: { argb: COLORS.dark } };
  catCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.primaryLight } };
  catCell.alignment = { vertical: 'middle' };
  for (let c = 1; c <= 3; c++) setBorder(ws.getCell(row, c));

  ws.mergeCells(row, 4, row, 6);
  const dateCell = ws.getCell(row, 4);
  const created = new Date(instruction.createdAt).toLocaleDateString('ja-JP');
  const updated = new Date(instruction.updatedAt).toLocaleDateString('ja-JP');
  dateCell.value = `作成：${created}　更新：${updated}`;
  dateCell.font = { size: 9, color: { argb: COLORS.gray } };
  dateCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.primaryLight } };
  dateCell.alignment = { vertical: 'middle', horizontal: 'right' };
  for (let c = 4; c <= 6; c++) setBorder(ws.getCell(row, c));
  row++;

  // Description
  if (instruction.description) {
    const descLines = Math.ceil(instruction.description.length / 40);
    ws.getRow(row).height = Math.max(20, descLines * 16);
    mergeFill(ws, row, 1, 6, instruction.description,
      { size: 10, color: { argb: COLORS.dark } },
      { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.grayLight } },
    );
    row++;
  }

  // Spacer
  ws.getRow(row).height = 10;
  row++;

  // ===== STEPS SECTION =====
  const sortedSteps = [...instruction.steps].sort((a, b) => a.orderIndex - b.orderIndex);

  for (let i = 0; i < sortedSteps.length; i++) {
    const step = sortedSteps[i];

    // Step header bar
    ws.getRow(row).height = 28;
    mergeFill(ws, row, 1, 6, `  STEP ${i + 1}    ${step.title}`,
      { bold: true, size: 12, color: { argb: COLORS.white } },
      { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.primary } },
    );
    row++;

    // Description
    if (step.description) {
      const lines = Math.ceil(step.description.length / 45);
      ws.getRow(row).height = Math.max(30, lines * 18);
      mergeFill(ws, row, 1, 6, step.description,
        { size: 10, color: { argb: COLORS.dark } },
        { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.white } },
      );
      row++;
    }

    // Caution
    if (step.caution) {
      const cautionLines = Math.ceil(step.caution.length / 40);
      ws.getRow(row).height = Math.max(26, cautionLines * 16);
      mergeFill(ws, row, 1, 6, `⚠ ${step.caution}`,
        { size: 10, bold: true, color: { argb: COLORS.cautionText } },
        { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.cautionBg } },
      );
      // Caution border
      for (let c = 1; c <= 6; c++) {
        ws.getCell(row, c).border = {
          top: { style: 'thin', color: { argb: COLORS.cautionBorder } },
          bottom: { style: 'thin', color: { argb: COLORS.cautionBorder } },
          left: { style: 'thin', color: { argb: COLORS.cautionBorder } },
          right: { style: 'thin', color: { argb: COLORS.cautionBorder } },
        };
      }
      row++;
    }

    // Image (two-cell anchor: image is constrained within the reserved rows)
    if (step.imageDataUrl) {
      const IMAGE_ROWS = 10;
      const IMAGE_ROW_HEIGHT = 20; // points per row
      const imageStartRow = row;

      // Reserve rows with uniform height
      for (let r = 0; r < IMAGE_ROWS; r++) {
        ws.getRow(imageStartRow + r).height = IMAGE_ROW_HEIGHT;
      }

      // Merge image region (1-based)
      ws.mergeCells(imageStartRow, 1, imageStartRow + IMAGE_ROWS - 1, 6);
      const imgCell = ws.getCell(imageStartRow, 1);
      imgCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.white } };
      imgCell.alignment = { vertical: 'middle', horizontal: 'center' };
      for (let r = imageStartRow; r < imageStartRow + IMAGE_ROWS; r++) {
        for (let c = 1; c <= 6; c++) {
          setBorder(ws.getCell(r, c));
        }
      }

      const { base64, extension } = parseDataUrl(step.imageDataUrl);
      const imageId = wb.addImage({ base64, extension });

      // tl/br use 0-based indices; pad slightly for margins
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ws.addImage(imageId, {
        tl: { col: 1.3, row: imageStartRow - 1 + 0.3 },
        br: { col: 5.7, row: imageStartRow - 1 + IMAGE_ROWS - 0.3 },
      } as any);

      row = imageStartRow + IMAGE_ROWS;
    }

    // Video URL
    if (step.videoUrl) {
      ws.getRow(row).height = 22;
      mergeFill(ws, row, 1, 6, `動画：${step.videoUrl}`,
        { size: 9, color: { argb: COLORS.primary }, underline: true },
        { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.white } },
      );
      ws.getCell(row, 1).value = {
        text: `動画：${step.videoUrl}`,
        hyperlink: step.videoUrl,
      } as ExcelJS.CellHyperlinkValue;
      row++;
    }

    // Spacer between steps
    if (i < sortedSteps.length - 1) {
      ws.getRow(row).height = 8;
      row++;
    }
  }

  // Footer
  row++;
  ws.getRow(row).height = 20;
  ws.mergeCells(row, 1, row, 6);
  const footerCell = ws.getCell(row, 1);
  footerCell.value = `全 ${sortedSteps.length} ステップ`;
  footerCell.font = { size: 9, color: { argb: COLORS.gray }, italic: true };
  footerCell.alignment = { horizontal: 'right', vertical: 'middle' };

  // Print area
  ws.pageSetup.printArea = `A1:F${row}`;

  const buffer = await wb.xlsx.writeBuffer();
  return buffer as ArrayBuffer;
}

export async function exportAllToExcel(instructions: WorkInstruction[]): Promise<void> {
  const buffer = await buildAllExcelBuffer(instructions);
  downloadBuffer(buffer, '作業手順書一覧.xlsx');
}

export async function buildAllExcelBuffer(instructions: WorkInstruction[]): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('手順書一覧', {
    properties: { showGridLines: false },
  });

  ws.columns = [
    { width: 4 },   // No.
    { width: 30 },  // タイトル
    { width: 14 },  // カテゴリ
    { width: 45 },  // 概要
    { width: 10 },  // ステップ数
    { width: 14 },  // 作成日
    { width: 14 },  // 更新日
  ];

  // Title
  let row = 1;
  ws.getRow(row).height = 35;
  ws.mergeCells(row, 1, row, 7);
  const titleCell = ws.getCell(row, 1);
  titleCell.value = '作業手順書一覧';
  titleCell.font = { bold: true, size: 16, color: { argb: COLORS.white } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.primary } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  row++;

  // Header
  const headers = ['No.', 'タイトル', 'カテゴリ', '概要', 'ステップ数', '作成日', '更新日'];
  ws.getRow(row).height = 24;
  headers.forEach((h, i) => {
    const cell = ws.getCell(row, i + 1);
    cell.value = h;
    cell.font = { bold: true, size: 10, color: { argb: COLORS.dark } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.primaryLight } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    setBorder(cell);
  });
  row++;

  // Data rows
  instructions.forEach((inst, i) => {
    const isEven = i % 2 === 0;
    const bgColor = isEven ? COLORS.white : COLORS.grayLight;
    const values = [
      i + 1,
      inst.title,
      CATEGORY_LABELS[inst.category],
      inst.description,
      inst.steps.length,
      new Date(inst.createdAt).toLocaleDateString('ja-JP'),
      new Date(inst.updatedAt).toLocaleDateString('ja-JP'),
    ];
    ws.getRow(row).height = 22;
    values.forEach((v, ci) => {
      const cell = ws.getCell(row, ci + 1);
      cell.value = v;
      cell.font = { size: 10, color: { argb: COLORS.dark } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
      cell.alignment = {
        vertical: 'middle',
        wrapText: true,
        horizontal: ci === 0 || ci === 4 ? 'center' : 'left',
      };
      setBorder(cell);
    });
    row++;
  });

  // Footer count
  row++;
  ws.mergeCells(row, 1, row, 7);
  const footerCell = ws.getCell(row, 1);
  footerCell.value = `合計：${instructions.length} 件`;
  footerCell.font = { size: 9, color: { argb: COLORS.gray }, italic: true };
  footerCell.alignment = { horizontal: 'right' };

  const buffer = await wb.xlsx.writeBuffer();
  return buffer as ArrayBuffer;
}
