'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="bg-blue-600 text-white shadow-md">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold tracking-tight hover:opacity-90">
          作業手順書アプリ
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-4">
          <Link
            href="/"
            className="px-3 py-1.5 rounded hover:bg-blue-700 transition text-sm"
          >
            一覧
          </Link>
          <Link
            href="/instructions/new"
            className="px-4 py-1.5 bg-white text-blue-600 rounded font-medium hover:bg-blue-50 transition text-sm"
          >
            + 新規作成
          </Link>
        </nav>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-2"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="メニュー"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {menuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <nav className="md:hidden border-t border-blue-500 px-4 py-2 space-y-1">
          <Link
            href="/"
            className="block px-3 py-2 rounded hover:bg-blue-700 transition text-sm"
            onClick={() => setMenuOpen(false)}
          >
            一覧
          </Link>
          <Link
            href="/instructions/new"
            className="block px-3 py-2 rounded hover:bg-blue-700 transition text-sm"
            onClick={() => setMenuOpen(false)}
          >
            + 新規作成
          </Link>
        </nav>
      )}
    </header>
  );
}
