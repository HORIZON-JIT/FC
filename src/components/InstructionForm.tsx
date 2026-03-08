'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { WorkInstruction, Step, Category, CATEGORY_LABELS, UpdateHistoryEntry, InstructionStatus } from '@/types/instruction';
import { saveInstruction } from '@/lib/storage';
import { buildExcelBuffer } from '@/lib/exportSpreadsheet';
import { saveFileToDrive, getTargetFolder } from '@/lib/googleDrive';
import { isGoogleConfigured, getAuthState } from '@/lib/googleAuth';
import StepEditor from './StepEditor';

const LAST_AUTHOR_KEY = 'last_author_name';

interface InstructionFormProps {
  initialData?: WorkInstruction;
}

function createEmptyStep(orderIndex: number): Step {
  return {
    id: uuidv4(),
    orderIndex,
    title: '',
    description: '',
  };
}

function getLastAuthorName(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(LAST_AUTHOR_KEY) || '';
}

function saveLastAuthorName(name: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(LAST_AUTHOR_KEY, name);
  }
}

function downloadJson(instruction: WorkInstruction) {
  const json = JSON.stringify(instruction, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${instruction.title || '手順書'}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function InstructionForm({ initialData }: InstructionFormProps) {
  const router = useRouter();
  const isEdit = !!initialData;

  const [title, setTitle] = useState(initialData?.title || '');
  const [category, setCategory] = useState<Category>(initialData?.category || 'pc_work');
  const [description, setDescription] = useState(initialData?.description || '');
  const [steps, setSteps] = useState<Step[]>(
    initialData?.steps?.length ? initialData.steps : [createEmptyStep(0)]
  );
  const [authorName, setAuthorName] = useState(
    initialData?.updatedBy || initialData?.createdBy || getLastAuthorName()
  );
  const [updateNote, setUpdateNote] = useState('');

  const handleAddStep = () => {
    setSteps([...steps, createEmptyStep(steps.length)]);
  };

  const handleStepChange = (index: number, updatedStep: Step) => {
    const newSteps = [...steps];
    newSteps[index] = updatedStep;
    setSteps(newSteps);
  };

  const handleRemoveStep = (index: number) => {
    if (steps.length <= 1) {
      alert('最低1つのステップが必要です。');
      return;
    }
    const newSteps = steps
      .filter((_, i) => i !== index)
      .map((s, i) => ({ ...s, orderIndex: i }));
    setSteps(newSteps);
  };

  const handleMoveStep = (index: number, direction: 'up' | 'down') => {
    const newSteps = [...steps];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newSteps.length) return;
    [newSteps[index], newSteps[targetIndex]] = [newSteps[targetIndex], newSteps[index]];
    setSteps(newSteps.map((s, i) => ({ ...s, orderIndex: i })));
  };

  const buildInstruction = (status: InstructionStatus): WorkInstruction | null => {
    if (!title.trim()) {
      alert('タイトルを入力してください。');
      return null;
    }

    // For completion, validate all steps and author
    if (status === 'completed') {
      if (steps.some((s) => !s.title.trim())) {
        alert('すべてのステップにタイトルを入力してください。');
        return null;
      }
      if (!authorName.trim()) {
        alert(isEdit ? '更新者名を入力してください。' : '作成者名を入力してください。');
        return null;
      }
    }

    const trimmedName = authorName.trim();
    if (trimmedName) {
      saveLastAuthorName(trimmedName);
    }

    const now = new Date().toISOString();

    let updateHistory: UpdateHistoryEntry[] = initialData?.updateHistory || [];
    if (isEdit && trimmedName) {
      const entry: UpdateHistoryEntry = {
        updatedBy: trimmedName,
        updatedAt: now,
      };
      if (updateNote.trim()) {
        entry.note = updateNote.trim();
      }
      updateHistory = [...updateHistory, entry];
    }

    return {
      id: initialData?.id || uuidv4(),
      title: title.trim(),
      category,
      description: description.trim(),
      steps,
      createdAt: initialData?.createdAt || now,
      updatedAt: now,
      createdBy: initialData?.createdBy || trimmedName || undefined,
      updatedBy: isEdit && trimmedName ? trimmedName : initialData?.updatedBy,
      updateHistory: updateHistory.length > 0 ? updateHistory : undefined,
      status,
    };
  };

  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const handleDraftSave = () => {
    const instruction = buildInstruction('draft');
    if (!instruction) return;

    try {
      saveInstruction(instruction);
    } catch (e) {
      alert(e instanceof Error ? e.message : '保存に失敗しました。');
      return;
    }
    router.push('/instructions/drafts');
  };

  const handleComplete = async () => {
    const instruction = buildInstruction('completed');
    if (!instruction) return;

    // Save locally first
    try {
      saveInstruction(instruction);
    } catch (e) {
      alert(e instanceof Error ? e.message : '保存に失敗しました。');
      return;
    }

    // Upload to Google Drive
    const auth = getAuthState();
    if (isGoogleConfigured() && auth.isSignedIn) {
      setSaving(true);
      setSaveMessage(null);
      try {
        // Upload Excel
        const excelBuffer = await buildExcelBuffer(instruction);
        await saveFileToDrive(
          excelBuffer,
          `${instruction.title}_手順書.xlsx`,
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        );
        // Upload JSON
        const jsonStr = JSON.stringify(instruction, null, 2);
        const jsonBuffer = new TextEncoder().encode(jsonStr).buffer;
        await saveFileToDrive(
          jsonBuffer,
          `${instruction.title}.json`,
          'application/json',
        );
        const folderName = getTargetFolder()?.name || 'WorkInstructions';
        setSaveMessage({ text: `「${folderName}」にExcel・JSONを保存しました`, type: 'success' });
      } catch (err) {
        console.error('Drive save error:', err);
        const msg = err instanceof Error ? err.message : String(err);
        setSaveMessage({ text: `Driveへの保存に失敗: ${msg}`, type: 'error' });
        // Still download JSON locally as fallback
        downloadJson(instruction);
      } finally {
        setSaving(false);
      }
    } else {
      // No Google auth — download JSON locally
      downloadJson(instruction);
    }

    router.push(`/instructions/view?id=${instruction.id}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleComplete();
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">
        {isEdit ? '手順書を編集' : '新規手順書作成'}
      </h1>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            タイトル <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            placeholder="例: 出荷伝票の作成手順"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            カテゴリ <span className="text-red-500">*</span>
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
            className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
          >
            {(Object.entries(CATEGORY_LABELS) as [Category, string][]).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {isEdit ? '更新者名' : '作成者名'} <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            placeholder={isEdit ? '更新者の名前を入力' : '作成者の名前を入力'}
          />
        </div>

        {isEdit && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              更新メモ <span className="text-gray-400 font-normal">(任意)</span>
            </label>
            <input
              type="text"
              value={updateNote}
              onChange={(e) => setUpdateNote(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              placeholder="例: ステップ3の画像を更新"
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">概要</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-y"
            placeholder="この手順書の概要を記入してください"
          />
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-gray-700">手順ステップ</h2>
        {steps.map((step, index) => (
          <StepEditor
            key={step.id}
            step={step}
            index={index}
            totalSteps={steps.length}
            onChange={(s) => handleStepChange(index, s)}
            onRemove={() => handleRemoveStep(index)}
            onMoveUp={() => handleMoveStep(index, 'up')}
            onMoveDown={() => handleMoveStep(index, 'down')}
          />
        ))}

        <button
          type="button"
          onClick={handleAddStep}
          className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-blue-400 hover:text-blue-500 transition font-medium"
        >
          + ステップを追加
        </button>
      </div>

      {/* Actions */}
      <div className="space-y-3 pt-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={handleDraftSave}
            disabled={saving}
            className="flex-1 py-3.5 bg-amber-50 border-2 border-amber-300 text-amber-700 rounded-xl font-bold text-lg hover:bg-amber-100 transition disabled:opacity-50"
          >
            下書き保存
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 py-3.5 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-xl font-bold text-lg hover:from-emerald-600 hover:to-green-700 transition shadow-md disabled:opacity-50"
          >
            {saving ? '保存中...' : '完成'}
          </button>
        </div>
        <button
          type="button"
          onClick={() => router.back()}
          className="w-full py-2.5 text-sm text-gray-500 hover:text-gray-700 transition"
        >
          キャンセル
        </button>
        {saveMessage && (
          <p className={`text-sm text-center ${saveMessage.type === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
            {saveMessage.text}
          </p>
        )}
        <p className="text-xs text-slate-400 text-center">
          「完成」を押すとGoogleドライブにExcel・JSONを出力します
        </p>
      </div>
    </form>
  );
}
