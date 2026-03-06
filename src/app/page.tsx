'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { WorkInstruction, Category, CATEGORY_LABELS } from '@/types/instruction';
import { getAllInstructions, deleteInstruction } from '@/lib/storage';
import { exportAllToExcel } from '@/lib/exportSpreadsheet';
import DriveSyncButtons from '@/components/DriveSyncButtons';

export default function HomePage() {
  const [instructions, setInstructions] = useState<WorkInstruction[]>([]);
  const [filterCategory, setFilterCategory] = useState<Category | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setInstructions(getAllInstructions());
  }, []);

  const handleDelete = (id: string, title: string) => {
    if (!confirm(`「${title}」を削除しますか？`)) return;
    deleteInstruction(id);
    setInstructions(getAllInstructions());
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
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Header area */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-800">手順書一覧</h1>
        <div className="flex flex-wrap gap-2 no-print">
          <DriveSyncButtons onDataLoaded={(data) => setInstructions(data)} />
          {instructions.length > 0 && (
            <button
              onClick={() => exportAllToExcel(instructions)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition"
            >
              一覧をExcel出力
            </button>
          )}
          <Link
            href="/instructions/new"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
          >
            + 新規作成
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6 no-print">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="キーワードで検索..."
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        />
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value as Category | 'all')}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
        >
          <option value="all">すべてのカテゴリ</option>
          {(Object.entries(CATEGORY_LABELS) as [Category, string][]).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Instruction list */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-400 text-5xl mb-4">📋</p>
          <p className="text-gray-500 text-lg mb-2">
            {instructions.length === 0
              ? '手順書がまだありません'
              : '検索条件に一致する手順書がありません'}
          </p>
          {instructions.length === 0 && (
            <Link
              href="/instructions/new"
              className="inline-block mt-4 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
            >
              最初の手順書を作成する
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((inst) => (
            <div
              key={inst.id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition overflow-hidden"
            >
              <Link href={`/instructions/view?id=${inst.id}`} className="block p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h2 className="font-bold text-gray-800 line-clamp-2">{inst.title}</h2>
                  <span
                    className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${
                      inst.category === 'pc_work'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-orange-100 text-orange-700'
                    }`}
                  >
                    {CATEGORY_LABELS[inst.category]}
                  </span>
                </div>
                {inst.description && (
                  <p className="text-sm text-gray-500 line-clamp-2 mb-3">{inst.description}</p>
                )}
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>{inst.steps.length} ステップ</span>
                  <span>{new Date(inst.updatedAt).toLocaleDateString('ja-JP')}</span>
                </div>
              </Link>
              <div className="border-t border-gray-100 px-4 py-2 flex justify-end gap-2 no-print">
                <Link
                  href={`/instructions/edit?id=${inst.id}`}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  編集
                </Link>
                <button
                  onClick={() => handleDelete(inst.id, inst.title)}
                  className="text-xs text-red-500 hover:text-red-700"
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
