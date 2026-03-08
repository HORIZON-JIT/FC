export interface Step {
  id: string;
  orderIndex: number;
  title: string;
  description: string;
  /** @deprecated Use imageDataUrls instead */
  imageDataUrl?: string;
  imageDataUrls?: string[];
  imageCaptions?: string[];
  videoUrl?: string;
  caution?: string;
}

/** Get all image data URLs for a step (handles legacy single-image field) */
export function getStepImages(step: Step): string[] {
  if (step.imageDataUrls && step.imageDataUrls.length > 0) return step.imageDataUrls;
  if (step.imageDataUrl) return [step.imageDataUrl];
  return [];
}

/** Get caption for image at index */
export function getImageCaption(step: Step, index: number): string {
  return step.imageCaptions?.[index] ?? '';
}

export type Category = 'pc_work' | 'packing';

export interface UpdateHistoryEntry {
  updatedBy: string;
  updatedAt: string;
  note?: string;
}

export interface WorkInstruction {
  id: string;
  title: string;
  category: Category;
  description: string;
  steps: Step[];
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
  updateHistory?: UpdateHistoryEntry[];
}

export const CATEGORY_LABELS: Record<Category, string> = {
  pc_work: 'PC事務作業',
  packing: '梱包作業',
};
