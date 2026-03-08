'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { WorkInstruction } from '@/types/instruction';
import { saveInstruction } from '@/lib/storage';
import DriveSyncButtons from '@/components/DriveSyncButtons';

export default function HomePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    if (!importError) return;
    const timer = setTimeout(() => setImportError(null), 5000);
    return () => clearTimeout(timer);
  }, [importError]);

  const handleJsonImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so same file can be selected again
    e.target.value = '';

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string);
        // Validate required fields
        if (!json.id || !json.title || !json.steps || !Array.isArray(json.steps)) {
          throw new Error('無効な手順書データです。');
        }
        const instruction = json as WorkInstruction;
        // Mark as completed (imported for update)
        instruction.status = 'completed';
        saveInstruction(instruction);
        router.push(`/instructions/edit?id=${instruction.id}`);
      } catch (err) {
        setImportError(err instanceof Error ? err.message : 'JSONファイルの読み込みに失敗しました。');
      }
    };
    reader.onerror = () => {
      setImportError('ファイルの読み込みに失敗しました。');
    };
    reader.readAsText(file);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Hero section */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl mb-5 shadow-lg">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-slate-800 tracking-tight mb-2">手順書作成システム</h1>
        <p className="text-slate-500">作業手順書の作成・更新を行います</p>
      </div>

      {/* 3 workflow buttons */}
      <div className="grid gap-6 sm:grid-cols-3 mb-8">
        {/* 新規作成 */}
        <Link
          href="/instructions/new"
          className="group relative bg-white rounded-2xl border-2 border-slate-200 hover:border-blue-400 p-8 text-center transition-all duration-200 hover:shadow-xl"
        >
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-50 group-hover:bg-blue-100 rounded-xl mb-4 transition">
            <svg className="w-7 h-7 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-slate-800 mb-2">新規作成</h2>
          <p className="text-sm text-slate-500">1から手順書を作成します</p>
        </Link>

        {/* 途中から編集 */}
        <Link
          href="/instructions/drafts"
          className="group relative bg-white rounded-2xl border-2 border-slate-200 hover:border-amber-400 p-8 text-center transition-all duration-200 hover:shadow-xl"
        >
          <div className="inline-flex items-center justify-center w-14 h-14 bg-amber-50 group-hover:bg-amber-100 rounded-xl mb-4 transition">
            <svg className="w-7 h-7 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-slate-800 mb-2">途中から編集</h2>
          <p className="text-sm text-slate-500">下書きの編集を再開</p>
        </Link>

        {/* 手順書更新 */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="group relative bg-white rounded-2xl border-2 border-slate-200 hover:border-emerald-400 p-8 text-center transition-all duration-200 hover:shadow-xl cursor-pointer"
        >
          <div className="inline-flex items-center justify-center w-14 h-14 bg-emerald-50 group-hover:bg-emerald-100 rounded-xl mb-4 transition">
            <svg className="w-7 h-7 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-slate-800 mb-2">手順書更新</h2>
          <p className="text-sm text-slate-500">JSONを読み込んで更新</p>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleJsonImport}
          className="hidden"
        />
      </div>

      {/* Error message */}
      {importError && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {importError}
        </div>
      )}

      {/* Drive sync (secondary) */}
      <div className="flex justify-center">
        <DriveSyncButtons onDataLoaded={() => {}} />
      </div>
    </div>
  );
}
