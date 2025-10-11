'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import React from 'react';

const GA_MEASUREMENT_ID = 'G-6CNY1706RJ';

export default function GATracking() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  React.useEffect(() => {
    if (!pathname) return;
    const url = `${pathname}${searchParams?.toString() ? `?${searchParams.toString()}` : ''}`;
    try {
      (window as any)?.gtag?.('config', GA_MEASUREMENT_ID, { page_path: url });
    } catch {}
  }, [pathname, searchParams]);

  return null;
}


