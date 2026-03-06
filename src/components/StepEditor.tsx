'use client';

import { Step } from '@/types/instruction';
import { useRef } from 'react';

interface StepEditorProps {
  step: Step;
  index: number;
  totalSteps: number;
  onChange: (step: Step) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

export default function StepEditor({
  step,
  index,
  totalSteps,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: StepEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('画像サイズは5MB以下にしてください。');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      onChange({ ...step, imageDataUrl: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-blue-600">ステップ {index + 1}</h3>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={index === 0}
            className="p-1 text-gray-500 hover:text-blue-600 disabled:opacity-30"
            title="上へ移動"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={index === totalSteps - 1}
            className="p-1 text-gray-500 hover:text-blue-600 disabled:opacity-30"
            title="下へ移動"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="p-1 text-red-400 hover:text-red-600 ml-2"
            title="削除"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">タイトル</label>
          <input
            type="text"
            value={step.title}
            onChange={(e) => onChange({ ...step, title: e.target.value })}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            placeholder="例: システムにログインする"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">説明</label>
          <textarea
            value={step.description}
            onChange={(e) => onChange({ ...step, description: e.target.value })}
            rows={3}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-y"
            placeholder="手順の詳細を記入してください"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">注意事項（任意）</label>
          <input
            type="text"
            value={step.caution || ''}
            onChange={(e) => onChange({ ...step, caution: e.target.value })}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none"
            placeholder="注意すべきポイントがあれば記入"
          />
        </div>

        {/* Image upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">画像（任意）</label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 bg-gray-100 border border-gray-300 rounded text-sm hover:bg-gray-200 transition"
            >
              画像を選択
            </button>
            {step.imageDataUrl && (
              <button
                type="button"
                onClick={() => onChange({ ...step, imageDataUrl: undefined })}
                className="text-sm text-red-500 hover:text-red-700"
              >
                画像を削除
              </button>
            )}
          </div>
          {step.imageDataUrl && (
            <div className="mt-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={step.imageDataUrl}
                alt={`ステップ ${index + 1} の画像`}
                className="max-w-full max-h-48 rounded border border-gray-200 object-contain"
              />
            </div>
          )}
        </div>

        {/* Video URL */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">動画URL（任意）</label>
          <input
            type="url"
            value={step.videoUrl || ''}
            onChange={(e) => onChange({ ...step, videoUrl: e.target.value })}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            placeholder="https://www.youtube.com/watch?v=..."
          />
        </div>
      </div>
    </div>
  );
}
