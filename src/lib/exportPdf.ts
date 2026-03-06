import jsPDF from 'jspdf';
import { WorkInstruction, CATEGORY_LABELS } from '@/types/instruction';

export async function exportToPdf(instruction: WorkInstruction): Promise<void> {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = 20;

  // Helper: add new page if needed
  const checkPageBreak = (requiredHeight: number) => {
    if (y + requiredHeight > pdf.internal.pageSize.getHeight() - 20) {
      pdf.addPage();
      y = 20;
    }
  };

  // Load Japanese font support - use built-in Helvetica as fallback
  // Title
  pdf.setFontSize(20);
  pdf.text(instruction.title, pageWidth / 2, y, { align: 'center' });
  y += 12;

  // Category & description
  pdf.setFontSize(11);
  pdf.text(`[${CATEGORY_LABELS[instruction.category]}]`, pageWidth / 2, y, { align: 'center' });
  y += 8;

  if (instruction.description) {
    pdf.setFontSize(10);
    const descLines = pdf.splitTextToSize(instruction.description, contentWidth);
    pdf.text(descLines, margin, y);
    y += descLines.length * 5 + 5;
  }

  // Date info
  pdf.setFontSize(8);
  pdf.setTextColor(128, 128, 128);
  pdf.text(
    `Created: ${new Date(instruction.createdAt).toLocaleDateString('ja-JP')} | Updated: ${new Date(instruction.updatedAt).toLocaleDateString('ja-JP')}`,
    margin,
    y
  );
  pdf.setTextColor(0, 0, 0);
  y += 10;

  // Separator
  pdf.setDrawColor(200, 200, 200);
  pdf.line(margin, y, pageWidth - margin, y);
  y += 8;

  // Steps
  const sortedSteps = [...instruction.steps].sort((a, b) => a.orderIndex - b.orderIndex);

  for (const step of sortedSteps) {
    checkPageBreak(40);

    // Step header
    pdf.setFontSize(14);
    pdf.setTextColor(37, 99, 235);
    pdf.text(`Step ${step.orderIndex + 1}: ${step.title}`, margin, y);
    pdf.setTextColor(0, 0, 0);
    y += 8;

    // Step description
    if (step.description) {
      pdf.setFontSize(10);
      const lines = pdf.splitTextToSize(step.description, contentWidth);
      checkPageBreak(lines.length * 5 + 5);
      pdf.text(lines, margin, y);
      y += lines.length * 5 + 3;
    }

    // Image
    if (step.imageDataUrl) {
      try {
        checkPageBreak(65);
        pdf.addImage(step.imageDataUrl, 'JPEG', margin, y, Math.min(contentWidth, 120), 60);
        y += 63;
      } catch {
        // Skip image if it can't be added
      }
    }

    // Caution
    if (step.caution) {
      checkPageBreak(15);
      pdf.setFillColor(255, 243, 205);
      pdf.setFontSize(9);
      const cautionLines = pdf.splitTextToSize(`! ${step.caution}`, contentWidth - 10);
      pdf.rect(margin, y - 3, contentWidth, cautionLines.length * 5 + 6, 'F');
      pdf.setTextColor(180, 83, 9);
      pdf.text(cautionLines, margin + 5, y + 2);
      pdf.setTextColor(0, 0, 0);
      y += cautionLines.length * 5 + 8;
    }

    // Video URL
    if (step.videoUrl) {
      checkPageBreak(10);
      pdf.setFontSize(9);
      pdf.setTextColor(37, 99, 235);
      pdf.textWithLink(`Video: ${step.videoUrl}`, margin, y, { url: step.videoUrl });
      pdf.setTextColor(0, 0, 0);
      y += 8;
    }

    y += 5;
  }

  pdf.save(`${instruction.title}.pdf`);
}
