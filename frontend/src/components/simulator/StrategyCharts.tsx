'use client';

import React from 'react';
import type { SimulationResult } from '@/lib/types';
import PortfolioValueChart from '@/components/simulator/PortfolioValueChart';
import PortfolioAllocationChart from '@/components/simulator/PortfolioAllocationChart';
import DrawdownChart from '@/components/simulator/DrawdownChart';
import PriceChart from '@/components/simulator/PriceChart';
import RSIAndSignalsChart from '@/components/simulator/RSIAndSignalsChart';
import PowerLawChart from '@/components/simulator/PowerLawChart';
import TradesTable from '@/components/simulator/TradesTable';
import { strategyCharts, type ChartId } from '@/lib/strategies/registry';

interface Props { result: SimulationResult }

const StrategyCharts: React.FC<Props> = ({ result }) => {
  const layout: ChartId[] = strategyCharts[result.strategyId as keyof typeof strategyCharts] || ['portfolio', 'allocation', 'drawdown', 'trades'];
  return (
    <>
      {layout.map((c: ChartId) => {
        if (c === 'portfolio') return <PortfolioValueChart key={c} result={result} />;
        if (c === 'powerlaw') return <PowerLawChart key={c} result={result} />;
        if (c === 'allocation') return <PortfolioAllocationChart key={c} result={result} />;
        if (c === 'drawdown') return <DrawdownChart key={c} result={result} />;
        if (c === 'prices') return <PriceChart key={c} result={result} />;
        if (c === 'rsi') return <RSIAndSignalsChart key={c} result={result} />;
        if (c === 'trades') return <TradesTable key={c} result={result} />;
        return null;
      })}
    </>
  );
};

export default StrategyCharts;


