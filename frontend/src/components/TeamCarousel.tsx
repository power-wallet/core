'use client';

import React from 'react';
import { Box, IconButton, Stack } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

const images: Array<{ src: string; alt: string }> = [
  { src: '/img/team/eth-global-hackaton.png', alt: 'ETH Global Hackathon' },
  { src: '/img/team/team_00.jpg', alt: 'Power Wallet Team 0' },
  { src: '/img/team/team_01.jpg', alt: 'Power Wallet Team 1' },
  { src: '/img/team/QSNCC.jpg', alt: 'QSNCC Venue' },
];

export default function TeamCarousel() {
  const [index, setIndex] = React.useState(0);
  const next = React.useCallback(() => setIndex((i) => (i + 1) % images.length), []);
  const prev = React.useCallback(() => setIndex((i) => (i - 1 + images.length) % images.length), []);

  return (
    <Box sx={{ position: 'relative', width: '100%', maxWidth: 720, mx: 'auto' }}>
      <Box
        component="img"
        src={images[index].src}
        alt={images[index].alt}
        onClick={next}
        role="button"
        aria-label="Next image"
        sx={{ width: '100%', borderRadius: 1, boxShadow: 3, objectFit: 'cover', cursor: 'pointer' }}
      />

      <IconButton
        onClick={prev}
        size="small"
        sx={{ position: 'absolute', top: '50%', left: 8, transform: 'translateY(-50%)', bgcolor: 'rgba(0,0,0,0.35)', color: 'white', '&:hover': { bgcolor: 'rgba(0,0,0,0.5)' } }}
        aria-label="Previous image"
      >
        <ChevronLeftIcon />
      </IconButton>
      <IconButton
        onClick={next}
        size="small"
        sx={{ position: 'absolute', top: '50%', right: 8, transform: 'translateY(-50%)', bgcolor: 'rgba(0,0,0,0.35)', color: 'white', '&:hover': { bgcolor: 'rgba(0,0,0,0.5)' } }}
        aria-label="Next image"
      >
        <ChevronRightIcon />
      </IconButton>

      <Stack direction="row" spacing={1} sx={{ position: 'absolute', bottom: 8, left: 0, right: 0 }} alignItems="center" justifyContent="center">
        {images.map((_, i) => (
          <Box
            key={i}
            onClick={() => setIndex(i)}
            role="button"
            aria-label={`Go to slide ${i + 1}`}
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              bgcolor: i === index ? 'primary.main' : 'rgba(255,255,255,0.6)',
              border: '1px solid rgba(0,0,0,0.2)',
              cursor: 'pointer',
            }}
          />
        ))}
      </Stack>
    </Box>
  );
}


