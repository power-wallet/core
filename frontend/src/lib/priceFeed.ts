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

async function loadLocalDaily(symbol: 'btc' | 'eth'): Promise<PriceData[]> {
  const url = `/data/${symbol}_daily.json`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const json = await res.json();
  const mapped: PriceData[] = Array.isArray(json)
    ? json.map((d: any) => ({ date: String(d.date), close: Number(d.close) }))
        .filter(d => Number.isFinite(d.close) && typeof d.date === 'string')
    : [];
  const unique = Array.from(new Map(mapped.map(i => [i.date, i])).values()).sort((a, b) => a.date.localeCompare(b.date));
  return unique;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function mergeUnique(a: PriceData[], b: PriceData[]): PriceData[] {
  const map = new Map<string, PriceData>();
  for (const it of a) map.set(it.date, it);
  for (const it of b) if (!map.has(it.date)) map.set(it.date, it);
  return Array.from(map.values()).sort((x, y) => x.date.localeCompare(y.date));
}

export async function loadPriceData(startDate: string, endDate: string, lookbackDays: number = 210): Promise<{ btc: PriceData[]; eth: PriceData[] }> {
  const start = new Date(startDate);
  const lookbackStart = new Date(start);
  lookbackStart.setDate(lookbackStart.getDate() - lookbackDays);
  const lookbackStartStr = lookbackStart.toISOString().split('T')[0];

  const [btcLocal, ethLocal] = await Promise.all([
    loadLocalDaily('btc'),
    loadLocalDaily('eth'),
  ]);

  const btcLocalWindow = btcLocal.filter(d => d.date >= lookbackStartStr && d.date <= endDate);
  const ethLocalWindow = ethLocal.filter(d => d.date >= lookbackStartStr && d.date <= endDate);

  const lastBtcLocalDate = btcLocalWindow.length ? btcLocalWindow[btcLocalWindow.length - 1].date : '';
  const lastEthLocalDate = ethLocalWindow.length ? ethLocalWindow[ethLocalWindow.length - 1].date : '';

  const needBtcTail = !lastBtcLocalDate || lastBtcLocalDate < endDate;
  const needEthTail = !lastEthLocalDate || lastEthLocalDate < endDate;

  const startMs = lookbackStart.getTime();
  const endMs = new Date(endDate).getTime();

  const [btcTail, ethTail] = await Promise.all([
    needBtcTail ? fetchBinanceKlines('BTCUSDT', '1d', Math.max(new Date(addDays(lastBtcLocalDate || lookbackStartStr, 1)).getTime(), startMs), endMs) : Promise.resolve<PriceData[]>([]),
    needEthTail ? fetchBinanceKlines('ETHUSDT', '1d', Math.max(new Date(addDays(lastEthLocalDate || lookbackStartStr, 1)).getTime(), startMs), endMs) : Promise.resolve<PriceData[]>([]),
  ]);

  return { btc: mergeUnique(btcLocalWindow, btcTail), eth: mergeUnique(ethLocalWindow, ethTail) };
}

export async function loadBtcOnly(startDate: string, endDate: string, lookbackDays: number = 30): Promise<PriceData[]> {
  const start = new Date(startDate);
  const lookbackStart = new Date(start);
  lookbackStart.setDate(lookbackStart.getDate() - lookbackDays);
  const lookbackStartStr = lookbackStart.toISOString().split('T')[0];

  const btcLocal = await loadLocalDaily('btc');
  const btcLocalWindow = btcLocal.filter(d => d.date >= lookbackStartStr && d.date <= endDate);
  const lastLocalDate = btcLocalWindow.length ? btcLocalWindow[btcLocalWindow.length - 1].date : '';

  const needTail = !lastLocalDate || lastLocalDate < endDate;
  if (!needTail) return btcLocalWindow;

  const startMs = Math.max(new Date(addDays(lastLocalDate || lookbackStartStr, 1)).getTime(), lookbackStart.getTime());
  const endMs = new Date(endDate).getTime();
  const tail = await fetchBinanceKlines('BTCUSDT', '1d', startMs, endMs);
  return mergeUnique(btcLocalWindow, tail);
}


