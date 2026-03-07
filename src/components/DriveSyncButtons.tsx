'use client';

import { useEffect, useState } from 'react';
import {
  GoogleAuthState,
  isGoogleConfigured,
  addAuthListener,
  getAuthState,
} from '@/lib/googleAuth';
import {
  saveInstructionsToDrive,
  loadInstructionsFromDrive,
  getTargetFolder,
  DriveFolder,
} from '@/lib/googleDrive';
import { getAllInstructions } from '@/lib/storage';
import { WorkInstruction } from '@/types/instruction';
import DriveFolderPicker from './DriveFolderPicker';

interface DriveSyncButtonsProps {
  onDataLoaded: (instructions: WorkInstruction[]) => void;
}

export default function DriveSyncButtons({ onDataLoaded }: DriveSyncButtonsProps) {
  const [auth, setAuth] = useState<GoogleAuthState>(getAuthState());
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [targetFolder, setTargetFolderState] = useState<DriveFolder | null>(null);

  useEffect(() => {
    if (!isGoogleConfigured()) return;
    return addAuthListener(setAuth);
  }, []);

  useEffect(() => {
    setTargetFolderState(getTargetFolder());
  }, []);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [message]);

  if (!isGoogleConfigured() || !auth.isSignedIn) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      const instructions = getAllInstructions();
      await saveInstructionsToDrive(instructions);
      const folderName = targetFolder?.name || 'WorkInstructions';
      setMessage({ text: `${instructions.length}件を「${folderName}」に保存しました`, type: 'success' });
    } catch (err) {
      console.error('Drive save error:', err);
      setMessage({ text: 'Driveへの保存に失敗しました', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleLoad = async () => {
    if (!confirm('Driveのデータでローカルデータを上書きします。よろしいですか？')) return;
    setLoading(true);
    try {
      const data = await loadInstructionsFromDrive();
      if (data === null) {
        setMessage({ text: 'Driveにデータが見つかりません', type: 'error' });
        return;
      }
      localStorage.setItem('work_instructions', JSON.stringify(data));
      onDataLoaded(data);
      setMessage({ text: `${data.length}件の手順書をDriveから読み込みました`, type: 'success' });
    } catch (err) {
      console.error('Drive load error:', err);
      setMessage({ text: 'Driveからの読み込みに失敗しました', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleFolderSelect = (folder: DriveFolder | null) => {
    setTargetFolderState(folder);
  };

  return (
    <>
      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
        <button
          onClick={() => setPickerOpen(true)}
          className="px-2 sm:px-3 py-1.5 sm:py-2 bg-gray-100 text-gray-700 border border-gray-300 rounded-lg text-xs sm:text-sm font-medium hover:bg-gray-200 transition flex items-center gap-1"
          title={targetFolder ? `保存先: ${targetFolder.name}` : '保存先: WorkInstructions（デフォルト）'}
        >
          <span>📁</span>
          <span className="max-w-[80px] sm:max-w-[120px] truncate">
            {targetFolder ? targetFolder.name : 'WorkInstructions'}
          </span>
        </button>
        <button
          onClick={handleSave}
          disabled={saving || loading}
          className="px-2 sm:px-3 py-1.5 sm:py-2 bg-yellow-500 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-yellow-600 transition disabled:opacity-50"
        >
          {saving ? '保存中...' : 'Driveに保存'}
        </button>
        <button
          onClick={handleLoad}
          disabled={saving || loading}
          className="px-2 sm:px-3 py-1.5 sm:py-2 bg-yellow-100 text-yellow-800 border border-yellow-300 rounded-lg text-xs sm:text-sm font-medium hover:bg-yellow-200 transition disabled:opacity-50"
        >
          {loading ? '読み込み中...' : 'Driveから読み込み'}
        </button>
        {message && (
          <span
            className={`text-xs sm:text-sm ${
              message.type === 'success' ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {message.text}
          </span>
        )}
      </div>
      <DriveFolderPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleFolderSelect}
      />
    </>
  );
}
