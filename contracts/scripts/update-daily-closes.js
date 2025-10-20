const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const https = require("https");

const BINANCE_URL = "https://api.binance.com/api/v3/klines";

function getJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          res.resume();
          return;
        }
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (err) {
            reject(err);
          }
        });
      })
      .on("error", reject);
  });
}

function buildUrl(base, params) {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) usp.append(k, String(v));
  }
  return `${base}?${usp.toString()}`;
}

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

async function fetchBinanceKlines(symbol, interval, startMs, endMs) {
  const limit = 1000;
  const out = [];
  let cursor = startMs;
  while (cursor < endMs) {
    const url = buildUrl(BINANCE_URL, {
      symbol,
      interval,
      limit,
      startTime: cursor,
      endTime: endMs,
    });
    const batch = await getJson(url);
    if (!Array.isArray(batch) || batch.length === 0) break;
    out.push(...batch);
    const lastCloseTime = batch[batch.length - 1][6];
    cursor = Number(lastCloseTime) + 1;
    await sleep(200);
  }
  return out;
}

function toUtcYmd(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function ymdToUtcDate(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function addDaysUtc(ymd, days) {
  const dt = ymdToUtcDate(ymd);
  dt.setUTCDate(dt.getUTCDate() + days);
  return toUtcYmd(dt);
}

function startOfDayUtcMs(ymd) {
  return ymdToUtcDate(ymd).getTime();
}

function endOfDayUtcMs(ymd) {
  const dt = ymdToUtcDate(ymd);
  dt.setUTCHours(23, 59, 59, 999);
  return dt.getTime();
}

async function readPriceFile(filePath) {
  const content = await fsp.readFile(filePath, "utf8");
  return JSON.parse(content);
}

async function writePriceFile(filePath, data) {
  const json = JSON.stringify(data, null, 4) + "\n";
  await fsp.writeFile(filePath, json, "utf8");
}

async function appendMissing(symbol, fileName) {
  const configDir = path.resolve(__dirname, "../config");
  const filePath = path.join(configDir, fileName);

  const rows = await readPriceFile(filePath);
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(`Price file ${fileName} is empty or invalid`);
  }

  const lastRecorded = rows[rows.length - 1];
  const lastDate = lastRecorded.date;

  const todayUtc = new Date();
  const yesterdayYmd = toUtcYmd(
    new Date(Date.UTC(todayUtc.getUTCFullYear(), todayUtc.getUTCMonth(), todayUtc.getUTCDate() - 1))
  );

  const nextDate = addDaysUtc(lastDate, 1);
  if (nextDate > yesterdayYmd) {
    console.log(`${symbol}: up to date (last ${lastDate})`);
    return;
  }

  const startMs = startOfDayUtcMs(nextDate);
  const endMs = endOfDayUtcMs(yesterdayYmd);

  console.log(`${symbol}: fetching ${nextDate} → ${yesterdayYmd}`);
  const klines = await fetchBinanceKlines(symbol, "1d", startMs, endMs);
  if (!klines.length) {
    console.log(`${symbol}: no new data returned`);
    return;
  }

  const newPoints = klines.map((k) => {
    const closeTime = k[6];
    const close = Number(k[4]);
    const ymd = toUtcYmd(new Date(closeTime));
    return { date: ymd, close };
  });

  const existingDates = new Set(rows.map((r) => r.date));
  const toAppend = newPoints
    .filter((p) => p.date > lastDate && !existingDates.has(p.date))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  if (toAppend.length === 0) {
    console.log(`${symbol}: nothing to append`);
    return;
  }

  const updated = rows.concat(toAppend);
  await writePriceFile(filePath, updated);
  console.log(`${symbol}: appended ${toAppend.length} day(s). New last = ${updated[updated.length - 1].date}`);
}

async function main() {
  await appendMissing("BTCUSDT", "btc_daily.json");
  await appendMissing("ETHUSDT", "eth_daily.json");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
