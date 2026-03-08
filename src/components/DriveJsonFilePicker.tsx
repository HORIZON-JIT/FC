'use client';

import { useState } from 'react';
import { DriveFolder, DriveFileInfo, getTargetFolder, listJsonFilesInFolder, downloadDriveFile } from '@/lib/googleDrive';
import DriveFolderPicker from './DriveFolderPicker';

interface DriveJsonFilePickerProps {
  open: boolean;
  onClose: () => void;
  onFileLoaded: (content: string, fileName: string) => void;
}

export default function DriveJsonFilePicker({ open, onClose, onFileLoaded }: DriveJsonFilePickerProps) {
  const [showFolderPicker, setShowFolderPicker] = useState(true);
  const [selectedFolder, setSelectedFolder] = useState<DriveFolder | null>(null);
  const [files, setFiles] = useState<DriveFileInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFolderSelected = async (folder: DriveFolder | null) => {
    setShowFolderPicker(false);
    const targetFolder = folder || getTargetFolder();
    if (!targetFolder) {
      setError('フォルダが選択されていません');
      return;
    }
    setSelectedFolder(targetFolder);
    setLoading(true);
    setError(null);
    try {
      const jsonFiles = await listJsonFilesInFolder(targetFolder.id);
      setFiles(jsonFiles);
      if (jsonFiles.length === 0) {
        setError('このフォルダにJSONファイルがありません');
      }
    } catch (err) {
      console.error('Failed to list files:', err);
      setError('ファイル一覧の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (file: DriveFileInfo) => {
    setDownloading(file.id);
    setError(null);
    try {
      const content = await downloadDriveFile(file.id);
      handleClose();
      onFileLoaded(content, file.name);
    } catch (err) {
      console.error('Failed to download file:', err);
      setError('ファイルのダウンロードに失敗しました');
    } finally {
      setDownloading(null);
    }
  };

  const handleClose = () => {
    setShowFolderPicker(true);
    setSelectedFolder(null);
    setFiles([]);
    setError(null);
    setDownloading(null);
    onClose();
  };

  const handleBackToFolderPicker = () => {
    setShowFolderPicker(true);
    setSelectedFolder(null);
    setFiles([]);
    setError(null);
  };

  if (!open) return null;

  // Step 1: Folder selection
  if (showFolderPicker) {
    return (
      <DriveFolderPicker
        open={true}
        onClose={handleClose}
        onSelect={handleFolderSelected}
      />
    );
  }

  // Step 2: JSON file selection
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-800">JSONファイルを選択</h3>
          {selectedFolder && (
            <p className="text-xs text-gray-500 mt-1">
              フォルダ: <span className="font-medium text-emerald-700">{selectedFolder.name}</span>
            </p>
          )}
        </div>

        {/* File list */}
        <div className="flex-1 overflow-y-auto p-2 min-h-[200px]">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
              読み込み中...
            </div>
          ) : files.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
              JSONファイルがありません
            </div>
          ) : (
            <ul className="space-y-1">
              {files.map((file) => (
                <li key={file.id}>
                  <button
                    onClick={() => handleFileSelect(file)}
                    disabled={downloading !== null}
                    className="w-full text-left px-3 py-3 rounded-lg hover:bg-emerald-50 flex items-center gap-3 text-sm transition disabled:opacity-50"
                  >
                    <span className="text-emerald-500 text-lg shrink-0">
                      {downloading === file.id ? (
                        <span className="inline-block w-5 h-5 border-2 border-emerald-300 border-t-emerald-600 rounded-full animate-spin" />
                      ) : (
                        '{ }'
                      )}
                    </span>
                    <span className="text-gray-700 truncate">{file.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="px-4 py-2 text-sm text-red-600 text-center">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
          <button
            onClick={handleBackToFolderPicker}
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            フォルダ選択に戻る
          </button>
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition"
          >
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
}
