/**
 * Type definitions for the simulator
 */

export interface PriceData {
  date: string;
  close: number;
}

export interface DailyData {
  date: string;
  btcPrice: number;
  ethPrice: number;
  btcRsi: number;
  ethRsi: number;
  ethBtcRsi: number;
  btcSma: number;
  isBullish: boolean;
}

export interface Position {
  symbol: 'BTC' | 'ETH';
  quantity: number;
  value: number;
  lastPrice: number;
}

export interface Trade {
  date: string;
  symbol: 'BTC' | 'ETH';
  side: 'BUY' | 'SELL';
  price: number;
  quantity: number;
  value: number;
  fee: number;
  portfolioValue: number;
}

export interface DailyPerformance {
  date: string;
  cash: number;
  btcQty: number;
  ethQty: number;
  btcValue: number;
  ethValue: number;
  totalValue: number;
  btcHodlValue: number;
  drawdown: number;
  btcHodlDrawdown: number;
  btcPrice: number;
  ethPrice: number;
  // Optional fields for strategy-specific visuals
  btcModel?: number;
  btcUpperBand?: number;
  btcLowerBand?: number;
  btcSma50?: number;
}

export interface SimulationResult {
  dailyPerformance: DailyPerformance[];
  trades: Trade[];
  rsiSignals?: DailyRsiSignals[];
  strategyId?: string;
  summary: {
    initialCapital: number;
    finalValue: number;
    totalReturn: number;
    cagr: number;
    maxDrawdown: number;
    totalTrades: number;
    sharpeRatio: number;
    sortinoRatio: number;
    btcHodlFinalValue: number;
    btcHodlReturn: number;
    btcHodlCagr: number;
    btcHodlMaxDrawdown: number;
    btcHodlSharpeRatio: number;
    btcHodlSortinoRatio: number;
    outperformance: number;
  };
}

export interface DailyRsiSignals {
  date: string;
  btcRsi: number;
  ethRsi: number;
  entryLine: number;
  exitLine: number;
  btcBuy: boolean;
  btcSell: boolean;
  ethBuy: boolean;
  ethSell: boolean;
  bothEligible: boolean;
  bothAllocated: boolean;
  btcBuyDetail?: string;
  btcSellDetail?: string;
  ethBuyDetail?: string;
  ethSellDetail?: string;
}

export interface StrategyParameters {
  rsiBars: number;
  ethBtcRsiBars: number;
  bearishRsiEntry: number;
  bearishRsiExit: number;
  bullishRsiEntry: number;
  bullishRsiExit: number;
  regimeFilterMaLength: number;
  allocation: number;
  rebalanceThreshold: number;
  momentumExponent: number;
  tradingFee: number;
}
