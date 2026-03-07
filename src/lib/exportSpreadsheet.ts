import ExcelJS from 'exceljs';
import { WorkInstruction, CATEGORY_LABELS, getStepImages, getImageCaption } from '@/types/instruction';

/** Estimate row height for text in merged C-G columns (approx 40 chars/line for Japanese) */
function calcRowHeight(text: string, charsPerLine: number, lineHeight: number, minHeight: number): number {
  const lines = text.split('\n');
  let totalLines = 0;
  for (const line of lines) {
    totalLines += Math.max(1, Math.ceil(line.length / charsPerLine));
  }
  return Math.max(minHeight, totalLines * lineHeight);
}

// Color palette (matching PDF design)
const C = {
  primary: '1E40AF',        // deep blue
  primaryMid: '2563EB',     // blue-600
  primaryLight: '3B82F6',   // blue-500
  headerBg: 'EFF6FF',       // blue-50
  badgeBlueBg: 'DBEAFE',    // blue-100
  badgeBlueText: '1D4ED8',  // blue-700
  badgeOrangeBg: 'FFEDD5',  // orange-100
  badgeOrangeText: 'C2410C',// orange-700
  white: 'FFFFFF',
  dark: '1F2937',           // gray-800
  text: '374151',           // gray-700
  gray: '6B7280',           // gray-500
  grayLight: 'F9FAFB',      // gray-50
  grayMid: 'F3F4F6',        // gray-100
  border: 'E5E7EB',         // gray-200
  borderLight: 'F3F4F6',    // gray-100
  borderBlue: 'BFDBFE',     // blue-200
  cautionBg: 'FEF3C7',      // amber-100
  cautionText: '92400E',    // amber-800
  cautionBorder: 'F59E0B',  // amber-400
  stepTitle: '1E3A5F',      // dark blue
  accent: '2563EB',         // blue for accent strip
};

const THIN_BORDER: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: C.border } };
const NO_BORDER: Partial<ExcelJS.Border> = { style: undefined };

function parseDataUrl(dataUrl: string): { base64: string; extension: 'png' | 'jpeg' } {
  const match = dataUrl.match(/^data:image\/(png|jpe?g|gif|webp);base64,(.+)$/);
  if (!match) return { base64: dataUrl, extension: 'png' };
  const mimeType = match[1];
  const base64 = match[2];
  const extension = mimeType === 'jpeg' || mimeType === 'jpg' ? 'jpeg' : 'png';
  return { base64, extension };
}

/** Get natural pixel dimensions of an image from its data URL */
function getImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: 4, height: 3 }); // fallback to 4:3
    img.src = dataUrl;
  });
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

function setBoxBorder(cell: ExcelJS.Cell, options?: {
  top?: Partial<ExcelJS.Border>;
  bottom?: Partial<ExcelJS.Border>;
  left?: Partial<ExcelJS.Border>;
  right?: Partial<ExcelJS.Border>;
}) {
  cell.border = {
    top: options?.top ?? THIN_BORDER,
    bottom: options?.bottom ?? THIN_BORDER,
    left: options?.left ?? THIN_BORDER,
    right: options?.right ?? THIN_BORDER,
  };
}

/** Apply style to a range of cells in a row */
function styleRange(
  ws: ExcelJS.Worksheet,
  row: number,
  colStart: number,
  colEnd: number,
  opts: {
    font?: Partial<ExcelJS.Font>;
    fill?: ExcelJS.Fill;
    alignment?: Partial<ExcelJS.Alignment>;
    border?: {
      top?: Partial<ExcelJS.Border>;
      bottom?: Partial<ExcelJS.Border>;
      left?: Partial<ExcelJS.Border>;
      right?: Partial<ExcelJS.Border>;
    };
  },
) {
  for (let c = colStart; c <= colEnd; c++) {
    const cell = ws.getCell(row, c);
    cell.font = { name: 'Arial', ...opts.font };
    if (opts.fill) cell.fill = opts.fill;
    if (opts.alignment) cell.alignment = opts.alignment;
    if (opts.border) {
      setBoxBorder(cell, opts.border);
    }
  }
}

