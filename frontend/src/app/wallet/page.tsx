'use client';

import React from 'react';
import { useSearchParams } from 'next/navigation';
import WalletDetailsPage from './[address]/page';

export default function WalletEntry() {
  const params = useSearchParams();
  const address = params.get('address') as `0x${string}` | null;
  if (!address) return null;
  // Reuse details component by passing through Next dynamic param shape
  return <WalletDetailsPage />;
}


