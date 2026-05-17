'use client';

import { WorkInstruction } from '@/types/instruction';
import { useEffect, useRef, useState } from 'react';
import { buildFlowchartDefinition } from '@/lib/buildFlowchart';

interface Props {
  instruction: WorkInstruction;
  onClose: () => void;
}

export default function FlowchartModal({ instruction, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mermaidRef = useRef<string>('');
  const [mermaidCopied, setMermaidCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      try {
        const mermaidModule = await import('mermaid');
        const mermaid = mermaidModule.default;

        mermaid.initialize({
          startOnLoad: false,
          theme: 'default',
          flowchart: {
            useMaxWidth: false,
            htmlLabels: true,
            curve: 'linear',
            padding: 15,
          },
        });

        const definition = buildFlowchartDefinition(instruction);
        mermaidRef.current = definition;
        const { svg } = await mermaid.render(`fc-${Date.now()}`, definition);

        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg;
          const svgEl = containerRef.current.querySelector('svg');
          if (svgEl) {
            svgEl.style.maxWidth = '100%';
            svgEl.style.height = 'auto';
          }
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e ?? 'フロー図の生成に失敗しました'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    render();
    return () => { cancelled = true; };
  }, [instruction]);

  const copyMermaid = () => {
    navigator.clipboard.writeText(mermaidRef.current);
    setMermaidCopied(true);
    setTimeout(() => setMermaidCopied(false), 2000);
  };

  const downloadMermaid = () => {
    const blob = new Blob([mermaidRef.current], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${instruction.title}_フロー図.mmd`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white shadow-xl w-full h-full flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-bold text-gray-800">フロー図</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {loading && <p className="text-sm text-gray-500 text-center py-8">読み込み中...</p>}
          {error && <p className="text-sm text-red-600 text-center py-8">{error}</p>}
          <div ref={containerRef} className="flex justify-center" />
        </div>

        {!loading && !error && (
          <div className="flex items-center justify-end gap-2 px-6 py-3 border-t flex-wrap">
            <button
              onClick={copyMermaid}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-100 transition"
            >
              {mermaidCopied ? 'コピー済' : 'Mermaidコピー'}
            </button>
            <button
              onClick={downloadMermaid}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-100 transition"
            >
              Mermaid保存
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1.5 bg-slate-600 text-white rounded-lg text-sm hover:bg-slate-700 transition"
            >
              閉じる
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
