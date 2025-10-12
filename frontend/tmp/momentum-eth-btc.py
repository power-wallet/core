#!/usr/bin/env python3
"""
Minimal ETH–BTC long swing backtest (no CLI, no web3).

- Pulls daily candles from Binance public REST (no key needed)
- Reimplements the RSI + regime + momentum logic you posted
- Uses Binance-mode params (no size risk / credit / DEX fees)
- Outputs:
  - equity curve CSV:  equity_curve.csv
  - trades CSV:        trades.csv
  - prints summary stats

Requires:
  pip install requests numpy pandas ft-pandas-ta tqdm
"""

from __future__ import annotations
import math
import time
import json
import csv
import sys
import datetime as dt
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

import requests
import numpy as np
import pandas as pd
import pandas_ta as ta
from tqdm import tqdm


# ------------------------------
# Parameters (mirrored from code)
# ------------------------------
class Parameters:
    # time + indicators
    rsi_bars = 8
    eth_btc_rsi_bars = 5
    bearish_rsi_entry = 65
    bearish_rsi_exit = 70
    bullish_rsi_entry = 80
    bullish_rsi_exit = 65
    regime_filter_ma_length = 200
    regime_filter_only_btc = 1  # 1 = use BTC as the regime filter for both

    # portfolio / rebalancing
    allocation = 0.98
    rebalance_threshold = 0.275
    momentum_exponent = 3.5

    # fees (Binance backtest in strategy uses 30 bps)
    trading_fee = 0.0030

    # backtest window (the Binance path in your code)
    backtest_start = dt.datetime(2024, 1, 1, tzinfo=dt.timezone.utc)
    backtest_end   = dt.datetime(2025, 9, 27, tzinfo=dt.timezone.utc)
    
    # Additional lookback for SMA calculation
    lookback_days = 200  # For the 200-day SMA


# ------------------------------
# Binance candle downloader
# ------------------------------
BINANCE_URL = "https://api.binance.com/api/v3/klines"

def fetch_binance_klines(symbol: str, interval: str, start: dt.datetime, end: dt.datetime) -> pd.DataFrame:
    """Fetch daily OHLCV from Binance with pagination (limit 1000)."""
    limit = 1000
    start_ms = int(start.timestamp() * 1000)
    end_ms   = int(end.timestamp()   * 1000)
    frames = []
    while start_ms < end_ms:
        params = dict(symbol=symbol, interval=interval, limit=limit, startTime=start_ms, endTime=end_ms)
        r = requests.get(BINANCE_URL, params=params, timeout=30)
        r.raise_for_status()
        data = r.json()
        if not data:
            break
        # Binance kline fields
        # 0 open time, 1 open, 2 high, 3 low, 4 close, 5 volume, 6 close time, ...
        df = pd.DataFrame(data, columns=[
            "open_time","open","high","low","close","volume","close_time",
            "qav","num_trades","tbbav","tbqav","ignore"
        ])
        df["open_time"] = pd.to_datetime(df["open_time"], unit="ms", utc=True)
        df["close_time"] = pd.to_datetime(df["close_time"], unit="ms", utc=True)
        df[["open","high","low","close","volume"]] = df[["open","high","low","close","volume"]].astype(float)
        frames.append(df[["close_time","close"]].rename(columns={"close_time": "time", "close":"close"}))
        # advance
        last_close = data[-1][6]
        # move cursor one ms after last close
        start_ms = int(last_close) + 1
        # polite pause
        time.sleep(0.2)
    if not frames:
        raise RuntimeError(f"No data returned for {symbol}")
    out = pd.concat(frames, ignore_index=True)
    out = out.drop_duplicates(subset=["time"]).sort_values("time").reset_index(drop=True)
    out["time"] = out["time"].dt.tz_convert("UTC")
    return out


# ------------------------------
# Helpers
# ------------------------------
def compute_rsi(series: pd.Series, length: int) -> pd.Series:
    return ta.rsi(series, length=length)

def max_drawdown(equity: pd.Series) -> float:
    roll_max = equity.cummax()
    dd = equity / roll_max - 1.0
    return dd.min()

