'use client';

import React, { useMemo, useState } from 'react';
import { Card, CardContent, Typography } from '@mui/material';
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Brush } from 'recharts';
import type { SimulationResult } from '@/lib/types';

interface Props { result: SimulationResult }

const DrawdownChart: React.FC<Props> = ({ result }) => {
  const drawdownData = result.dailyPerformance.map(d => ({ date:d.date, strategy:d.drawdown, hodl:d.btcHodlDrawdown }));
  const [showStrategy, setShowStrategy] = useState(true);
  const [showHodl, setShowHodl] = useState(true);

  const domain = useMemo(()=>{
    const keys: Array<'strategy'|'hodl'> = []; if (showStrategy) keys.push('strategy'); if (showHodl) keys.push('hodl');
    const values:number[]=[]; for(const d of drawdownData){ for(const k of keys){ const v=(d as any)[k]; if(typeof v==='number' && isFinite(v)) values.push(v);} }
    if(!values.length) return ['auto','auto'] as const; const min=Math.min(...values), max=Math.max(...values), pad=(max-min)*0.05; return [min-pad,max+pad] as const;
  },[drawdownData, showStrategy, showHodl]);

  const getLegendKey = (e:any)=> e?.dataKey ?? e?.payload?.dataKey ?? e?.value;

  const TooltipContent = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background:'rgba(0,0,0,0.9)', border:'1px solid #444', padding:8, borderRadius:6 }}>
        <div style={{ color:'#fff', fontSize:12 }}>{label}</div>
        {payload.map((p: any, i: number) => (
          <div key={i} style={{ color:p.color, fontSize:12 }}>{p.name}: {Number(p.value).toFixed(0)}%</div>
        ))}
      </div>
    );
  };

  return (
    <Card sx={{ bgcolor:'#1A1A1A', border:'1px solid #2D2D2D' }}>
      <CardContent>
        <Typography variant="h6" gutterBottom fontWeight="bold">Drawdown Comparison</Typography>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={drawdownData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2D2D2D" />
            <XAxis dataKey="date" stroke="#D1D5DB" tick={{ fill:'#D1D5DB', fontSize:12 }} tickFormatter={(v)=>new Date(v).toLocaleDateString('en-US',{month:'short',day:'numeric'})} />
            <YAxis stroke="#D1D5DB" tick={{ fill:'#D1D5DB', fontSize:12 }} tickFormatter={(v)=>`${Number(v).toFixed(0)}%`} domain={domain as any} />
            <Tooltip content={<TooltipContent />} />
            <Legend wrapperStyle={{ color:'#D1D5DB', cursor:'pointer' }} onClick={(e:any)=>{ const k=getLegendKey(e); if(k==='strategy'||k==='Strategy DD') setShowStrategy(v=>!v); if(k==='hodl'||k==='HODL DD') setShowHodl(v=>!v);}} />
            <Line type="monotone" dataKey="strategy" name="Strategy DD" stroke="#3B82F6" strokeWidth={2} dot={false} hide={!showStrategy} />
            <Line type="monotone" dataKey="hodl" name="HODL DD" stroke="#F97316" strokeWidth={2} dot={false} strokeDasharray="5 5" hide={!showHodl} />
            <Brush
              dataKey="date"
              stroke="#F59E0B"
              fill="#0F172A"
              travellerWidth={8}
              height={24}
              tickFormatter={(v)=>new Date(v).toLocaleDateString('en-US',{month:'short',year:'2-digit'})}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export default DrawdownChart;


