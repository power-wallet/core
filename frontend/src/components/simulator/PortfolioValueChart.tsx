'use client';

import React, { useMemo, useState } from 'react';
import { Card, CardContent, Typography, ToggleButtonGroup, ToggleButton, Box } from '@mui/material';
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import type { SimulationResult } from '@/lib/types';

interface Props { result: SimulationResult }

const PortfolioValueChart: React.FC<Props> = ({ result }) => {
  const portfolioData = result.dailyPerformance.map(d => ({ date: d.date, strategy: d.totalValue, hodl: d.btcHodlValue }));

  const [showStrategy, setShowStrategy] = useState(true);
  const [showHodl, setShowHodl] = useState(true);

  const domain = useMemo(() => {
    const keys: Array<'strategy'|'hodl'> = [];
    if (showStrategy) keys.push('strategy');
    if (showHodl) keys.push('hodl');
    const values: number[] = [];
    for (const d of portfolioData) {
      for (const k of keys) {
        const v = (d as any)[k];
        if (typeof v === 'number' && isFinite(v)) values.push(v);
      }
    }
    if (!values.length) return ['auto','auto'] as const;
    const min = Math.min(...values); const max = Math.max(...values); const pad = (max-min)*0.05;
    return [Math.max(0,min-pad), max+pad] as const;
  }, [portfolioData, showStrategy, showHodl]);

  const getLegendKey = (e: any): string | undefined => e?.dataKey ?? e?.payload?.dataKey ?? e?.value;

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

  const [scale, setScale] = useState<'linear' | 'log'>('linear');
  const handleScaleChange = (_: any, next: 'linear' | 'log' | null) => { if (next) setScale(next); };

  return (
    <Card sx={{ bgcolor:'#1A1A1A', border:'1px solid #2D2D2D' }}>
      <CardContent>
        <Box sx={{ display:'flex', alignItems:'center', justifyContent:'space-between', mb: 1 }}>
          <Typography variant="h6" fontWeight="bold">Portfolio Value</Typography>
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
          <LineChart data={portfolioData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2D2D2D" />
            <XAxis dataKey="date" stroke="#D1D5DB" tick={{ fill:'#D1D5DB', fontSize:12 }} tickFormatter={(v)=>new Date(v).toLocaleDateString('en-US',{month:'short',day:'numeric'})} />
            <YAxis
              stroke="#D1D5DB"
              tick={{ fill:'#D1D5DB', fontSize:12 }}
              tickFormatter={(v)=>`$${(v as number).toLocaleString('en-US',{ maximumFractionDigits:0 })}`}
              scale={scale}
              allowDataOverflow
              domain={scale === 'log' ? (['auto','auto'] as any) : (domain as any)}
            />
            <Tooltip content={<TooltipContent />} />
            <Legend wrapperStyle={{ color:'#D1D5DB', cursor:'pointer' }} onClick={(e:any)=>{ const k=getLegendKey(e); if(k==='strategy'||k==='Strategy') setShowStrategy(v=>!v); if(k==='hodl'||k==='BTC HODL') setShowHodl(v=>!v); }} />
            <Line type="monotone" dataKey="strategy" name="Strategy" stroke="#3B82F6" strokeWidth={2} dot={false} hide={!showStrategy} />
            <Line type="monotone" dataKey="hodl" name="BTC HODL" stroke="#FB923C" strokeWidth={2} dot={false} strokeDasharray="5 5" hide={!showHodl} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export default PortfolioValueChart;


