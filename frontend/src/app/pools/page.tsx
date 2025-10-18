import React, { Suspense } from 'react';
import { Box, Container } from '@mui/material';
import Client from './Client';

export default function PoolsPage() {
  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '60vh' }}>
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Suspense fallback={null}>
          <Client />
        </Suspense>
      </Container>
    </Box>
  );
}
