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
}

export interface SimulationResult {
  dailyPerformance: DailyPerformance[];
  trades: Trade[];
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

export interface StrategyParameters {
  rsi_bars: number;
  eth_btc_rsi_bars: number;
  bearish_rsi_entry: number;
  bearish_rsi_exit: number;
  bullish_rsi_entry: number;
  bullish_rsi_exit: number;
  regime_filter_ma_length: number;
  allocation: number;
  rebalance_threshold: number;
  momentum_exponent: number;
  trading_fee: number;
}
