import React, { Suspense } from 'react';
import { Box, Container } from '@mui/material';
import Client from './Client';

export default function PoolsPage() {
  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', py: 4 }}>
      <Container maxWidth="lg">
        <Suspense fallback={null}>
          <Client />
        </Suspense>
      </Container>
    </Box>
  );
}
