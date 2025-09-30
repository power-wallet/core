# Power Wallet Strategy Simulator

## Overview

The Strategy Simulator is a comprehensive backtesting tool that allows users to test the BTC-ETH Momentum RSI strategy with historical data and analyze performance metrics.

## Features

### ✅ Implemented

1. **Strategy Engine**
   - Full TypeScript port of Python strategy logic
   - RSI (8-period) and ETH/BTC RSI (5-period) calculations
   - 200-day SMA regime filter (bullish/bearish)
   - Momentum-based portfolio allocation
   - Dynamic rebalancing with threshold controls
   - Trading fees (0.3%) included

2. **Interactive Controls**
   - Strategy selector (currently: BTC-ETH Momentum RSI)
   - Date range picker (start/end dates)
   - Initial capital input
   - Form validation

3. **Performance Metrics**
   - Total Return %
   - CAGR (Compound Annual Growth Rate)
   - Maximum Drawdown
   - Total Trades Count
   - BTC HODL Benchmark comparison
   - Outperformance vs HODL

4. **Visualizations** (3 Charts)
   - **Portfolio Value**: Line chart comparing strategy vs BTC HODL over time
   - **Portfolio Allocation**: Stacked area chart showing USDC, BTC, ETH holdings
   - **Drawdown Comparison**: Line chart showing drawdown % for strategy vs HODL

5. **Trade History**
   - Paginated table of all executed trades
   - Shows: Date, Asset, Side (Buy/Sell), Price, Quantity, Value, Fee, Portfolio Value
   - Color-coded Buy/Sell chips
   - Sortable and searchable

## How It Works

### Data Flow

1. **Price Data**: Loaded from `/public/data/btc_daily.json` and `/public/data/eth_daily.json`
2. **Indicators**: Calculated using `lib/indicators.ts` (SMA, RSI)
3. **Simulation**: Day-by-day portfolio simulation in `lib/simulator.ts`
4. **Results**: Rendered via components in `components/simulator/`

### Strategy Logic (from Python)

```
Parameters:
- RSI Period: 8 bars
- ETH/BTC RSI Period: 5 bars  
- Regime Filter: 200-day SMA
- Bullish Entry: RSI crosses above 80
- Bullish Exit: RSI crosses below 65
- Bearish Entry: RSI crosses above 65
- Bearish Exit: RSI crosses below 70
- Allocation: 98% of portfolio
- Rebalance Threshold: 27.5% of portfolio value
- Momentum Exponent: 3.5
- Trading Fee: 0.30%
```

### Portfolio Management

1. **Regime Detection**: BTC price vs 200-day SMA determines bullish/bearish
2. **Entry/Exit Signals**: RSI crossovers trigger trades
3. **Momentum Weights**: ETH/BTC RSI determines allocation ratio
4. **Rebalancing**: Only when drift exceeds threshold to minimize fees
5. **Benchmark**: BTC HODL with same initial capital

## Components

### File Structure

```
frontend/src/
├── lib/
│   ├── indicators.ts       # SMA, RSI calculations
│   ├── simulator.ts        # Main simulation engine
│   └── types.ts            # TypeScript type definitions
├── components/simulator/
│   ├── SimulatorControls.tsx  # Input form
│   ├── StatsSummary.tsx       # Performance metrics cards
│   ├── SimulatorCharts.tsx    # Recharts visualizations
│   └── TradesTable.tsx        # Trade history table
└── app/simulator/
    └── page.tsx            # Main simulator page
```

### Key Components

- **SimulatorControls**: Form for strategy, dates, capital
- **StatsSummary**: 8 metric cards with color-coded indicators
- **SimulatorCharts**: 3 responsive charts using Recharts
- **TradesTable**: Paginated table with 10/25/50 rows per page

## Usage

1. **Navigate**: Go to `/simulator` in the app
2. **Configure**: 
   - Select strategy (currently only BTC-ETH Momentum)
   - Choose start date (e.g., 2025-01-01)
   - Choose end date (e.g., 2025-09-27)
   - Enter initial capital (minimum $100)
3. **Run**: Click "Run Simulation" button
4. **Analyze**: Review metrics, charts, and trades

## Technical Details

### Indicator Calculations

**RSI (Relative Strength Index)**:
```typescript
- Uses Wilder's smoothing method
- Separates gains and losses
- Calculates average gain/loss over period
- RS = Average Gain / Average Loss
- RSI = 100 - (100 / (1 + RS))
```

**SMA (Simple Moving Average)**:
```typescript
- Sum of last N prices / N
- Returns NaN for insufficient data
```

### Performance Metrics

**CAGR**:
```
For >= 1 year: (End Value / Start Value)^(1/years) - 1
For < 1 year: (End Value / Start Value - 1) * (365.2425 / days)
```

**Drawdown**:
```
Current DD = (Current Value / Running Max Value - 1) * 100
Max DD = Min of all daily drawdowns
```

## Future Enhancements

- [ ] Export results to CSV/JSON
- [ ] Parameter optimization slider
- [ ] Multiple strategy comparison
- [ ] Sharpe Ratio calculation
- [ ] Win rate and trade statistics
- [ ] Mobile-optimized charts
- [ ] Save/load simulation configs

## Data

Price data covers:
- **BTC/USD**: Daily closes from Coinbase
- **ETH/USD**: Daily closes from Coinbase
- **Format**: `{ date: "YYYY-MM-DD", close: number }`

## Color Scheme

- **Strategy Line**: Gold (#F59E0B)
- **HODL Line**: Orange (#FB923C, dashed)
- **BTC**: Gold (#F59E0B)
- **ETH**: Blue (#3B82F6)
- **USDC**: Green (#10B981)
- **Buy**: Green (#10B981)
- **Sell**: Red (#EF4444)

## Notes

- Simulation runs client-side (no server required)
- Results match Python implementation
- All prices in USD
- Fees deducted on every trade
- Benchmark includes initial buy fee
