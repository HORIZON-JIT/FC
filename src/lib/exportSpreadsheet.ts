import * as XLSX from 'xlsx';
import { WorkInstruction, CATEGORY_LABELS } from '@/types/instruction';

export function exportToExcel(instruction: WorkInstruction): void {
  const wb = XLSX.utils.book_new();

  // Summary sheet
  const summaryData = [
    ['作業手順書'],
    [],
    ['タイトル', instruction.title],
    ['カテゴリ', CATEGORY_LABELS[instruction.category]],
    ['概要', instruction.description],
    ['作成日', new Date(instruction.createdAt).toLocaleDateString('ja-JP')],
    ['更新日', new Date(instruction.updatedAt).toLocaleDateString('ja-JP')],
    ['ステップ数', String(instruction.steps.length)],
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  summarySheet['!cols'] = [{ wch: 15 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(wb, summarySheet, '概要');

  // Steps sheet
  const stepsHeader = ['ステップ番号', 'タイトル', '説明', '注意事項', '動画URL'];
  const stepsData = instruction.steps
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((step) => [
      step.orderIndex + 1,
      step.title,
      step.description,
      step.caution || '',
      step.videoUrl || '',
    ]);
  const stepsSheet = XLSX.utils.aoa_to_sheet([stepsHeader, ...stepsData]);
  stepsSheet['!cols'] = [
    { wch: 12 },
    { wch: 25 },
    { wch: 50 },
    { wch: 30 },
    { wch: 40 },
  ];
  XLSX.utils.book_append_sheet(wb, stepsSheet, '手順');

  const filename = `${instruction.title}_手順書.xlsx`;
  XLSX.writeFile(wb, filename);
}

export function exportAllToExcel(instructions: WorkInstruction[]): void {
  const wb = XLSX.utils.book_new();

  const header = ['タイトル', 'カテゴリ', '概要', 'ステップ数', '作成日', '更新日'];
  const rows = instructions.map((inst) => [
    inst.title,
    CATEGORY_LABELS[inst.category],
    inst.description,
    inst.steps.length,
    new Date(inst.createdAt).toLocaleDateString('ja-JP'),
    new Date(inst.updatedAt).toLocaleDateString('ja-JP'),
  ]);
  const sheet = XLSX.utils.aoa_to_sheet([header, ...rows]);
  sheet['!cols'] = [
    { wch: 30 },
    { wch: 15 },
    { wch: 50 },
    { wch: 12 },
    { wch: 15 },
    { wch: 15 },
  ];
  XLSX.utils.book_append_sheet(wb, sheet, '手順書一覧');

  XLSX.writeFile(wb, '作業手順書一覧.xlsx');
}
