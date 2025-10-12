#!/usr/bin/env python3
import argparse
import datetime as dt
import math
import time
from collections import deque
from typing import Deque, Tuple

import numpy as np
import pandas as pd
import requests

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
        start_ms = int(last_close) + 1  # move cursor one ms after last close
        time.sleep(0.2)  # polite pause
    if not frames:
        raise RuntimeError(f"No data returned for {symbol}")
    out = pd.concat(frames, ignore_index=True)
    out = out.drop_duplicates(subset=["time"]).sort_values("time").reset_index(drop=True)
    out["time"] = out["time"].dt.tz_convert("UTC")
    return out

# ------------------------------
# Strategy helpers
# ------------------------------

def annualize_from_window(sum_r2_window: float, window_len_days: int) -> float:
    """Annualized vol from rolling realized variance over N daily returns."""
    if window_len_days <= 0 or sum_r2_window < 0:
        return 0.0
    return math.sqrt(sum_r2_window * (365.0 / window_len_days))

def ewma_update_sigma2(prev_sigma2: float, r: float, lam: float) -> float:
    """EWMA variance update: sigma2_t = lam*sigma2_{t-1} + (1-lam)*r^2"""
    return lam * prev_sigma2 + (1.0 - lam) * (r * r)

def fmt_date(ts: pd.Timestamp) -> str:
    return ts.tz_convert("UTC").strftime("%Y-%m-%d")

# ------------------------------
# SIMPLE DCA benchmark
# ------------------------------

def simulate_simple_dca(px: pd.DataFrame, initial_capital: float, base_dca_usdc: float, min_trade_usd: float) -> dict:
    """Buy base_dca_usdc in BTC every day (if cash available)."""
    usdc = float(initial_capital)
    btc = 0.0
    trades = 0
    for _, row in px.iterrows():
        price = float(row["close"])
        buy_usd = min(usdc, base_dca_usdc)
        if buy_usd >= min_trade_usd and price > 0:
            btc += buy_usd / price
            usdc -= buy_usd
            trades += 1

    final_price = float(px.iloc[-1]["close"])
    final_nav = usdc + btc * final_price
    returns_abs = final_nav - initial_capital
    roi = returns_abs / initial_capital if initial_capital > 0 else 0.0
    days = max(1, (px.iloc[-1]["time"] - px.iloc[0]["time"]).days)
    years = days / 365.0
    ann_roi = (1.0 + roi) ** (1.0 / years) - 1.0 if years > 0 else roi

    return {
        "ROI_%": roi * 100.0,
        "Annualized_ROI_%": ann_roi * 100.0,
        "Returns_$": returns_abs,
        "Final_Portfolio_$": final_nav,
        "Final_BTC": btc,
        "Final_USDC": usdc,
        "Trades": trades,
    }

# ------------------------------
# Backtest core
# ------------------------------