/** Merge cells and set value with styling */
function mergeStyled(
  ws: ExcelJS.Worksheet,
  rowStart: number,
  colStart: number,
  rowEnd: number,
  colEnd: number,
  value: string | ExcelJS.CellRichTextValue,
  opts: {
    font?: Partial<ExcelJS.Font>;
    fill?: ExcelJS.Fill;
    alignment?: Partial<ExcelJS.Alignment>;
    border?: {
      top?: Partial<ExcelJS.Border>;
      bottom?: Partial<ExcelJS.Border>;
      left?: Partial<ExcelJS.Border>;
      right?: Partial<ExcelJS.Border>;
    };
  },
) {
  ws.mergeCells(rowStart, colStart, rowEnd, colEnd);
  const cell = ws.getCell(rowStart, colStart);
  cell.value = value;
  cell.font = { name: 'Arial', ...opts.font };
  if (opts.fill) cell.fill = opts.fill;
  cell.alignment = { vertical: 'middle', wrapText: true, ...opts.alignment };

  // Apply border to all cells in range
  for (let r = rowStart; r <= rowEnd; r++) {
    for (let c = colStart; c <= colEnd; c++) {
      if (opts.border) {
        setBoxBorder(ws.getCell(r, c), opts.border);
      }
    }
  }
}

const solidFill = (color: string): ExcelJS.Fill => ({
  type: 'pattern', pattern: 'solid', fgColor: { argb: color },
});

