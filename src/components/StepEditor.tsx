'use client';

import { Step, getStepImages } from '@/types/instruction';
import { useRef, useCallback } from 'react';

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
  const pasteAreaRef = useRef<HTMLDivElement>(null);

  const images = getStepImages(step);

  const addImage = useCallback((dataUrl: string) => {
    onChange({
      ...step,
      imageDataUrl: undefined,
      imageDataUrls: [...images, dataUrl],
    });
  }, [onChange, step, images]);

  const removeImage = useCallback((idx: number) => {
    const updated = images.filter((_, i) => i !== idx);
    onChange({
      ...step,
      imageDataUrl: undefined,
      imageDataUrls: updated.length > 0 ? updated : undefined,
    });
  }, [onChange, step, images]);

  const processImageFile = useCallback((file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      alert('画像サイズは5MB以下にしてください。');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      addImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  }, [addImage]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(processImageFile);
    // Reset so the same file can be selected again
    e.target.value = '';
  };

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) processImageFile(file);
        return;
      }
    }
  }, [processImageFile]);

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

        {/* Image upload / Screenshot paste */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            スクリーンショット・画像（任意・複数可）
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageUpload}
            className="hidden"
          />

          {/* Existing images */}
          {images.length > 0 && (
            <div className="space-y-2 mb-2">
              {images.map((imgUrl, imgIdx) => (
                <div key={imgIdx} className="relative group">
                  <div className="rounded border border-gray-200 overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imgUrl}
                      alt={`ステップ ${index + 1} の画像 ${imgIdx + 1}`}
                      className="max-w-full max-h-48 object-contain mx-auto"
                    />
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-400">画像 {imgIdx + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeImage(imgIdx)}
                      className="px-2 py-1 text-xs text-red-500 hover:text-red-700"
                    >
                      削除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add more images area */}
          <div
            ref={pasteAreaRef}
            onPaste={handlePaste}
            tabIndex={0}
            className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition focus:outline-none focus:border-blue-500 focus:bg-blue-50/50"
            onClick={() => fileInputRef.current?.click()}
          >
            <svg className="w-7 h-7 mx-auto mb-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm text-gray-500 font-medium">
              {images.length > 0 ? '画像を追加' : 'Ctrl+V でスクショを貼り付け'}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">またはクリックして画像を選択（複数可）</p>
          </div>
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
