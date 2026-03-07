'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { WorkInstruction, CATEGORY_LABELS, getStepImages } from '@/types/instruction';
import { getInstruction, deleteInstruction, importInstruction } from '@/lib/storage';
import { exportToPdf, buildPdfBuffer } from '@/lib/exportPdf';
import { exportToExcel, buildExcelBuffer } from '@/lib/exportSpreadsheet';
import { exportToWord } from '@/lib/exportWord';
import { generateShareUrl, parseShareData, getViewPageBaseUrl, ShareResult } from '@/lib/shareLink';
import ShareLinkModal from '@/components/ShareLinkModal';
import { saveFileToDrive, getTargetFolder } from '@/lib/googleDrive';
import { isGoogleConfigured, getAuthState, addAuthListener, GoogleAuthState } from '@/lib/googleAuth';

function getYouTubeEmbedUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    let videoId: string | null = null;
    if (parsed.hostname.includes('youtube.com')) {
      videoId = parsed.searchParams.get('v');
    } else if (parsed.hostname === 'youtu.be') {
      videoId = parsed.pathname.slice(1);
    }
    return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
  } catch {
    return null;
  }
}

function InstructionViewContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [instruction, setInstruction] = useState<WorkInstruction | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSharedView, setIsSharedView] = useState(false);
  const [shareResult, setShareResult] = useState<ShareResult | null>(null);
  const [auth, setAuth] = useState<GoogleAuthState>(getAuthState());
  const [driveSaving, setDriveSaving] = useState(false);
  const [driveMessage, setDriveMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (!isGoogleConfigured()) return;
    return addAuthListener(setAuth);
  }, []);

  useEffect(() => {
    if (!driveMessage) return;
    const timer = setTimeout(() => setDriveMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [driveMessage]);

  useEffect(() => {
    // Priority 1: shared data in hash fragment
    if (window.location.hash) {
      const shared = parseShareData(window.location.hash);
      if (shared) {
        setInstruction(shared);
        setIsSharedView(true);
        setLoading(false);
        return;
      }
    }

    // Priority 2: load from localStorage by id
    const id = searchParams.get('id');
    if (id) {
      const data = getInstruction(id);
      setInstruction(data || null);
    }
    setLoading(false);
  }, [searchParams]);

  const handleDelete = () => {
    if (!instruction) return;
    if (!confirm(`「${instruction.title}」を削除しますか？`)) return;
    deleteInstruction(instruction.id);
    router.push('/');
  };

  const handlePrint = () => {
    window.print();
  };

  const handleShare = () => {
    if (!instruction) return;
    const baseUrl = getViewPageBaseUrl();
    const result = generateShareUrl(instruction, baseUrl);
    setShareResult(result);
  };

  const handlePdfToDrive = async () => {
    if (!instruction) return;
    setDriveSaving(true);
    setDriveMessage(null);
    try {
      const buffer = await buildPdfBuffer(instruction);
      const fileName = `${instruction.title}.pdf`;
      await saveFileToDrive(buffer, fileName, 'application/pdf');
      const folderName = getTargetFolder()?.name || 'WorkInstructions';
      setDriveMessage({ text: `「${folderName}」に保存しました`, type: 'success' });
    } catch (err) {
      console.error('Drive PDF save error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      setDriveMessage({ text: `Driveへの保存に失敗しました: ${msg}`, type: 'error' });
    } finally {
      setDriveSaving(false);
    }
  };

  const handlePdfExport = async () => {
    if (!instruction) return;
    setDriveMessage(null);
    try {
      await exportToPdf(instruction);
    } catch (err) {
      console.error('PDF export error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      setDriveMessage({ text: `PDF出力に失敗しました: ${msg}`, type: 'error' });
    }
  };

  const handleExcelToDrive = async () => {
    if (!instruction) return;
    setDriveSaving(true);
    try {
      const buffer = await buildExcelBuffer(instruction);
      const fileName = `${instruction.title}_手順書.xlsx`;
      await saveFileToDrive(
        buffer,
        fileName,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      const folderName = getTargetFolder()?.name || 'WorkInstructions';
      setDriveMessage({ text: `「${folderName}」に保存しました`, type: 'success' });
    } catch (err) {
      console.error('Drive Excel save error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      setDriveMessage({ text: `Driveへの保存に失敗しました: ${msg}`, type: 'error' });
    } finally {
      setDriveSaving(false);
    }
  };

  const handleImport = () => {
    if (!instruction) return;
    const newId = importInstruction(instruction);
    // Navigate to the local copy
    window.location.hash = '';
    router.push(`/instructions/view?id=${newId}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-gray-500">読み込み中...</p>
      </div>
    );
  }

  if (!instruction) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <p className="text-gray-500 text-lg">手順書が見つかりません</p>
        <Link href="/" className="text-blue-600 hover:text-blue-800">
          一覧に戻る
        </Link>
      </div>
    );
  }

  const sortedSteps = [...instruction.steps].sort((a, b) => a.orderIndex - b.orderIndex);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Shared view banner */}
      {isSharedView && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg px-4 py-3 mb-4 flex items-center justify-between no-print">
          <p className="text-sm text-purple-800">
            共有された手順書を閲覧しています
          </p>
          <button
            onClick={handleImport}
            className="px-3 py-1.5 bg-purple-600 text-white rounded text-sm hover:bg-purple-700 transition"
          >
            インポートして保存
          </button>
        </div>
      )}

      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-2 mb-6 no-print">
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">
          &larr; 一覧に戻る
        </Link>
        <div className="flex-1" />
        <button
          onClick={handlePrint}
          className="px-3 py-1.5 bg-gray-100 border border-gray-300 rounded text-sm hover:bg-gray-200 transition"
        >
          印刷
        </button>
        <button
          onClick={handlePdfExport}
          className="px-3 py-1.5 bg-red-50 border border-red-200 text-red-700 rounded text-sm hover:bg-red-100 transition"
        >
          PDF出力
        </button>
        {isGoogleConfigured() && auth.isSignedIn && (
          <button
            onClick={handlePdfToDrive}
            disabled={driveSaving}
            className="px-3 py-1.5 bg-yellow-50 border border-yellow-300 text-yellow-800 rounded text-sm hover:bg-yellow-100 transition disabled:opacity-50"
          >
            {driveSaving ? '保存中...' : 'PDFをDriveに保存'}
          </button>
        )}
        <button
          onClick={() => exportToExcel(instruction)}
          className="px-3 py-1.5 bg-green-50 border border-green-200 text-green-700 rounded text-sm hover:bg-green-100 transition"
        >
          Excel出力
        </button>
        {isGoogleConfigured() && auth.isSignedIn && (
          <button
            onClick={handleExcelToDrive}
            disabled={driveSaving}
            className="px-3 py-1.5 bg-yellow-50 border border-yellow-300 text-yellow-800 rounded text-sm hover:bg-yellow-100 transition disabled:opacity-50"
          >
            {driveSaving ? '保存中...' : 'ExcelをDriveに保存'}
          </button>
        )}
        <button
          onClick={() => exportToWord(instruction)}
          className="px-3 py-1.5 bg-blue-50 border border-blue-200 text-blue-700 rounded text-sm hover:bg-blue-100 transition"
        >
          Word出力
        </button>
        {!isSharedView && (
          <>
            <button
              onClick={handleShare}
              className="px-3 py-1.5 bg-purple-50 border border-purple-200 text-purple-700 rounded text-sm hover:bg-purple-100 transition"
            >
              共有リンク生成
            </button>
            <Link
              href={`/instructions/edit?id=${instruction.id}`}
              className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition"
            >
              編集
            </Link>
            <button
              onClick={handleDelete}
              className="px-3 py-1.5 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition"
            >
              削除
            </button>
          </>
        )}
        {driveMessage && (
          <span className={`text-sm ${driveMessage.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
            {driveMessage.text}
          </span>
        )}
      </div>

      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-start justify-between gap-3 mb-3">
          <h1 className="text-2xl font-bold text-gray-800">{instruction.title}</h1>
          <span
            className={`shrink-0 text-sm px-3 py-1 rounded-full font-medium ${
              instruction.category === 'pc_work'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-orange-100 text-orange-700'
            }`}
          >
            {CATEGORY_LABELS[instruction.category]}
          </span>
        </div>
        {instruction.description && (
          <p className="text-gray-600 mb-4">{instruction.description}</p>
        )}
        <div className="text-xs text-gray-400 flex gap-4">
          <span>作成日: {new Date(instruction.createdAt).toLocaleDateString('ja-JP')}</span>
          <span>更新日: {new Date(instruction.updatedAt).toLocaleDateString('ja-JP')}</span>
          <span>{instruction.steps.length} ステップ</span>
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-4">
        {sortedSteps.map((step, index) => (
          <div
            key={step.id}
            className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
          >
            <div className="bg-blue-50 px-4 py-3 border-b border-blue-100">
              <div className="flex items-center gap-3">
                <span className="flex items-center justify-center w-8 h-8 bg-blue-600 text-white rounded-full font-bold text-sm shrink-0">
                  {index + 1}
                </span>
                <h2 className="font-bold text-gray-800">{step.title}</h2>
              </div>
            </div>

            <div className="p-4 space-y-4">
              {step.description && (
                <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {step.description}
                </p>
              )}

              {getStepImages(step).map((imgUrl, imgIdx) => (
                <div key={imgIdx} className="rounded border border-gray-200 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imgUrl}
                    alt={`ステップ ${index + 1} の画像 ${imgIdx + 1}`}
                    className="max-w-full h-auto mx-auto"
                  />
                </div>
              ))}

              {step.videoUrl && (
                <div>
                  {getYouTubeEmbedUrl(step.videoUrl) ? (
                    <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                      <iframe
                        src={getYouTubeEmbedUrl(step.videoUrl)!}
                        title={`ステップ ${index + 1} の動画`}
                        className="absolute inset-0 w-full h-full rounded"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  ) : (
                    <a
                      href={step.videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      動画を再生
                    </a>
                  )}
                </div>
              )}

              {step.caution && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3">
                  <p className="text-sm text-yellow-800 font-medium">
                    ⚠ 注意: {step.caution}
                  </p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Share Link Modal */}
      {shareResult && (
        <ShareLinkModal
          url={shareResult.url}
          imagesIncluded={shareResult.imagesIncluded}
          onClose={() => setShareResult(null)}
        />
      )}
    </div>
  );
}

export default function InstructionViewPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[50vh]"><p className="text-gray-500">読み込み中...</p></div>}>
      <InstructionViewContent />
    </Suspense>
  );
}