// ============================================================
// Single instruction export
// ============================================================

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

  // Columns: A(accent 1.5) B(number 5) C(16) D(16) E(16) F(16) G(12)
  ws.columns = [
    { width: 1.5 },  // A: accent stripe
    { width: 6 },    // B: step number / label
    { width: 16 },   // C: content
    { width: 16 },   // D: content
    { width: 16 },   // E: content
    { width: 16 },   // F: content
    { width: 12 },   // G: dates/info
  ];

  const LAST_COL = 7;
  let row = 1;

  // ===== TITLE BANNER =====
  ws.getRow(row).height = 44;
  mergeStyled(ws, row, 1, row, LAST_COL, instruction.title, {
    font: { bold: true, size: 20, color: { argb: C.white } },
    fill: solidFill(C.primary),
    alignment: { horizontal: 'center' },
    border: { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER },
  });
  row++;

  // Subtitle "作業手順書"
  ws.getRow(row).height = 22;
  mergeStyled(ws, row, 1, row, LAST_COL, '作業手順書', {
    font: { size: 10, color: { argb: C.primaryLight } },
    fill: solidFill(C.primaryMid),
    alignment: { horizontal: 'center' },
    border: { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER },
  });
  row++;

  // ===== META BAR =====
  const catColors: Record<string, { bg: string; text: string }> = {
    pc_work: { bg: C.badgeBlueBg, text: C.badgeBlueText },
    packing: { bg: C.badgeOrangeBg, text: C.badgeOrangeText },
  };
  const catC = catColors[instruction.category] || catColors.pc_work;

  ws.getRow(row).height = 26;
  // Category (left)
  mergeStyled(ws, row, 1, row, 3, `  ${CATEGORY_LABELS[instruction.category]}`, {
    font: { size: 10, bold: true, color: { argb: catC.text } },
    fill: solidFill(catC.bg),
    alignment: { horizontal: 'left' },
    border: { top: THIN_BORDER, bottom: THIN_BORDER, left: NO_BORDER, right: NO_BORDER },
  });
  // Dates (right)
  const created = new Date(instruction.createdAt).toLocaleDateString('ja-JP');
  const updated = new Date(instruction.updatedAt).toLocaleDateString('ja-JP');
  mergeStyled(ws, row, 4, row, LAST_COL, `作成: ${created}  |  更新: ${updated}  `, {
    font: { size: 9, color: { argb: C.gray } },
    fill: solidFill(C.grayLight),
    alignment: { horizontal: 'right' },
    border: { top: THIN_BORDER, bottom: THIN_BORDER, left: NO_BORDER, right: NO_BORDER },
  });
  row++;

  // ===== DESCRIPTION =====
  if (instruction.description) {
    ws.getRow(row).height = calcRowHeight(instruction.description, 35, 18, 28);
    mergeStyled(ws, row, 1, row, LAST_COL, `  ${instruction.description}`, {
      font: { size: 10, color: { argb: C.text } },
      fill: solidFill(C.white),
      border: { top: NO_BORDER, bottom: THIN_BORDER, left: NO_BORDER, right: NO_BORDER },
    });
    row++;
  }

  // Spacer
  ws.getRow(row).height = 12;
  row++;

  // ===== STEPS =====
  const sortedSteps = [...instruction.steps].sort((a, b) => a.orderIndex - b.orderIndex);

  for (let i = 0; i < sortedSteps.length; i++) {
    const step = sortedSteps[i];
    const stepNum = String(i + 1).padStart(2, '0');

    // --- Step header row ---
    ws.getRow(row).height = 34;

    // A: accent stripe
    const accentCell = ws.getCell(row, 1);
    accentCell.fill = solidFill(C.accent);
    setBoxBorder(accentCell, { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER });

    // B: step number
    const numCell = ws.getCell(row, 2);
    numCell.value = stepNum;
    numCell.font = { name: 'Arial', bold: true, size: 16, color: { argb: C.white } };
    numCell.fill = solidFill(C.primaryMid);
    numCell.alignment = { horizontal: 'center', vertical: 'middle' };
    setBoxBorder(numCell, { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER });

    // C-G: step title
    mergeStyled(ws, row, 3, row, LAST_COL, `  ${step.title}`, {
      font: { bold: true, size: 13, color: { argb: C.stepTitle } },
      fill: solidFill(C.headerBg),
      alignment: { horizontal: 'left' },
      border: {
        top: { style: 'thin', color: { argb: C.borderBlue } },
        bottom: { style: 'medium', color: { argb: C.borderBlue } },
        left: NO_BORDER,
        right: { style: 'thin', color: { argb: C.borderBlue } },
      },
    });
    row++;

    // --- Description ---
    if (step.description) {
      ws.getRow(row).height = calcRowHeight(step.description, 30, 18, 32);

      // A: accent
      const aCell = ws.getCell(row, 1);
      aCell.fill = solidFill(C.accent);
      setBoxBorder(aCell, { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER });

      // B: label
      const labelCell = ws.getCell(row, 2);
      labelCell.value = '説明';
      labelCell.font = { name: 'Arial', size: 9, bold: true, color: { argb: C.gray } };
      labelCell.fill = solidFill(C.grayLight);
      labelCell.alignment = { horizontal: 'center', vertical: 'top' };
      setBoxBorder(labelCell, { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER });

      // C-G: description content
      mergeStyled(ws, row, 3, row, LAST_COL, step.description, {
        font: { size: 10, color: { argb: C.text } },
        fill: solidFill(C.white),
        border: { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER },
      });
      row++;
    }

    // --- Caution ---
    if (step.caution) {
      ws.getRow(row).height = calcRowHeight(step.caution, 30, 18, 28);

      // A: amber accent
      const aCell = ws.getCell(row, 1);
      aCell.fill = solidFill(C.cautionBorder);
      setBoxBorder(aCell, { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER });

      // B: label
      const labelCell = ws.getCell(row, 2);
      labelCell.value = '⚠ 注意';
      labelCell.font = { name: 'Arial', size: 9, bold: true, color: { argb: C.cautionText } };
      labelCell.fill = solidFill(C.cautionBg);
      labelCell.alignment = { horizontal: 'center', vertical: 'middle' };
      setBoxBorder(labelCell, {
        top: { style: 'thin', color: { argb: C.cautionBorder } },
        bottom: { style: 'thin', color: { argb: C.cautionBorder } },
        left: { style: 'thin', color: { argb: C.cautionBorder } },
        right: { style: 'thin', color: { argb: C.cautionBorder } },
      });

      // C-G: caution text
      mergeStyled(ws, row, 3, row, LAST_COL, step.caution, {
        font: { size: 10, color: { argb: C.cautionText } },
        fill: solidFill(C.cautionBg),
        border: {
          top: { style: 'thin', color: { argb: C.cautionBorder } },
          bottom: { style: 'thin', color: { argb: C.cautionBorder } },
          left: { style: 'thin', color: { argb: C.cautionBorder } },
          right: { style: 'thin', color: { argb: C.cautionBorder } },
        },
      });
      row++;
    }

    // --- Images ---
    const stepImages = getStepImages(step);
    for (let imgIdx = 0; imgIdx < stepImages.length; imgIdx++) {
      const IMAGE_ROW_HEIGHT = 18;
      const CONTENT_WIDTH_PX = 480; // approximate pixel width of columns C-G
      const MIN_IMAGE_ROWS = 6;
      const MAX_IMAGE_ROWS = 22;

      // Calculate row count dynamically based on image aspect ratio
      const dims = await getImageDimensions(stepImages[imgIdx]);
      const aspectRatio = dims.height / dims.width;
      const fitHeightPx = CONTENT_WIDTH_PX * aspectRatio;
      const imageRows = Math.min(MAX_IMAGE_ROWS, Math.max(MIN_IMAGE_ROWS, Math.round(fitHeightPx / IMAGE_ROW_HEIGHT)));

      const imageStartRow = row;

      for (let r = 0; r < imageRows; r++) {
        ws.getRow(imageStartRow + r).height = IMAGE_ROW_HEIGHT;
        // A: accent stripe continuation
        const aCell = ws.getCell(imageStartRow + r, 1);
        aCell.fill = solidFill(C.accent);
        setBoxBorder(aCell, { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER });

        // B: label column (separate from image merge)
        const bCell = ws.getCell(imageStartRow + r, 2);
        bCell.fill = solidFill(C.grayLight);
        setBoxBorder(bCell, { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER });
      }

      // B label text on first row
      const labelCell = ws.getCell(imageStartRow, 2);
      labelCell.value = stepImages.length > 1 ? `画像 ${imgIdx + 1}` : '画像';
      labelCell.font = { name: 'Arial', size: 9, bold: true, color: { argb: C.gray } };
      labelCell.alignment = { horizontal: 'center', vertical: 'top' };

      // Merge image region C-G only (not B)
      ws.mergeCells(imageStartRow, 3, imageStartRow + imageRows - 1, LAST_COL);
      const imgCell = ws.getCell(imageStartRow, 3);
      imgCell.fill = solidFill(C.grayLight);
      imgCell.alignment = { vertical: 'middle', horizontal: 'center' };
      for (let r = imageStartRow; r < imageStartRow + imageRows; r++) {
        for (let c = 3; c <= LAST_COL; c++) {
          setBoxBorder(ws.getCell(r, c), { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER });
        }
      }

      const { base64, extension } = parseDataUrl(stepImages[imgIdx]);
      const imageId = wb.addImage({ base64, extension });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ws.addImage(imageId, {
        tl: { col: 2.2, row: imageStartRow - 1 + 0.3 },
        br: { col: LAST_COL - 0.3, row: imageStartRow - 1 + imageRows - 0.3 },
      } as any);

      row = imageStartRow + imageRows;

      // Caption row
      const caption = getImageCaption(step, imgIdx);
      if (caption) {
        ws.getRow(row).height = calcRowHeight(caption, 30, 16, 22);

        const aCap = ws.getCell(row, 1);
        aCap.fill = solidFill(C.accent);
        setBoxBorder(aCap, { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER });

        const bCap = ws.getCell(row, 2);
        bCap.fill = solidFill(C.grayLight);
        setBoxBorder(bCap, { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER });

        mergeStyled(ws, row, 3, row, LAST_COL, caption, {
          font: { size: 9, italic: true, color: { argb: C.gray } },
          fill: solidFill(C.grayLight),
          border: { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER },
        });
        row++;
      }
    }

    // --- Video URL ---
    if (step.videoUrl) {
      ws.getRow(row).height = 24;

      // A: accent
      const aCell = ws.getCell(row, 1);
      aCell.fill = solidFill(C.accent);
      setBoxBorder(aCell, { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER });

      // B: label
      const labelCell = ws.getCell(row, 2);
      labelCell.value = '▶ 動画';
      labelCell.font = { name: 'Arial', size: 9, bold: true, color: { argb: C.primaryMid } };
      labelCell.fill = solidFill(C.white);
      labelCell.alignment = { horizontal: 'center', vertical: 'middle' };
      setBoxBorder(labelCell, { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER });

      // C-G: url
      mergeStyled(ws, row, 3, row, LAST_COL, step.videoUrl, {
        font: { size: 10, color: { argb: C.primaryMid }, underline: true },
        fill: solidFill(C.white),
        border: { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER },
      });
      ws.getCell(row, 3).value = {
        text: step.videoUrl,
        hyperlink: step.videoUrl,
      } as ExcelJS.CellHyperlinkValue;
      row++;
    }

    // Spacer between steps
    if (i < sortedSteps.length - 1) {
      ws.getRow(row).height = 10;
      row++;
    }
  }

  // ===== FOOTER =====
  row++;
  ws.getRow(row).height = 22;
  mergeStyled(ws, row, 1, row, LAST_COL, `全 ${sortedSteps.length} ステップ  `, {
    font: { size: 9, italic: true, color: { argb: C.gray } },
    fill: solidFill(C.grayMid),
    alignment: { horizontal: 'right' },
    border: { top: THIN_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER },
  });

  ws.pageSetup.printArea = `A1:G${row}`;

  const buffer = await wb.xlsx.writeBuffer();
  return buffer as ArrayBuffer;
}

