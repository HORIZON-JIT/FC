'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { WorkInstruction } from '@/types/instruction';
import { getInstruction } from '@/lib/storage';
import InstructionForm from '@/components/InstructionForm';

export default function EditInstructionPage() {
  const params = useParams();
  const [instruction, setInstruction] = useState<WorkInstruction | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = params.id as string;
    const data = getInstruction(id);
    setInstruction(data || null);
    setLoading(false);
  }, [params.id]);

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

  return <InstructionForm initialData={instruction} />;
}
