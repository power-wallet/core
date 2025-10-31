'use client';

import React, { useMemo, useState } from 'react';
import { Card, CardContent, Typography, ToggleButtonGroup, ToggleButton, Box } from '@mui/material';
import { ResponsiveContainer, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Brush, Area, Line } from 'recharts';
import type { SimulationResult } from '@/lib/types';

interface Props { result: SimulationResult }

const AssetValueChart: React.FC<Props> = ({ result }) => {
  const data = result.dailyPerformance.map(d => ({ date: d.date, USDC: d.cash, BTC: d.btcValue, ETH: d.ethValue }));
  const hasEth = useMemo(() => data.some(d => (d.ETH || 0) > 0), [data]);
  const [showUSDC, setShowUSDC] = useState(true);
  const [showBTC, setShowBTC] = useState(true);
  const [showETH, setShowETH] = useState(hasEth);

  const [scale, setScale] = useState<'linear' | 'log'>('linear');
  const handleScaleChange = (_: any, next: 'linear' | 'log' | null) => { if (next) setScale(next); };

  // No data transformation; for log mode we render as lines and set a safe domain

  const yDomain = useMemo(() => {
    const totals = data.map(d => (showUSDC ? d.USDC : 0) + (showBTC ? d.BTC : 0) + (showETH ? (d.ETH || 0) : 0));
    const max = totals.length ? Math.max(...totals) : 0;
    return [0, max * 1.05] as const;
  }, [data, showUSDC, showBTC, showETH]);

  const logDomain = useMemo(() => {
    const keys: Array<'USDC'|'BTC'|'ETH'> = [];
    if (showUSDC) keys.push('USDC');
    if (showBTC) keys.push('BTC');
    if (showETH && hasEth) keys.push('ETH');
    let minPos = Number.POSITIVE_INFINITY;
    let maxPos = 0;
    for (const d of data) {
      for (const k of keys) {
        const v = (d as any)[k];
        if (typeof v === 'number' && v > 0) {
          if (v < minPos) minPos = v;
          if (v > maxPos) maxPos = v;
        }
      }
    }
    if (!isFinite(minPos) || maxPos <= 0) return [1, 10] as const; // fallback
    return [minPos * 0.95, maxPos * 1.05] as const;
  }, [data, showUSDC, showBTC, showETH, hasEth]);

  const getLegendKey = (e:any)=> e?.dataKey ?? e?.payload?.dataKey ?? e?.value;

  const TooltipContent = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background:'rgba(0,0,0,0.9)', border:'1px solid #444', padding:8, borderRadius:6 }}>
        <div style={{ color:'#fff', fontSize:12 }}>{label}</div>
        {payload.map((p: any, i: number) => (
          <div key={i} style={{ color:p.color, fontSize:12 }}>
            {p.name}: ${Number(p.value).toLocaleString('en-US',{ maximumFractionDigits:0 })}
          </div>
        ))}
      </div>
    );
  };

  return (
    <Card sx={{ bgcolor:'#1A1A1A', border:'1px solid #2D2D2D' }}>
      <CardContent>
        <Box sx={{ display:'flex', alignItems:'center', justifyContent:'space-between', mb: 1 }}>
          <Typography variant="h6" fontWeight="bold">Asset Value</Typography>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={scale}
            onChange={handleScaleChange}
            sx={{
              '& .MuiToggleButton-root': { color:'#D1D5DB', borderColor:'#2D2D2D' },
              '& .Mui-selected': { color:'#111827', backgroundColor:'#F59E0B' },
            }}
          >
            <ToggleButton value="linear">Linear</ToggleButton>
            <ToggleButton value="log">Log</ToggleButton>
          </ToggleButtonGroup>
        </Box>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2D2D2D" />
            <XAxis dataKey="date" stroke="#D1D5DB" tick={{ fill:'#D1D5DB', fontSize:12 }} tickFormatter={(v)=>new Date(v).toLocaleDateString('en-US',{month:'short',day:'numeric'})} />
            <YAxis 
              stroke="#D1D5DB" 
              tick={{ fill:'#D1D5DB', fontSize:12 }} 
              tickFormatter={(v)=>`$${(v as number).toLocaleString('en-US',{ maximumFractionDigits:0 })}`}
              scale={scale}
              allowDataOverflow
              domain={scale === 'log' ? (logDomain as any) : (yDomain as any)}
            />
            <Tooltip content={<TooltipContent />} />
            <Legend wrapperStyle={{ color:'#D1D5DB', cursor:'pointer' }} onClick={(e:any)=>{ const k=getLegendKey(e); if(k==='USDC') setShowUSDC(v=>!v); if(k==='BTC') setShowBTC(v=>!v); if(k==='ETH' && hasEth) setShowETH(v=>!v); }} />
            {scale === 'linear' ? (
              <>
                <Area type="monotone" dataKey="USDC" name="USDC" stackId="1" stroke="#10B981" fill="#10B981" fillOpacity={0.35} hide={!showUSDC} />
                <Area type="monotone" dataKey="BTC" name="BTC" stackId="1" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.35} hide={!showBTC} />
                {hasEth && (
                  <Area type="monotone" dataKey="ETH" name="ETH" stackId="1" stroke="#9CA3AF" fill="#9CA3AF" fillOpacity={0.35} hide={!showETH} />
                )}
              </>
            ) : (
              <>
                <Line type="monotone" dataKey="USDC" name="USDC" stroke="#10B981" strokeWidth={2} dot={false} hide={!showUSDC} />
                <Line type="monotone" dataKey="BTC" name="BTC" stroke="#F59E0B" strokeWidth={2} dot={false} hide={!showBTC} />
                {hasEth && (
                  <Line type="monotone" dataKey="ETH" name="ETH" stroke="#9CA3AF" strokeWidth={2} dot={false} hide={!showETH} />
                )}
              </>
            )}

            <Brush
              dataKey="date"
              stroke="#F59E0B"
              fill="#0F172A"
              travellerWidth={8}
              height={24}
              tickFormatter={(v)=>new Date(v).toLocaleDateString('en-US',{month:'short',year:'2-digit'})}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export default AssetValueChart;


