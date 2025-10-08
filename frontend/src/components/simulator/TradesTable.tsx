'use client';

import React, { useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import type { SimulationResult } from '@/lib/types';

interface TradesTableProps {
  result: SimulationResult;
}

const TradesTable: React.FC<TradesTableProps> = ({ result }) => {
  const { trades } = result;
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const sortedTrades = useMemo(() => {
    // Ascending by date (oldest first) for CSV and table
    return [...trades].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }, [trades]);

  const paginatedTrades = sortedTrades.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const formatUSD0 = (value: number): string =>
    value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const handleDownload = () => {
    const header = ['Date', 'Asset', 'Side', 'Price', 'Quantity', 'Value', 'Fee', 'Portfolio Value'];
    const rows = sortedTrades.map((t) => [
      new Date(t.date).toLocaleDateString('en-CA'), // YYYY-MM-DD
      t.symbol,
      t.side,
      t.price.toFixed(0),
      t.quantity.toFixed(6),
      t.value.toFixed(0),
      t.fee.toFixed(2),
      t.portfolioValue.toFixed(0),
    ]);
    const lines = [header, ...rows].map((cols) => cols.join('\t')).join('\n');
    const blob = new Blob([lines], { type: 'text/tab-separated-values;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'trades.tsv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5" fontWeight="bold">
          Trade History ({trades.length} trades)
        </Typography>
        <IconButton onClick={handleDownload} aria-label="Download trades TSV" size="small">
          <DownloadIcon />
        </IconButton>
      </Box>

      <Card sx={{ bgcolor: '#1A1A1A', border: '1px solid #2D2D2D' }}>
        <CardContent sx={{ p: 0 }}>
          <TableContainer sx={{ maxHeight: 600 }}>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ bgcolor: '#1A1A1A', color: '#D1D5DB', borderBottom: '1px solid #2D2D2D' }}>
                    Date
                  </TableCell>
                  <TableCell sx={{ bgcolor: '#1A1A1A', color: '#D1D5DB', borderBottom: '1px solid #2D2D2D' }}>
                    Asset
                  </TableCell>
                  <TableCell sx={{ bgcolor: '#1A1A1A', color: '#D1D5DB', borderBottom: '1px solid #2D2D2D' }}>
                    Side
                  </TableCell>
                  <TableCell align="right" sx={{ bgcolor: '#1A1A1A', color: '#D1D5DB', borderBottom: '1px solid #2D2D2D' }}>
                    Price
                  </TableCell>
                  <TableCell align="right" sx={{ bgcolor: '#1A1A1A', color: '#D1D5DB', borderBottom: '1px solid #2D2D2D' }}>
                    Quantity
                  </TableCell>
                  <TableCell align="right" sx={{ bgcolor: '#1A1A1A', color: '#D1D5DB', borderBottom: '1px solid #2D2D2D' }}>
                    Value
                  </TableCell>
                  <TableCell align="right" sx={{ bgcolor: '#1A1A1A', color: '#D1D5DB', borderBottom: '1px solid #2D2D2D' }}>
                    Fee
                  </TableCell>
                  <TableCell align="right" sx={{ bgcolor: '#1A1A1A', color: '#D1D5DB', borderBottom: '1px solid #2D2D2D' }}>
                    Portfolio Value
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedTrades.map((trade, index) => (
                  <TableRow
                    key={index}
                    sx={{
                      '&:hover': {
                        bgcolor: 'rgba(245, 158, 11, 0.05)',
                      },
                    }}
                  >
                    <TableCell sx={{ color: '#D1D5DB', borderBottom: '1px solid #2D2D2D' }}>
                      {new Date(trade.date).toLocaleDateString()}
                    </TableCell>
                    <TableCell sx={{ color: '#D1D5DB', borderBottom: '1px solid #2D2D2D' }}>
                      <Typography variant="body2" fontWeight="bold">
                        {trade.symbol}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ borderBottom: '1px solid #2D2D2D' }}>
                      <Chip
                        label={trade.side}
                        size="small"
                        sx={{
                          bgcolor: trade.side === 'BUY' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                          color: trade.side === 'BUY' ? '#10B981' : '#EF4444',
                          fontWeight: 'bold',
                          fontSize: '0.7rem',
                        }}
                      />
                    </TableCell>
                    <TableCell align="right" sx={{ color: '#D1D5DB', borderBottom: '1px solid #2D2D2D' }}>
                      ${formatUSD0(trade.price)}
                    </TableCell>
                    <TableCell align="right" sx={{ color: '#D1D5DB', borderBottom: '1px solid #2D2D2D' }}>
                      {trade.quantity.toFixed(6)}
                    </TableCell>
                    <TableCell align="right" sx={{ color: '#D1D5DB', borderBottom: '1px solid #2D2D2D' }}>
                      ${formatUSD0(trade.value)}
                    </TableCell>
                    <TableCell align="right" sx={{ color: '#D1D5DB', borderBottom: '1px solid #2D2D2D' }}>
                      ${trade.fee.toFixed(2)}
                    </TableCell>
                    <TableCell align="right" sx={{ color: '#D1D5DB', borderBottom: '1px solid #2D2D2D' }}>
                      ${formatUSD0(trade.portfolioValue)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            rowsPerPageOptions={[5, 10, 25, 50]}
            component="div"
            count={trades.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            sx={{
              color: '#D1D5DB',
              borderTop: '1px solid #2D2D2D',
              '.MuiTablePagination-selectIcon': { color: '#D1D5DB' },
              '.MuiTablePagination-select': { color: '#D1D5DB' },
              '.MuiTablePagination-displayedRows': { color: '#D1D5DB' },
            }}
          />
        </CardContent>
      </Card>
    </Box>
  );
};

export default TradesTable;
