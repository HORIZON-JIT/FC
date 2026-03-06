import ExcelJS from 'exceljs';
import { WorkInstruction, CATEGORY_LABELS } from '@/types/instruction';

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

export async function exportToExcel(instruction: WorkInstruction): Promise<void> {
  const wb = new ExcelJS.Workbook();

  // Summary sheet
  const summarySheet = wb.addWorksheet('概要');
  summarySheet.columns = [{ width: 15 }, { width: 50 }];

  summarySheet.addRow(['作業手順書']);
  summarySheet.addRow([]);
  summarySheet.addRow(['タイトル', instruction.title]);
  summarySheet.addRow(['カテゴリ', CATEGORY_LABELS[instruction.category]]);
  summarySheet.addRow(['概要', instruction.description]);
  summarySheet.addRow(['作成日', new Date(instruction.createdAt).toLocaleDateString('ja-JP')]);
  summarySheet.addRow(['更新日', new Date(instruction.updatedAt).toLocaleDateString('ja-JP')]);
  summarySheet.addRow(['ステップ数', String(instruction.steps.length)]);

  // Bold title
  const titleCell = summarySheet.getCell('A1');
  titleCell.font = { bold: true, size: 14 };

  // Steps sheet
  const stepsSheet = wb.addWorksheet('手順');
  stepsSheet.columns = [
    { header: 'ステップ番号', width: 12 },
    { header: 'タイトル', width: 25 },
    { header: '説明', width: 50 },
    { header: '注意事項', width: 30 },
    { header: '画像', width: 30 },
    { header: '動画URL', width: 40 },
  ];

  // Style header row
  const headerRow = stepsSheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: 'middle' };

  const sortedSteps = [...instruction.steps].sort((a, b) => a.orderIndex - b.orderIndex);
  const IMAGE_HEIGHT = 150; // pixels
  const ROW_HEIGHT_POINTS = IMAGE_HEIGHT * 0.75; // Excel uses points (1pt = 1.333px)

  for (const step of sortedSteps) {
    const row = stepsSheet.addRow([
      step.orderIndex + 1,
      step.title,
      step.description,
      step.caution || '',
      '', // image placeholder
      step.videoUrl || '',
    ]);

    row.alignment = { vertical: 'top', wrapText: true };

    if (step.imageDataUrl) {
      const { base64, extension } = parseDataUrl(step.imageDataUrl);
      const imageId = wb.addImage({ base64, extension });

      const rowIndex = row.number - 1; // 0-based for addImage
      stepsSheet.addImage(imageId, {
        tl: { col: 4, row: rowIndex },
        ext: { width: 200, height: IMAGE_HEIGHT },
      });

      row.height = ROW_HEIGHT_POINTS;
    }
  }

  const buffer = await wb.xlsx.writeBuffer();
  downloadBuffer(buffer as ArrayBuffer, `${instruction.title}_手順書.xlsx`);
}

export async function exportAllToExcel(instructions: WorkInstruction[]): Promise<void> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('手順書一覧');

  sheet.columns = [
    { header: 'タイトル', width: 30 },
    { header: 'カテゴリ', width: 15 },
    { header: '概要', width: 50 },
    { header: 'ステップ数', width: 12 },
    { header: '作成日', width: 15 },
    { header: '更新日', width: 15 },
  ];

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };

  for (const inst of instructions) {
    sheet.addRow([
      inst.title,
      CATEGORY_LABELS[inst.category],
      inst.description,
      inst.steps.length,
      new Date(inst.createdAt).toLocaleDateString('ja-JP'),
      new Date(inst.updatedAt).toLocaleDateString('ja-JP'),
    ]);
  }

  const buffer = await wb.xlsx.writeBuffer();
  downloadBuffer(buffer as ArrayBuffer, '作業手順書一覧.xlsx');
}
