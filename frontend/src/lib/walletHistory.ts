import { loadPriceData } from '@/lib/priceFeed';

export type DepositRec = { timestamp: bigint; user: `0x${string}`; amount: bigint; balanceAfter: bigint };
export type WithdrawalRec = { timestamp: bigint; user: `0x${string}`; asset: `0x${string}`; amount: bigint; balanceAfter: bigint };
export type SwapRec = {
  timestamp: bigint;
  tokenIn: `0x${string}`;
  tokenOut: `0x${string}`;
  amountIn: bigint;
  amountOut: bigint;
  balanceInAfter: bigint;
  balanceOutAfter: bigint;
};

export type AddressMeta = { address: `0x${string}`; symbol: string; decimals: number };

export type WalletEvent =
  | { kind: 'deposit'; ts: number; amount: bigint }
  | { kind: 'withdrawal'; ts: number; asset: `0x${string}`; amount: bigint }
  | { kind: 'swap'; ts: number; tokenIn: `0x${string}`; tokenOut: `0x${string}`; amountIn: bigint; amountOut: bigint; detail?: string; side?: 'buy' | 'sell' };

export type WalletHistoryPoint = {
  date: string;
  totalUsd: number;
  btcQty: number;
  usdcUsd: number;
  btcUsd: number;
  ethUsd: number;
  events?: WalletEvent[];
};

