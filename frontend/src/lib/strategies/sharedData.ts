import type { PriceData } from '@/lib/types';

async function fetchBinanceKlines(symbol: string, interval: string, startMs: number, endMs: number): Promise<PriceData[]> {
  const limit = 1000;
  const allData: PriceData[] = [];
  let currentStartMs = startMs;

  while (currentStartMs < endMs) {
    const params = new URLSearchParams({
      symbol,
      interval,
      limit: limit.toString(),
      startTime: currentStartMs.toString(),
      endTime: endMs.toString(),
    });

    const response = await fetch(`https://api.binance.com/api/v3/klines?${params}`);
    if (!response.ok) {
      throw new Error(`Binance API error: ${response.statusText}`);
    }

    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) break;

    for (const candle of data) {
      const closeTime = new Date(candle[6]);
      const closePrice = parseFloat(candle[4]);
      const dateStr = closeTime.toISOString().split('T')[0];

      allData.push({ date: dateStr, close: closePrice });
    }

    const lastCloseTime = data[data.length - 1][6];
    currentStartMs = lastCloseTime + 1;

    await new Promise(resolve => setTimeout(resolve, 200));
  }

  const uniqueData = Array.from(new Map(allData.map(item => [item.date, item])).values()).sort((a, b) => a.date.localeCompare(b.date));
  return uniqueData;
}

export async function loadPriceData(
  startDate: string,
  endDate: string,
  lookbackDays: number = 210
): Promise<{ btc: PriceData[], eth: PriceData[] }> {
  const start = new Date(startDate);
  const lookbackStart = new Date(start);
  lookbackStart.setDate(lookbackStart.getDate() - lookbackDays);

  const startMs = lookbackStart.getTime();
  const endMs = new Date(endDate).getTime();

  const [btc, eth] = await Promise.all([
    fetchBinanceKlines('BTCUSDT', '1d', startMs, endMs),
    fetchBinanceKlines('ETHUSDT', '1d', startMs, endMs),
  ]);

  return { btc, eth };
}

export async function loadBtcOnly(
  startDate: string,
  endDate: string,
  lookbackDays: number = 30
): Promise<PriceData[]> {
  const start = new Date(startDate);
  const lookbackStart = new Date(start);
  lookbackStart.setDate(lookbackStart.getDate() - lookbackDays);

  const startMs = lookbackStart.getTime();
  const endMs = new Date(endDate).getTime();
  return fetchBinanceKlines('BTCUSDT', '1d', startMs, endMs);
}


