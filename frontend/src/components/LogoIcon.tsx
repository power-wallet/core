'use client';

import React from 'react';

type Props = { size?: number };

export default function LogoIcon({ size = 28 }: Props) {
  const s = Math.max(16, Math.min(128, size));
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Power Wallet logo"
      style={{ display: 'block' }}
    >
      <defs>
        <linearGradient id="pwGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#FB923C" />
        </linearGradient>
      </defs>

      {/* Rounded-square badge background */}
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" fill="url(#pwGrad)" />

      {/* Lightning bolt only */}
      <path d="M13 5.8 L8.8 12.3 H12.2 L11 18.2 L15.2 11.7 H12.7 Z" fill="#FFFFFF" />
    </svg>
  );
}


