'use client';

import React from 'react';
import { Card, CardContent, Typography, TableContainer, Table, TableHead, TableRow, TableCell, TableBody, Tooltip } from '@mui/material';
import { formatDateOnly, formatDateTime, formatTokenAmountBigint } from '@/lib/format';

type Txn = { timestamp: bigint; user?: `0x${string}`; amount?: bigint; asset?: `0x${string}` };

type Props = {
  deposits: any[];
  withdrawals: any[];
  addressToMeta: (addr: string | undefined) => { symbol: string; decimals: number } | undefined;
};

export default function DepositsWithdrawalsCard({ deposits, withdrawals, addressToMeta }: Props) {
  return (
    <Card variant="outlined" sx={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Typography variant="subtitle1" fontWeight="bold">Deposits & Withdrawals</Typography>
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
              {((Array.isArray(deposits) ? deposits : []).length === 0 && (Array.isArray(withdrawals) ? withdrawals : []).length === 0) && (
                <TableRow>
                  <TableCell colSpan={4}>
                    <Typography variant="body2" color="text.secondary">No deposits or withdrawals yet.</Typography>
                  </TableCell>
                </TableRow>
              )}
              {[...(Array.isArray(deposits) ? deposits : [])].sort((a: any, b: any) => Number(b.timestamp) - Number(a.timestamp)).map((d: any, idx: number) => (
                <TableRow key={`dep-${idx}`}>
                  <TableCell>
                    <Tooltip title={formatDateTime(d.timestamp)} placement="top" disableFocusListener disableTouchListener>
                      <span>{formatDateOnly(d.timestamp)}</span>
                    </Tooltip>
                  </TableCell>
                  <TableCell>Deposit</TableCell>
                  <TableCell>USDC</TableCell>
                  <TableCell align="right">{formatTokenAmountBigint(d.amount as bigint, 6)}</TableCell>
                </TableRow>
              ))}
              {[...(Array.isArray(withdrawals) ? withdrawals : [])].sort((a: any, b: any) => Number(b.timestamp) - Number(a.timestamp)).map((w: any, idx: number) => {
                const meta = addressToMeta(w.asset as string);
                const sym = meta?.symbol || `${String(w.asset).slice(0, 6)}…${String(w.asset).slice(-4)}`;
                return (
                  <TableRow key={`wd-${idx}`}>
                    <TableCell>
                      <Tooltip title={formatDateTime(w.timestamp)} placement="top" disableFocusListener disableTouchListener>
                        <span>{formatDateOnly(w.timestamp)}</span>
                      </Tooltip>
                    </TableCell>
                    <TableCell>Withdrawal</TableCell>
                    <TableCell>{sym}</TableCell>
                    <TableCell align="right">{formatTokenAmountBigint(w.amount as bigint, meta?.decimals)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );
}


