export interface Step {
  id: string;
  orderIndex: number;
  title: string;
  description: string;
  imageDataUrl?: string;
  videoUrl?: string;
  caution?: string;
}

export type Category = 'pc_work' | 'packing';

export interface WorkInstruction {
  id: string;
  title: string;
  category: Category;
  description: string;
  steps: Step[];
  createdAt: string;
  updatedAt: string;
}

export const CATEGORY_LABELS: Record<Category, string> = {
  pc_work: 'PC事務作業',
  packing: '梱包作業',
};
