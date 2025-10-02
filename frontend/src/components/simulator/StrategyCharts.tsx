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

interface Props { result: SimulationResult }

const StrategyCharts: React.FC<Props> = ({ result }) => {
  if (result.strategyId === 'smart-btc-dca') {
    // DCA layout: Portfolio Value → Power Law & Signals → Allocation → Drawdown → Trades
    return (
      <>
        <PortfolioValueChart result={result} />
        <PowerLawChart result={result} />
        <PortfolioAllocationChart result={result} />
        <DrawdownChart result={result} />
        <TradesTable result={result} />
      </>
    );
  }

  // Default (momentum) layout: Portfolio Value → Allocation → Drawdown → Asset Prices & Trades → RSI & Signals → Trades
  return (
    <>
      <PortfolioValueChart result={result} />
      <PortfolioAllocationChart result={result} />
      <DrawdownChart result={result} />
      <PriceChart result={result} />
      <RSIAndSignalsChart result={result} />
      <TradesTable result={result} />
    </>
  );
};

export default StrategyCharts;