def cagr(equity: pd.Series, dates: pd.Series) -> float:
    # assume daily points
    start_val = float(equity.iloc[0])
    end_val   = float(equity.iloc[-1])
    days = (dates.iloc[-1] - dates.iloc[0]).days or 1
    years = days / 365.2425
    if years < 1:
        # For periods less than a year, annualize the return linearly
        return (end_val / start_val - 1.0) * (365.2425 / days)
    return (end_val / start_val) ** (1/years) - 1.0

@dataclass
class Position:
    symbol: str
    qty: float = 0.0
    value: float = 0.0  # mark-to-market
    last_price: float = 0.0
    open_time: Optional[pd.Timestamp] = None


# ------------------------------
# Core backtest
# ------------------------------
def run_backtest() -> Tuple[pd.DataFrame, pd.DataFrame]:
    p = Parameters

    # 1) Fetch BTCUSDT + ETHUSDT daily closes with extra lookback for SMA
    print("Downloading Binance daily candles...")
    lookback_start = p.backtest_start - dt.timedelta(days=p.lookback_days)
    btc = fetch_binance_klines("BTCUSDT", "1d", lookback_start, p.backtest_end)
    eth = fetch_binance_klines("ETHUSDT", "1d", lookback_start, p.backtest_end)

    # align on intersection
    df = pd.DataFrame({
        "time": btc["time"]
    })
    df = df.merge(btc, on="time", suffixes=("","")).rename(columns={"close":"btc"})
    df = df.merge(eth, on="time", suffixes=("","")).rename(columns={"close":"eth"})
    df = df.set_index("time").sort_index()

    # 2) Indicators
    df["btc_rsi"] = compute_rsi(df["btc"], p.rsi_bars)
    df["eth_rsi"] = compute_rsi(df["eth"], p.rsi_bars)
    # Regime filter SMA on BTC (200d)
    df["btc_sma"] = ta.sma(df["btc"], length=p.regime_filter_ma_length)
    # ETH/BTC and its RSI(5)
    df["eth_btc"] = df["eth"] / df["btc"]
    df["eth_btc_rsi"] = compute_rsi(df["eth_btc"], p.eth_btc_rsi_bars)

    # 3) Setup BTC HODL benchmark and daily performance tracking
    initial_capital = 10_000.0
    # Find first BTC price after backtest_start
    first_valid_idx = df.index[df.index >= p.backtest_start][0]
    btc_start_price = df.at[first_valid_idx, "btc"]
    btc_hodl_qty = (initial_capital * (1.0 - p.trading_fee)) / btc_start_price  # Account for initial buy fee
    
    # 4) Iterate bars and simulate portfolio
    cash = initial_capital
    equity = []
    dates = []
    trades = []  # rows for CSV
    
    # Daily performance tracking
    daily_perf = []  # List to store daily performance records
    
    pos_btc = Position("BTCUSDT")
    pos_eth = Position("ETHUSDT")
    
    # Get all dates in the backtest period
    backtest_dates = df[df.index >= p.backtest_start].index
    
    # Initialize daily performance tracking
    for date in backtest_dates:
        btc_price = df.at[date, "btc"]
        eth_price = df.at[date, "eth"]
        
        total_equity = cash + pos_btc.qty * btc_price + pos_eth.qty * eth_price
        btc_hodl_value = btc_hodl_qty * btc_price
        
        daily_perf.append({
            "date": date.strftime("%Y-%m-%d"),
            "btc_price": round(btc_price, 2),
            "eth_price": round(eth_price, 2),
            "usdt_value": round(cash, 2),
            "eth_value": round(pos_eth.qty * eth_price, 2),
            "btc_value": round(pos_btc.qty * btc_price, 2),
            "total_portfolio_value": round(total_equity, 2),
            "btc_hodl_value": round(btc_hodl_value, 2)
        })
    
    # Now simulate trading
    for i in range(1, len(df)):
        today = df.index[i]
        yday = df.index[i-1]

        # Skip dates before backtest_start
        if today.to_pydatetime() < p.backtest_start:
            continue

        btc_px = df.at[today, "btc"]
        eth_px = df.at[today, "eth"]

        # Update mark-to-market
        for pos, px in ((pos_btc, btc_px), (pos_eth, eth_px)):
            pos.last_price = px
            pos.value = pos.qty * px

        # Regime
        bullish = True  # Default to bullish
        sma = df.at[today, "btc_sma"]
        if not math.isnan(sma):
            bullish = (df.at[today, "btc"] > sma)

        rsi_entry = p.bullish_rsi_entry if bullish else p.bearish_rsi_entry
        rsi_exit  = p.bullish_rsi_exit  if bullish else p.bearish_rsi_exit

        # RSI crosses (compare yesterday vs. day before yesterday)
        btc_rsi_now  = df.at[today, "btc_rsi"]
        eth_rsi_now  = df.at[today, "eth_rsi"]
        btc_rsi_prev = df.at[yday,  "btc_rsi"]
        eth_rsi_prev = df.at[yday,  "eth_rsi"]

        def cross_above(now, prev, level):
            # Check for valid numbers and standard cross
            if math.isnan(now) or math.isnan(prev):
                return False
            return now >= level and prev < level

        def cross_below(now, prev, level):
            # Check for valid numbers and standard cross
            if math.isnan(now) or math.isnan(prev):
                return False
            return now < level and prev > level

        btc_open = pos_btc.qty > 0
        eth_open = pos_eth.qty > 0

        # Momentum from ETH/BTC RSI
        eb_rsi = df.at[today, "eth_btc_rsi"]
        if math.isnan(eb_rsi):
            eth_mom = btc_mom = 0.5
        else:
            eth_mom = (eb_rsi / 100.0) + 0.5
            btc_mom = (1.0 - (eb_rsi / 100.0)) + 0.5
        eth_mom = eth_mom ** p.momentum_exponent
        btc_mom = btc_mom ** p.momentum_exponent

        # default desired weights (long-only)
        w_btc = btc_mom
        w_eth = eth_mom

        # entry/exit signals steer weights to 0/positive
        if btc_open:
            if cross_below(btc_rsi_now, btc_rsi_prev, rsi_exit):
                w_btc = 0.0
        else:
            if cross_above(btc_rsi_now, btc_rsi_prev, rsi_entry):
                pass  # keep momentum-driven positive weight
            else:
                w_btc = 0.0

        if eth_open:
            if cross_below(eth_rsi_now, eth_rsi_prev, rsi_exit):
                w_eth = 0.0
        else:
            if cross_above(eth_rsi_now, eth_rsi_prev, rsi_entry):
                pass
            else:
                w_eth = 0.0

        # Normalize to sum<=1 and then scale by allocation
        w_sum = w_btc + w_eth
        if w_sum > 0:
            w_btc /= w_sum
            w_eth /= w_sum
        total_equity = cash + pos_btc.value + pos_eth.value
        investable = total_equity * p.allocation
        target_btc_val = investable * w_btc
        target_eth_val = investable * w_eth

        # Rebalance if difference exceeds threshold (absolute dollar change)
        def rebalance(pos: Position, target_value: float, px: float, label: str):
            nonlocal cash, trades
            delta = target_value - pos.value
            if abs(delta) < (p.rebalance_threshold * total_equity):
                return
            fee = 0.0
            if delta > 0:
                # buy
                total_cost = delta * (1.0 + p.trading_fee)  # Total cost including fees
                # Check if we have enough cash
                if total_cost > cash:
                    # Adjust delta to match available cash
                    delta = cash / (1.0 + p.trading_fee)
                    # Skip if adjusted size is below threshold
                    if abs(delta) < (p.rebalance_threshold * total_equity):
                        return
                qty = (delta * (1.0 - p.trading_fee)) / px
                fee = delta * p.trading_fee
                pos.qty += qty
                cash -= (delta + fee)  # Deduct both the trade amount and fee
            else:
                # sell
                sell_val = -delta
                qty = min(pos.qty, sell_val / px)
                actual_val = qty * px
                fee = actual_val * p.trading_fee
                pos.qty -= qty
                cash += (actual_val * (1.0 - p.trading_fee))
            # record trade
            # Calculate portfolio breakdown at this point
            btc_value = pos_btc.qty * btc_px
            eth_value = pos_eth.qty * eth_px
            usdt_value = cash
            
            # Determine if this is a buy or sell
            side = "BUY" if delta > 0 else "SELL"
            
            # Calculate BTC HODL value
            btc_hodl_value = btc_hodl_qty * btc_px
            
            trades.append({
                "side": side,
                "time": today.isoformat(),
                "symbol": label,
                "target_value": round(target_value, 2),
                "price": round(px, 2),
                "fee": round(fee, 4),
                "qty_after": pos.qty,
                "value_after": pos.qty * px,
                "usdt_value": round(usdt_value, 2),
                "btc_value": round(btc_value, 2),
                "eth_value": round(eth_value, 2),
                "total_portfolio_value": round(usdt_value + btc_value + eth_value, 2),
                "btc_hodl_value": round(btc_hodl_value, 2)
            })

        rebalance(pos_btc, target_btc_val, btc_px, "BTCUSDT")
        rebalance(pos_eth, target_eth_val, eth_px, "ETHUSDT")

        # Update equity
        total_equity = cash + pos_btc.qty * btc_px + pos_eth.qty * eth_px
        equity.append(total_equity)
        dates.append(today)
        
        # Update the corresponding daily performance record
        idx = backtest_dates.get_loc(today)
        daily_perf[idx].update({
            "usdt_value": round(cash, 2),
            "eth_value": round(pos_eth.qty * eth_px, 2),
            "btc_value": round(pos_btc.qty * btc_px, 2),
            "total_portfolio_value": round(total_equity, 2)
        })

    equity = pd.Series(equity, index=pd.Index(dates, name="time"), name="equity").astype(float)

    # Stats
    mdd = max_drawdown(equity)
    annual = cagr(equity, equity.index.to_series())
    # Calculate BTC HODL CAGR using daily data
    btc_hodl_series = pd.Series([d["btc_hodl_value"] for d in daily_perf], 
                               index=pd.Index([pd.Timestamp(d["date"]) for d in daily_perf]))
    btc_hodl_cagr = cagr(btc_hodl_series, btc_hodl_series.index.to_series())
    btc_hodl_mdd = max_drawdown(btc_hodl_series)
    
    print("\n=== Backtest summary (Binance daily) ===")
    print(f"Start:   {equity.index[0].date()}  |  End: {equity.index[-1].date()}  | Points: {len(equity)}")
    print(f"\nStrategy Performance:")
    print(f"CAGR:    {annual*100:.2f}%")
    print(f"Max DD:  {mdd*100:.2f}%")
    print(f"Final equity: ${equity.iloc[-1]:,.2f}")
    print(f"Trades:  {len(trades)}")
    print(f"\nBTC HODL Performance:")
    print(f"CAGR:    {btc_hodl_cagr*100:.2f}%")
    print(f"Max DD:  {btc_hodl_mdd*100:.2f}%")
    print(f"Final value: ${btc_hodl_series.iloc[-1]:,.2f}")
    print(f"\nOutperformance: {(annual - btc_hodl_cagr)*100:.2f}%")
    print("\nSaved: equity_curve.csv, trades.csv")

    # Create daily performance DataFrame and calculate drawdowns
    perf_df = pd.DataFrame(daily_perf)
    
    # Calculate running maximum for drawdown calculations
    perf_df["portfolio_peak"] = perf_df["total_portfolio_value"].expanding().max()
    perf_df["btc_hodl_peak"] = perf_df["btc_hodl_value"].expanding().max()
    
    # Calculate drawdowns
    perf_df["portfolio_dd"] = (perf_df["total_portfolio_value"] / perf_df["portfolio_peak"] - 1.0) * 100
    perf_df["btc_hodl_dd"] = (perf_df["btc_hodl_value"] / perf_df["btc_hodl_peak"] - 1.0) * 100
    
    # Drop intermediate columns used for calculation
    perf_df = perf_df.drop(columns=["portfolio_peak", "btc_hodl_peak"])
    
    # Output CSVs
    equity.to_frame().to_csv("equity_curve.csv")
    pd.DataFrame(trades).to_csv("trades.csv", index=False)
    perf_df.to_csv("portfolio_perf.csv", index=False)
    
    # Print maximum drawdowns from daily data
    print(f"\nMaximum Drawdowns (from daily data):")
    print(f"Strategy: {perf_df['portfolio_dd'].min():.2f}%")
    print(f"BTC HODL: {perf_df['btc_hodl_dd'].min():.2f}%")
    
    print("\nSaved: equity_curve.csv, trades.csv, portfolio_perf.csv")

    # Also return DataFrames if imported
    return equity.to_frame(), pd.DataFrame(trades)


if __name__ == "__main__":
    run_backtest()

