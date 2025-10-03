'use client';

import React, { Suspense } from 'react';
import WalletDetails from './WalletDetails';

export default function WalletEntry() {
  return (
    <Suspense fallback={null}>
      <WalletDetails />
    </Suspense>
  );
}


