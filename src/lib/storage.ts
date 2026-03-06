import { WorkInstruction } from '@/types/instruction';

const STORAGE_KEY = 'work_instructions';

export function getAllInstructions(): WorkInstruction[] {
  if (typeof window === 'undefined') return [];
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) return [];
  try {
    return JSON.parse(data) as WorkInstruction[];
  } catch {
    return [];
  }
}

export function getInstruction(id: string): WorkInstruction | undefined {
  return getAllInstructions().find((inst) => inst.id === id);
}

export function saveInstruction(instruction: WorkInstruction): void {
  const all = getAllInstructions();
  const index = all.findIndex((inst) => inst.id === instruction.id);
  if (index >= 0) {
    all[index] = instruction;
  } else {
    all.push(instruction);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function deleteInstruction(id: string): void {
  const all = getAllInstructions().filter((inst) => inst.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function importInstruction(instruction: WorkInstruction): string {
  const existing = getInstruction(instruction.id);
  if (existing) {
    const newId = crypto.randomUUID();
    const imported = { ...instruction, id: newId };
    saveInstruction(imported);
    return newId;
  }
  saveInstruction(instruction);
  return instruction.id;
}
