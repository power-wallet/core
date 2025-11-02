'use client';

import React from 'react';
import { Tabs, Tab, Box } from '@mui/material';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function DocsTabs() {
  const pathname = usePathname();
  const val = React.useMemo(() => {
    if (!pathname) return 0;
    if (pathname.includes('/docs/getting-started')) return 0;
    if (pathname.includes('/docs/concepts')) return 1;
    return 2; // tech
  }, [pathname]);

  return (
    <Box sx={{ mb: 2 }}>
      <Tabs value={val} variant="scrollable" scrollButtons allowScrollButtonsMobile>
        <Tab label="Getting started" component={Link} href="/docs/getting-started" />
        <Tab label="Concepts" component={Link} href="/docs/concepts" />
        <Tab label="Tech" component={Link} href="/docs/tech" />
      </Tabs>
    </Box>
  );
}


