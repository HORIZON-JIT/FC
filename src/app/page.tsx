'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { WorkInstruction, Category, CATEGORY_LABELS } from '@/types/instruction';
import { getAllInstructions, deleteInstruction } from '@/lib/storage';
import { exportAllToExcel, buildAllExcelBuffer } from '@/lib/exportSpreadsheet';
import DriveSyncButtons from '@/components/DriveSyncButtons';
import { saveFileToDrive, getTargetFolder } from '@/lib/googleDrive';
import { isGoogleConfigured, getAuthState, addAuthListener, GoogleAuthState } from '@/lib/googleAuth';

export default function HomePage() {
  const [instructions, setInstructions] = useState<WorkInstruction[]>([]);
  const [filterCategory, setFilterCategory] = useState<Category | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [auth, setAuth] = useState<GoogleAuthState>(getAuthState());
  const [driveSaving, setDriveSaving] = useState(false);
  const [driveExcelMsg, setDriveExcelMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    setInstructions(getAllInstructions());
  }, []);

  useEffect(() => {
    if (!isGoogleConfigured()) return;
    return addAuthListener(setAuth);
  }, []);

  useEffect(() => {
    if (!driveExcelMsg) return;
    const timer = setTimeout(() => setDriveExcelMsg(null), 3000);
    return () => clearTimeout(timer);
  }, [driveExcelMsg]);

  const handleDelete = (id: string, title: string) => {
    if (!confirm(`「${title}」を削除しますか？`)) return;
    deleteInstruction(id);
    setInstructions(getAllInstructions());
  };

  const handleExcelAllToDrive = async () => {
    setDriveSaving(true);
    try {
      const buffer = await buildAllExcelBuffer(instructions);
      await saveFileToDrive(
        buffer,
        '作業手順書一覧.xlsx',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      const folderName = getTargetFolder()?.name || 'WorkInstructions';
      setDriveExcelMsg({ text: `「${folderName}」に保存しました`, type: 'success' });
    } catch (err) {
      console.error('Drive save error:', err);
      setDriveExcelMsg({ text: 'Driveへの保存に失敗しました', type: 'error' });
    } finally {
      setDriveSaving(false);
    }
  };

  const filtered = instructions
    .filter((inst) => filterCategory === 'all' || inst.category === filterCategory)
    .filter(
      (inst) =>
        !searchQuery ||
        inst.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inst.description.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Page header */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">手順書一覧</h1>
            <p className="text-sm text-slate-500 mt-1">
              {instructions.length > 0
                ? `${instructions.length} 件の手順書`
                : '手順書を作成して管理しましょう'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 no-print">
            <DriveSyncButtons onDataLoaded={(data) => setInstructions(data)} />
            {instructions.length > 0 && (
              <>
                <button
                  onClick={() => exportAllToExcel(instructions)}
                  className="px-3 py-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-xs sm:text-sm font-medium hover:bg-emerald-100 transition"
                >
                  Excel出力
                </button>
                {isGoogleConfigured() && auth.isSignedIn && (
                  <button
                    onClick={handleExcelAllToDrive}
                    disabled={driveSaving}
                    className="px-3 py-2 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-xs sm:text-sm font-medium hover:bg-amber-100 transition disabled:opacity-50"
                  >
                    {driveSaving ? '保存中...' : 'Driveに保存'}
                  </button>
                )}
                {driveExcelMsg && (
                  <span className={`text-xs sm:text-sm ${driveExcelMsg.type === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
                    {driveExcelMsg.text}
                  </span>
                )}
              </>
            )}
            <Link
              href="/instructions/new"
              className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-lg text-sm font-medium hover:from-blue-600 hover:to-indigo-600 transition shadow-sm"
            >
              + 新規作成
            </Link>
          </div>
        </div>

        {/* Search & filter bar */}
        <div className="flex flex-col sm:flex-row gap-3 no-print">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="キーワードで検索..."
              className="w-full border border-slate-200 rounded-lg pl-10 pr-3 py-2.5 text-sm bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition"
            />
          </div>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value as Category | 'all')}
            className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition"
          >
            <option value="all">すべてのカテゴリ</option>
            {(Object.entries(CATEGORY_LABELS) as [Category, string][]).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Instruction list */}
      {filtered.length === 0 ? (
        <div className="text-center py-20">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-100 rounded-2xl mb-5">
            <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-slate-500 text-lg mb-2">
            {instructions.length === 0
              ? '手順書がまだありません'
              : '検索条件に一致する手順書がありません'}
          </p>
          {instructions.length === 0 && (
            <>
              <p className="text-slate-400 text-sm mb-6">最初の手順書を作成して始めましょう</p>
              <Link
                href="/instructions/new"
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl font-medium hover:from-blue-600 hover:to-indigo-600 transition shadow-md"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                新規作成
              </Link>
            </>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((inst) => (
            <div
              key={inst.id}
              className="group bg-white rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-lg transition-all duration-200 overflow-hidden"
            >
              <Link href={`/instructions/view?id=${inst.id}`} className="block p-5">
                <div className="flex items-start justify-between gap-2 mb-2.5">
                  <h2 className="font-semibold text-slate-800 line-clamp-2 group-hover:text-blue-600 transition-colors">
                    {inst.title}
                  </h2>
                  <span
                    className={`shrink-0 text-xs px-2.5 py-0.5 rounded-full font-medium ${
                      inst.category === 'pc_work'
                        ? 'bg-blue-50 text-blue-600'
                        : 'bg-orange-50 text-orange-600'
                    }`}
                  >
                    {CATEGORY_LABELS[inst.category]}
                  </span>
                </div>
                {inst.description && (
                  <p className="text-sm text-slate-500 line-clamp-2 mb-3">{inst.description}</p>
                )}
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                    </svg>
                    {inst.steps.length} ステップ
                  </span>
                  <span>{new Date(inst.updatedAt).toLocaleDateString('ja-JP')}</span>
                </div>
              </Link>
              <div className="border-t border-slate-100 px-5 py-2.5 flex justify-end gap-3 no-print">
                <Link
                  href={`/instructions/edit?id=${inst.id}`}
                  className="text-xs text-slate-500 hover:text-blue-600 transition-colors font-medium"
                >
                  編集
                </Link>
                <button
                  onClick={() => handleDelete(inst.id, inst.title)}
                  className="text-xs text-slate-500 hover:text-red-600 transition-colors font-medium"
                >
                  削除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
