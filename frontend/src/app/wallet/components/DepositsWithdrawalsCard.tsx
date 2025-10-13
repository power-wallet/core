'use client';

import React from 'react';
import { Card, CardContent, Typography, TableContainer, Table, TableHead, TableRow, TableCell, TableBody, Tooltip, Button, Dialog, DialogTitle, DialogContent, DialogActions, IconButton, Box, useTheme, useMediaQuery } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { formatDateOnly, formatDateTime, formatTokenAmountBigint } from '@/lib/format';

type Txn = { timestamp: bigint; user?: `0x${string}`; amount?: bigint; asset?: `0x${string}` };

type Props = {
  deposits: any[];
  withdrawals: any[];
  addressToMeta: (addr: string | undefined) => { symbol: string; decimals: number } | undefined;
};

export default function DepositsWithdrawalsCard({ deposits, withdrawals, addressToMeta }: Props) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [open, setOpen] = React.useState(false);

  const combined = React.useMemo(() => {
    const ds = (Array.isArray(deposits) ? deposits : []).map((d: any) => ({
      ts: Number(d.timestamp as bigint),
      kind: 'Deposit' as const,
      asset: 'USDC',
      amount: formatTokenAmountBigint(d.amount as bigint, 6),
      tsBig: d.timestamp as bigint,
    }));
    const ws = (Array.isArray(withdrawals) ? withdrawals : []).map((w: any) => {
      const meta = addressToMeta(w.asset as string);
      const sym = meta?.symbol || `${String(w.asset).slice(0, 6)}…${String(w.asset).slice(-4)}`;
      return {
        ts: Number(w.timestamp as bigint),
        kind: 'Withdrawal' as const,
        asset: sym,
        amount: formatTokenAmountBigint(w.amount as bigint, meta?.decimals),
        tsBig: w.timestamp as bigint,
        assetAddr: w.asset as string,
      };
    });
    return [...ds, ...ws].sort((a, b) => b.ts - a.ts);
  }, [deposits, withdrawals, addressToMeta]);

  const top3 = combined.slice(0, 3);
  const hasMore = combined.length > 3;

  return (
    <Card variant="outlined" sx={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="subtitle1" fontWeight="bold">Deposits & Withdrawals</Typography>
          {hasMore ? (
            <Button size="small" onClick={() => setOpen(true)}>Show all</Button>
          ) : null}
        </Box>
        <TableContainer sx={{ mt: 1, overflowX: 'auto' }}>
          <Table size="small" sx={{ minWidth: 520, whiteSpace: 'nowrap' }}>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Asset</TableCell>
                <TableCell align="right">Amount</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {combined.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4}>
                    <Typography variant="body2" color="text.secondary">No deposits or withdrawals yet.</Typography>
                  </TableCell>
                </TableRow>
              )}
              {top3.map((row, idx) => (
                <TableRow key={`row-${idx}`}>
                  <TableCell>
                    <Tooltip title={formatDateTime(row.tsBig)} placement="top" disableFocusListener disableTouchListener>
                      <span>{formatDateOnly(row.tsBig)}</span>
                    </Tooltip>
                  </TableCell>
                  <TableCell>{row.kind}</TableCell>
                  <TableCell>{row.asset}</TableCell>
                  <TableCell align="right">{row.amount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
        PaperProps={{ sx: { borderRadius: { xs: 0, sm: 1 } } }}
      >
        <DialogTitle sx={{
          px: { xs: 2, sm: 3 },
          py: { xs: 1.5, sm: 2 },
          position: 'sticky',
          top: 0,
          zIndex: 1,
          bgcolor: { xs: 'background.default', sm: 'background.paper' },
          borderBottom: '1px solid',
          borderColor: 'divider',
          boxShadow: { xs: '0 2px 8px rgba(0,0,0,0.35)', sm: '0 1px 2px rgba(0,0,0,0.18)' },
          borderTopLeftRadius: { sm: 8 },
          borderTopRightRadius: { sm: 8 },
        }}>
          Deposits & Withdrawals
          {isMobile ? (
            <IconButton aria-label="close" onClick={() => setOpen(false)} sx={{ position: 'absolute', right: 8, top: 8, color: 'text.secondary' }}>
              <CloseIcon />
            </IconButton>
          ) : null}
        </DialogTitle>
        <DialogContent sx={{ px: { xs: 2, sm: 3 }, pt: { xs: 1, sm: 2 }, pb: { xs: 2, sm: 3 } }}>
          <TableContainer sx={{ mt: 1, overflowX: 'auto' }}>
            <Table size="small" sx={{ minWidth: 520, whiteSpace: 'nowrap' }}>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Asset</TableCell>
                  <TableCell align="right">Amount</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {combined.map((row, idx) => (
                  <TableRow key={`all-${idx}`}>
                    <TableCell>
                      <Tooltip title={formatDateTime(row.tsBig)} placement="top" disableFocusListener disableTouchListener>
                        <span>{formatDateOnly(row.tsBig)}</span>
                      </Tooltip>
                    </TableCell>
                    <TableCell>{row.kind}</TableCell>
                    <TableCell>{row.asset}</TableCell>
                    <TableCell align="right">{row.amount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        {!isMobile ? (
          <DialogActions>
            <Button onClick={() => setOpen(false)}>Close</Button>
          </DialogActions>
        ) : null}
      </Dialog>
    </Card>
  );
}