// ============================================================
// All instructions list export
// ============================================================

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
    { width: 5 },   // No.
    { width: 30 },  // タイトル
    { width: 14 },  // カテゴリ
    { width: 45 },  // 概要
    { width: 10 },  // ステップ数
    { width: 14 },  // 作成日
    { width: 14 },  // 更新日
  ];

  const COLS = 7;
  let row = 1;

  // Title banner
  ws.getRow(row).height = 40;
  mergeStyled(ws, row, 1, row, COLS, '作業手順書一覧', {
    font: { bold: true, size: 18, color: { argb: C.white } },
    fill: solidFill(C.primary),
    alignment: { horizontal: 'center' },
    border: { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER },
  });
  row++;

  // Column headers
  const headers = ['No.', 'タイトル', 'カテゴリ', '概要', 'ステップ数', '作成日', '更新日'];
  ws.getRow(row).height = 26;
  headers.forEach((h, i) => {
    const cell = ws.getCell(row, i + 1);
    cell.value = h;
    cell.font = { name: 'Arial', bold: true, size: 10, color: { argb: C.dark } };
    cell.fill = solidFill(C.headerBg);
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    setBoxBorder(cell, {
      top: { style: 'medium', color: { argb: C.borderBlue } },
      bottom: { style: 'medium', color: { argb: C.borderBlue } },
      left: THIN_BORDER,
      right: THIN_BORDER,
    });
  });
  row++;

  // Data rows
  instructions.forEach((inst, i) => {
    const bgColor = i % 2 === 0 ? C.white : C.grayLight;
    const values: (string | number | undefined)[] = [
      i + 1,
      inst.title,
      CATEGORY_LABELS[inst.category],
      inst.description,
      inst.steps.length,
      new Date(inst.createdAt).toLocaleDateString('ja-JP'),
      new Date(inst.updatedAt).toLocaleDateString('ja-JP'),
    ];
    ws.getRow(row).height = 24;
    values.forEach((v, ci) => {
      const cell = ws.getCell(row, ci + 1);
      cell.value = v;
      cell.font = { name: 'Arial', size: 10, color: { argb: C.dark } };
      cell.fill = solidFill(bgColor);
      cell.alignment = {
        vertical: 'middle',
        wrapText: true,
        horizontal: ci === 0 || ci === 4 ? 'center' : 'left',
      };
      setBoxBorder(cell);
    });
    row++;
  });

  // Footer
  row++;
  mergeStyled(ws, row, 1, row, COLS, `合計：${instructions.length} 件`, {
    font: { size: 9, italic: true, color: { argb: C.gray } },
    alignment: { horizontal: 'right' },
    border: { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER },
  });

  const buffer = await wb.xlsx.writeBuffer();
  return buffer as ArrayBuffer;
}