def run_backtest(
    initial_capital_usdc: float,
    start_date: str,
    end_date: str,
    symbol: str = "BTCUSDT",
    interval: str = "1d",
    lookback_days: int = 30,       # rolling RV window
    ewma_lambda_daily: float = 0.94,
    base_dca_usdc: float = 50.0,   # base DCA per day
    target_btc_weight: float = 0.70,
    band_delta: float = 0.10,      # ±10% band
    k_kicker: float = 0.05,        # vol/drawdown sizing coefficient
    cmax_mult: float = 3.0,        # cap extra buy per day = cmax_mult * base_dca
    buffer_mult: float = 9.0,      # aim to keep this many days of base DCA in USDC buffer
    min_trade_usd: float = 5.0,    # don't print dust trades
    winsorize_abs_ret: float = 0.20, # clip daily return to ±20% to avoid data glitches
    threshold_mode: bool = False,
    rebalance_cap_frac: float = 0.25  # cap any single rebalance trade to 25% of NAV
) -> Tuple[pd.DataFrame, dict, dict]:
    """
    Executes:
      - Buy-only Adaptive DCA + Bands when inside the band (and always if threshold_mode=False)
      - True threshold rebalancing to the band boundary when outside the band (if threshold_mode=True).
    Prints trades with header and returns (price_df, summary, simple_dca_summary).
    """
    # Parse dates (naive -> UTC)
    start_dt = pd.Timestamp(start_date, tz="UTC")
    end_dt   = pd.Timestamp(end_date,   tz="UTC")

    # Fetch prices
    px = fetch_binance_klines(symbol, interval, start_dt, end_dt)
    px = px[(px["time"] >= start_dt) & (px["time"] <= end_dt)].reset_index(drop=True)

    if len(px) < lookback_days + 5:
        raise RuntimeError("Not enough data for the requested period.")

    # Initialize portfolio
    usdc = float(initial_capital_usdc)
    btc  = 0.0

    # Rolling RV state: ring buffer (deque) of r^2
    buf: Deque[float] = deque(maxlen=lookback_days)
    sum_r2 = 0.0

    # EWMA state (daily)
    ewma_sigma2 = 0.0

    # Buffer target
    buffer_target = buffer_mult * base_dca_usdc

    # Running peak for drawdown
    running_peak = float(px.loc[0, "close"])

    prev_close = None
    warmup_returns = []

    trades_count = 0
    printed_header = False

    for _, row in px.iterrows():
        date = row["time"]
        price = float(row["close"])

        # Update running peak / drawdown
        running_peak = max(running_peak, price)
        drawdown = 0.0 if running_peak <= 0 else max(0.0, 1.0 - price / running_peak)

        # Return
        if prev_close is None:
            r = 0.0
        else:
            r = math.log(price / prev_close) if prev_close > 0 else 0.0
            r = max(-winsorize_abs_ret, min(winsorize_abs_ret, r))
        prev_close = price

        # Rolling RV update
        r2 = r * r
        if len(buf) == lookback_days:
            # about to overwrite left-most; remove it from sum first
            sum_r2 -= buf[0]
        buf.append(r2)
        sum_r2 += r2

        # EWMA update (after warmup)
        if len(warmup_returns) < min(10, lookback_days//3):
            warmup_returns.append(r2)
            if len(warmup_returns) == min(10, lookback_days//3):
                ewma_sigma2 = float(np.mean(warmup_returns))
        else:
            lam = ewma_lambda_daily
            ewma_sigma2 = ewma_update_sigma2(ewma_sigma2, r, lam)

        # Compute vols (annualized)
        rv_ann = annualize_from_window(sum_r2, len(buf)) if len(buf) > 0 else 0.0
        ewma_ann = math.sqrt(ewma_sigma2 * 365.0) if ewma_sigma2 > 0 else 0.0
        sigma_ann = max(rv_ann, ewma_ann)

        # Portfolio stats BEFORE trading today
        nav = usdc + btc * price
        btc_value = btc * price
        w_btc = 0.0 if nav <= 0 else (btc_value / nav)

        # Band
        w_minus = max(0.0, target_btc_weight - band_delta)
        w_plus  = min(1.0, target_btc_weight + band_delta)

        # --------------------------
        # Threshold-mode branch
        # --------------------------
        if threshold_mode and nav > 0:
            # If outside band → rebalance to boundary (single trade), else run normal buy logic
            if w_btc > w_plus:
                # SELL BTC down to w_plus
                target_btc_value = w_plus * nav
                excess_usd = max(0.0, btc_value - target_btc_value)
                # Cap by rebalance_cap_frac * NAV
                trade_usd = min(excess_usd, rebalance_cap_frac * nav)
                if trade_usd >= min_trade_usd and price > 0:
                    btc_to_sell = trade_usd / price
                    # Execute sell
                    btc_to_sell = min(btc_to_sell, btc)  # cannot sell more than we have
                    trade_usd = btc_to_sell * price      # recompute in case of cap by holdings
                    btc -= btc_to_sell
                    usdc += trade_usd
                    trades_count += 1
                    # Post-trade portfolio values
                    nav_after = usdc + btc * price
                    btc_value_after = btc * price
                    usdc_value_after = usdc
                    if not printed_header:
                        print("date, side, asset, amount, price, usd_value, usdc_value, btc_value, nav, w_minus, w_plus")
                        printed_header = True
                    print(f"{fmt_date(date)}, SELL, BTC, {btc_to_sell:.8f}, {price:.2f}, {trade_usd:.2f}, "
                          f"{usdc_value_after:.2f}, {btc_value_after:.2f}, {nav_after:.2f}, {w_minus*100:.2f}%, {w_plus*100:.2f}%")
                # If we didn't trade (too small), we fall through and do nothing else today
                continue

            elif w_btc < w_minus:
                # BUY BTC up to w_minus
                target_btc_value = w_minus * nav
                shortfall_usd = max(0.0, target_btc_value - btc_value)
                # Cap by cash and rebalance cap
                trade_usd = min(shortfall_usd, usdc, rebalance_cap_frac * nav)
                if trade_usd >= min_trade_usd and price > 0:
                    btc_to_buy = trade_usd / price
                    # Execute buy
                    btc += btc_to_buy
                    usdc -= trade_usd
                    trades_count += 1
                    nav_after = usdc + btc * price
                    btc_value_after = btc * price
                    usdc_value_after = usdc
                    if not printed_header:
                        print("date, side, asset, amount, price, usd_value, usdc_value, btc_value, nav, w_minus, w_plus")
                        printed_header = True
                    print(f"{fmt_date(date)}, BUY, BTC, {btc_to_buy:.8f}, {price:.2f}, {trade_usd:.2f}, "
                          f"{usdc_value_after:.2f}, {btc_value_after:.2f}, {nav_after:.2f}, {w_minus:.4f}, {w_plus:.4f}")
                # Regardless, if we were outside band we don't also run base DCA/kicker today.
                continue
            # else: inside band → fall through to normal buy-only logic

        # --------------------------
        # Buy-only logic (inside band or threshold_mode disabled)
        # --------------------------
        buy_budget = 0.0

        # 1) Base DCA
        available_to_spend = max(0.0, usdc - buffer_target)
        base_buy = min(base_dca_usdc, usdc)  # spend from cash by default
        # Strict buffer option would be:
        # base_buy = min(base_dca_usdc, available_to_spend)
        buy_budget += base_buy

        # 2) Volatility-scaled kicker
        extra_buy = k_kicker * sigma_ann * drawdown * nav
        extra_cap = cmax_mult * base_dca_usdc
        extra_buy = min(extra_buy, extra_cap)
        extra_buy = min(extra_buy, available_to_spend)
        buy_budget += max(0.0, extra_buy)

        # Final cap by available USDC
        buy_usd = min(usdc, buy_budget)

        # Execute buy
        if buy_usd >= min_trade_usd and price > 0:
            btc_bought = buy_usd / price
            btc += btc_bought
            usdc -= buy_usd
            trades_count += 1
            nav_after = usdc + btc * price
            btc_value_after = btc * price
            usdc_value_after = usdc
            if not printed_header:
                print("date, side, asset, amount, price, usd_value, usdc_value, btc_value, nav, w_minus, w_plus")
                printed_header = True
            print(f"{fmt_date(date)}, BUY, BTC, {btc_bought:.8f}, {price:.2f}, {buy_usd:.2f}, "
                  f"{usdc_value_after:.2f}, {btc_value_after:.2f}, {nav_after:.2f}, {w_minus:.4f}, {w_plus:.4f}")

    # Summary for strategy
    last_price = float(px.iloc[-1]["close"])
    final_nav = usdc + btc * last_price
    returns_abs = final_nav - initial_capital_usdc
    roi = 0.0 if initial_capital_usdc <= 0 else returns_abs / initial_capital_usdc
    days = max(1, (px.iloc[-1]["time"] - px.iloc[0]["time"]).days)
    years = days / 365.0
    ann_roi = (1.0 + roi) ** (1.0 / years) - 1.0 if years > 0 else roi

    summary = {
        "ROI_%": roi * 100.0,
        "Annualized_ROI_%": ann_roi * 100.0,
        "Returns_$": returns_abs,
        "Final_Portfolio_$": final_nav,
        "Final_BTC": btc,
        "Final_USDC": usdc,
        "Start": fmt_date(px.iloc[0]["time"]),
        "End": fmt_date(px.iloc[-1]["time"]),
        "Days": days,
        "Trades": trades_count,
    }

    # SIMPLE DCA benchmark
    dca_summary = simulate_simple_dca(px, initial_capital_usdc, base_dca_usdc, min_trade_usd)

    # Print summaries
    print("\n--- SUMMARY ---")
    print(f"Period: {summary['Start']} → {summary['End']}  ({summary['Days']} days)")
    print(f"Trades: {summary['Trades']}")
    print(f"Final portfolio value: ${summary['Final_Portfolio_$']:.2f}")
    print(f"Returns ($): ${summary['Returns_$']:.2f}")
    print(f"ROI %: {summary['ROI_%']:.2f}%")
    print(f"Annualized ROI %: {summary['Annualized_ROI_%']:.2f}%")
    print(f"Final BTC balance: {summary['Final_BTC']:.8f}")
    print(f"Final USDC balance: ${summary['Final_USDC']:.2f}")

    print("\n--- SIMPLE DCA SUMMARY ---")
    print(f"Trades: {dca_summary['Trades']}")
    print(f"Final portfolio value: ${dca_summary['Final_Portfolio_$']:.2f}")
    print(f"Returns ($): ${dca_summary['Returns_$']:.2f}")
    print(f"ROI %: {dca_summary['ROI_%']:.2f}%")
    print(f"Annualized ROI %: {dca_summary['Annualized_ROI_%']:.2f}%")
    print(f"Final BTC balance: {dca_summary['Final_BTC']:.8f}")
    print(f"Final USDC balance: ${dca_summary['Final_USDC']:.2f}")

    return px, summary, dca_summary

# ------------------------------
# CLI
# ------------------------------

def parse_args():
    p = argparse.ArgumentParser(
        description="Adaptive DCA + Bands (BTC) with Rolling RV/EWMA, optional True Threshold Rebalancing, and Simple DCA benchmark."
    )
    p.add_argument("--initial-capital", type=float, required=True, help="Initial USDC capital, e.g. 10000")
    p.add_argument("--start", type=str, required=True, help="Start date (YYYY-MM-DD)")
    p.add_argument("--end", type=str, required=True, help="End date (YYYY-MM-DD)")
    p.add_argument("--base-dca", type=float, default=50.0, help="Base DCA per day in USDC (default 50)")
    p.add_argument("--lookback", type=int, default=30, help="Lookback window (days) for rolling RV (default 30)")
    p.add_argument("--lambda-daily", type=float, default=0.94, help="EWMA daily lambda (default 0.94)")
    p.add_argument("--w-target", type=float, default=0.70, help="Target BTC weight (default 0.70)")
    p.add_argument("--band", type=float, default=0.10, help="No-trade band half-width (default 0.10)")
    p.add_argument("--k", type=float, default=0.05, help="Volatility kicker coefficient (default 0.05)")
    p.add_argument("--cmax", type=float, default=3.0, help="Max extra buy multiple of base DCA (default 3)")
    p.add_argument("--buffer-mult", type=float, default=9.0, help="Days of base DCA to keep as USDC buffer (default 9)")
    p.add_argument("--min-trade", type=float, default=5.0, help="Minimum trade USD to print/execute (default 5)")
    p.add_argument("--winsor", type=float, default=0.20, help="Winsorize absolute daily log-return (default 0.20)")
    p.add_argument("--threshold-mode", action="store_true", help="Enable true threshold rebalancing to band boundary.")
    p.add_argument("--rebalance-cap", type=float, default=0.25, help="Max fraction of NAV per single rebalance trade (default 0.25)")
    return p.parse_args()

def main():
    args = parse_args()
    run_backtest(
        initial_capital_usdc=args.initial_capital,
        start_date=args.start,
        end_date=args.end,
        base_dca_usdc=args.base_dca,
        lookback_days=args.lookback,
        ewma_lambda_daily=args.lambda_daily,
        target_btc_weight=args.w_target,
        band_delta=args.band,
        k_kicker=args.k,
        cmax_mult=args.cmax,
        buffer_mult=args.buffer_mult,
        min_trade_usd=args.min_trade,
        winsorize_abs_ret=args.winsor,
        threshold_mode=args.threshold_mode,
        rebalance_cap_frac=args.rebalance_cap,
    )

if __name__ == "__main__":
    main()