function toLocalDateKeyFromMs(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toLocalDateKey(tsSec: number): string {
  // Use LOCAL date so the chart always includes "today" for the user, and events are bucketed by the user's day.
  return toLocalDateKeyFromMs(tsSec * 1000);
}

function localDateFromKey(dateStr: string): Date {
  // dateStr is YYYY-MM-DD
  const [y, m, d] = dateStr.split('-').map((x) => Number(x));
  return new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
}

async function fetchBinanceSpot(symbol: 'BTCUSDT' | 'ETHUSDT'): Promise<number | undefined> {
  try {
    const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
    if (!res.ok) return undefined;
    const json: any = await res.json();
    const px = Number(json?.price);
    return Number.isFinite(px) && px > 0 ? px : undefined;
  } catch {
    return undefined;
  }
}

function numFromBig(amount: bigint, decimals: number): number {
  if (amount === BigInt(0)) return 0;
  const s = amount.toString();
  if (decimals === 0) return Number(s);
  if (s.length <= decimals) {
    const zeros = '0'.repeat(decimals - s.length);
    return Number(`0.${zeros}${s}`);
  }
  const whole = s.slice(0, s.length - decimals);
  const frac = s.slice(s.length - decimals);
  return Number(`${whole}.${frac}`);
}

/** Map token symbol to price feed symbol used by loadPriceData */
function mapSymbolToFeedKey(sym: string): 'BTC' | 'ETH' | null {
  const s = sym.toUpperCase();
  if (s === 'CBBTC' || s === 'WBTC' || s === 'BTC') return 'BTC';
  if (s === 'WETH' || s === 'ETH') return 'ETH';
  return null;
}

export async function buildWalletHistorySeries(args: {
  createdAt: bigint | number;
  stable: AddressMeta;
  risks: AddressMeta[];
  deposits: DepositRec[];
  withdrawals: WithdrawalRec[];
  swaps: SwapRec[];
}): Promise<WalletHistoryPoint[]> {
  const { createdAt, stable, risks } = args;
  const createdTs = typeof createdAt === 'number' ? createdAt : Number(createdAt);
  const startDate = toLocalDateKey(createdTs);
  const endDate = toLocalDateKey(Math.floor(Date.now() / 1000));

  // Build unified chronological event list
  const events: WalletEvent[] = [];
  for (const d of args.deposits) {
    events.push({ kind: 'deposit', ts: Number(d.timestamp), amount: d.amount });
  }
  for (const w of args.withdrawals) {
    events.push({ kind: 'withdrawal', ts: Number(w.timestamp), asset: w.asset, amount: w.amount });
  }
  for (const s of args.swaps) {
    events.push({ kind: 'swap', ts: Number(s.timestamp), tokenIn: s.tokenIn, tokenOut: s.tokenOut, amountIn: s.amountIn, amountOut: s.amountOut });
  }
  events.sort((a, b) => a.ts - b.ts);

  // Load daily prices (BTC, ETH) for the window with a small lookback to ensure recent days are available
  const { btc, eth } = await loadPriceData(startDate, endDate, 2);
  const btcByDate = new Map(btc.map((p) => [p.date, p.close]));
  const ethByDate = new Map(eth.map((p) => [p.date, p.close]));
  const endHasBtc = btcByDate.has(endDate);
  const endHasEth = ethByDate.has(endDate);
  const [btcSpot, ethSpot] = await Promise.all([
    endHasBtc ? Promise.resolve<number | undefined>(undefined) : fetchBinanceSpot('BTCUSDT'),
    endHasEth ? Promise.resolve<number | undefined>(undefined) : fetchBinanceSpot('ETHUSDT'),
  ]);

  // Prepare balances
  let stableBal: bigint = BigInt(0);
  const riskBals = new Map<`0x${string}`, bigint>();
  for (const r of risks) riskBals.set(r.address, BigInt(0));
  const addrToMeta = new Map<string, AddressMeta>();
  addrToMeta.set(stable.address.toLowerCase(), stable);
  for (const r of risks) addrToMeta.set(r.address.toLowerCase(), r);

  // Group events by day
  const eventsByDate = new Map<string, WalletEvent[]>();
  for (const e of events) {
    const dk = toLocalDateKey(e.ts);
    const arr = eventsByDate.get(dk) || [];
    arr.push(e);
    eventsByDate.set(dk, arr);
  }

  // Iterate day by day
  const out: WalletHistoryPoint[] = [];
  let btcFallbackCount = 0;
  let ethFallbackCount = 0;
  const start = localDateFromKey(startDate);
  const end = localDateFromKey(endDate);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dk = toLocalDateKeyFromMs(d.getTime());
    const todays = eventsByDate.get(dk) || [];
    // Apply today's events
    for (const ev of todays) {
      if (ev.kind === 'deposit') {
        stableBal += ev.amount;
      } else if (ev.kind === 'withdrawal') {
        if (ev.asset.toLowerCase() === stable.address.toLowerCase()) {
          stableBal -= ev.amount;
        } else {
          const prev = riskBals.get(ev.asset) || BigInt(0);
          riskBals.set(ev.asset, prev - ev.amount);
        }
      } else if (ev.kind === 'swap') {
        const inIsStable = ev.tokenIn.toLowerCase() === stable.address.toLowerCase();
        const outIsStable = ev.tokenOut.toLowerCase() === stable.address.toLowerCase();
        if (inIsStable) {
          stableBal -= ev.amountIn;
          const prevOut = riskBals.get(ev.tokenOut) || BigInt(0);
          riskBals.set(ev.tokenOut, prevOut + ev.amountOut);
        } else if (outIsStable) {
          const prevIn = riskBals.get(ev.tokenIn) || BigInt(0);
          riskBals.set(ev.tokenIn, prevIn - ev.amountIn);
          stableBal += ev.amountOut;
        } else {
          // risk -> risk (rare): decrement in, increment out
          const prevIn = riskBals.get(ev.tokenIn) || BigInt(0);
          const prevOut = riskBals.get(ev.tokenOut) || BigInt(0);
          riskBals.set(ev.tokenIn, prevIn - ev.amountIn);
          riskBals.set(ev.tokenOut, prevOut + ev.amountOut);
        }
      }
    }

    // Compute USD value and BTC qty at close of day
    let usdcUsd = numFromBig(stableBal, stable.decimals); // stable ~ USD
    let total = usdcUsd;
    let btcQty = 0;
    let btcUsd = 0;
    let ethUsd = 0;
    // Iterate over current balances by token address to ensure we include tokens seen only in events/swaps
    for (const [addr, bal] of riskBals.entries()) {
      if (bal === BigInt(0)) continue;
      const meta = addrToMeta.get(addr.toLowerCase());
      if (!meta) continue;
      const qty = numFromBig(bal, meta.decimals);
      if (qty === 0) continue;
      const key = mapSymbolToFeedKey(meta.symbol);
      if (!key) continue;
      let px = key === 'BTC' ? btcByDate.get(dk) : ethByDate.get(dk);
      if (px === undefined) {
        // If we're on "today", prefer a live spot price so the chart includes today's value up to now.
        if (dk === endDate) {
          const spot = key === 'BTC' ? btcSpot : ethSpot;
          if (spot !== undefined) px = spot;
        }
      }
      if (px === undefined) {
        // Fallback to previous day's close if today's price isn't available yet
        const prev = new Date(d);
        prev.setDate(prev.getDate() - 1);
        const prevKey = toLocalDateKeyFromMs(prev.getTime());
        px = key === 'BTC' ? btcByDate.get(prevKey) : ethByDate.get(prevKey);
        if (px !== undefined) {
          if (key === 'BTC') btcFallbackCount++; else ethFallbackCount++;
        }
      }
      if (key === 'BTC') btcQty += qty;
      if (px !== undefined) {
        const usd = qty * px;
        total += usd;
        if (key === 'BTC') btcUsd += usd;
        if (key === 'ETH') ethUsd += usd;
      }
    }

    // Enrich today's events (for tooltip)
    const enriched: WalletEvent[] | undefined = todays.length
      ? todays.map((ev) => {
          if (ev.kind !== 'swap') return ev;
          const inMeta = addrToMeta.get(ev.tokenIn.toLowerCase());
          const outMeta = addrToMeta.get(ev.tokenOut.toLowerCase());
          const amtInNum = inMeta ? numFromBig(ev.amountIn, inMeta.decimals) : Number(ev.amountIn);
          const amtOutNum = outMeta ? numFromBig(ev.amountOut, outMeta.decimals) : Number(ev.amountOut);
          // determine price for the risk asset involved
          let price: number | undefined;
          const riskSym = outMeta && ev.tokenIn.toLowerCase() === stable.address.toLowerCase() ? outMeta.symbol : inMeta?.symbol;
          const key = riskSym ? mapSymbolToFeedKey(riskSym) : null;
          if (key) {
            const px = key === 'BTC' ? btcByDate.get(dk) : ethByDate.get(dk);
            if (px !== undefined) price = px;
          }
          const priceStr = price !== undefined ? `$${price.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '';
          const inIsStable = ev.tokenIn.toLowerCase() === stable.address.toLowerCase();
          const outIsStable = ev.tokenOut.toLowerCase() === stable.address.toLowerCase();
          if (inIsStable && outMeta) {
            const detail = `BUY ${amtOutNum} ${outMeta.symbol}${priceStr ? ` @ ${priceStr}` : ''}`;
            return { ...ev, detail, side: 'buy' } as WalletEvent;
          }
          if (outIsStable && inMeta) {
            const detail = `SELL ${amtInNum} ${inMeta.symbol}${priceStr ? ` @ ${priceStr}` : ''}`;
            return { ...ev, detail, side: 'sell' } as WalletEvent;
          }
          const detail = `${'Swap'} ${amtInNum} ${inMeta?.symbol || ''} for ${amtOutNum} ${outMeta?.symbol || ''}${priceStr ? ` @ ${priceStr}` : ''}`;
          return { ...ev, detail } as WalletEvent;
        })
      : undefined;

    out.push({ date: dk, totalUsd: total, btcQty, usdcUsd, btcUsd, ethUsd, events: enriched });
  }

  return out;
}


