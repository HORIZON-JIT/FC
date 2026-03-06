'use client';

import { useEffect, useState } from 'react';
import {
  GoogleAuthState,
  isGoogleConfigured,
  addAuthListener,
  getAuthState,
} from '@/lib/googleAuth';
import { saveInstructionsToDrive, loadInstructionsFromDrive } from '@/lib/googleDrive';
import { getAllInstructions } from '@/lib/storage';
import { WorkInstruction } from '@/types/instruction';

interface DriveSyncButtonsProps {
  onDataLoaded: (instructions: WorkInstruction[]) => void;
}

export default function DriveSyncButtons({ onDataLoaded }: DriveSyncButtonsProps) {
  const [auth, setAuth] = useState<GoogleAuthState>(getAuthState());
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (!isGoogleConfigured()) return;
    return addAuthListener(setAuth);
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
      setMessage({ text: `${instructions.length}件の手順書をDriveに保存しました`, type: 'success' });
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
      // Save to localStorage
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

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleSave}
        disabled={saving || loading}
        className="px-3 py-2 bg-yellow-500 text-white rounded-lg text-sm font-medium hover:bg-yellow-600 transition disabled:opacity-50"
      >
        {saving ? '保存中...' : 'Driveに保存'}
      </button>
      <button
        onClick={handleLoad}
        disabled={saving || loading}
        className="px-3 py-2 bg-yellow-100 text-yellow-800 border border-yellow-300 rounded-lg text-sm font-medium hover:bg-yellow-200 transition disabled:opacity-50"
      >
        {loading ? '読み込み中...' : 'Driveから読み込み'}
      </button>
      {message && (
        <span
          className={`text-sm ${
            message.type === 'success' ? 'text-green-600' : 'text-red-600'
          }`}
        >
          {message.text}
        </span>
      )}
    </div>
  );
}
