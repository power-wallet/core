'use client';

import React, { useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
} from '@mui/material';
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
    // Descending by date (newest first). Dates are ISO strings in YYYY-MM-DD.
    // Copy before sort to avoid mutating props.
    return [...trades].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }, [trades]);

  const paginatedTrades = sortedTrades.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const formatUSD0 = (value: number): string =>
    value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  return (
    <Box>
      <Typography variant="h5" gutterBottom fontWeight="bold" sx={{ mb: 3 }}>
        Trade History ({trades.length} trades)
      </Typography>

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
