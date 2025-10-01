'use client';

import React, { useMemo, useState } from 'react';
import { Card, CardContent, Typography } from '@mui/material';
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import type { SimulationResult } from '@/lib/types';

interface Props { result: SimulationResult }

const PortfolioAllocationChart: React.FC<Props> = ({ result }) => {
  const allocationData = result.dailyPerformance.map(d => ({ date:d.date, USDC:d.cash, BTC:d.btcValue, ETH:d.ethValue }));
  const [showUSDC, setShowUSDC] = useState(true);
  const [showBTC, setShowBTC] = useState(true);
  const [showETH, setShowETH] = useState(true);

  const domain = useMemo(()=>{
    const totals = allocationData.map(d => (showUSDC?d.USDC:0)+(showBTC?d.BTC:0)+(showETH?d.ETH:0));
    const max = totals.length? Math.max(...totals):0; return [0, max*1.05] as const;
  }, [allocationData, showUSDC, showBTC, showETH]);

  const getLegendKey = (e:any)=> e?.dataKey ?? e?.payload?.dataKey ?? e?.value;

  const TooltipContent = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background:'rgba(0,0,0,0.9)', border:'1px solid #444', padding:8, borderRadius:6 }}>
        <div style={{ color:'#fff', fontSize:12 }}>{label}</div>
        {payload.map((p: any, i: number) => (
          <div key={i} style={{ color:p.color, fontSize:12 }}>{p.name}: ${Number(p.value).toLocaleString('en-US',{ maximumFractionDigits:0 })}</div>
        ))}
      </div>
    );
  };

  return (
    <Card sx={{ bgcolor:'#1A1A1A', border:'1px solid #2D2D2D' }}>
      <CardContent>
        <Typography variant="h6" gutterBottom fontWeight="bold">Portfolio Allocation</Typography>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={allocationData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2D2D2D" />
            <XAxis dataKey="date" stroke="#D1D5DB" tick={{ fill:'#D1D5DB', fontSize:12 }} tickFormatter={(v)=>new Date(v).toLocaleDateString('en-US',{month:'short',day:'numeric'})} />
            <YAxis stroke="#D1D5DB" tick={{ fill:'#D1D5DB', fontSize:12 }} tickFormatter={(v)=>`$${(v as number).toLocaleString('en-US',{ maximumFractionDigits:0 })}`} domain={domain as any} />
            <Tooltip content={<TooltipContent />} />
            <Legend wrapperStyle={{ color:'#D1D5DB', cursor:'pointer' }} onClick={(e:any)=>{ const k=getLegendKey(e); if(k==='USDC') setShowUSDC(v=>!v); if(k==='BTC') setShowBTC(v=>!v); if(k==='ETH') setShowETH(v=>!v); }} />
            <Area type="monotone" dataKey="USDC" stackId="1" stroke="#10B981" fill="#10B981" fillOpacity={0.6} hide={!showUSDC} />
            <Area type="monotone" dataKey="BTC" stackId="1" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.6} hide={!showBTC} />
            <Area type="monotone" dataKey="ETH" stackId="1" stroke="#9CA3AF" fill="#9CA3AF" fillOpacity={0.6} hide={!showETH} />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export default PortfolioAllocationChart;


