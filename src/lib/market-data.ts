import type { MarketSymbol, Candle } from "@/types";

// Popular symbols with base prices for simulation
export const POPULAR_SYMBOLS: Omit<MarketSymbol, "price" | "change" | "changePercent">[] = [
  { symbol: "AAPL", name: "Apple Inc.", type: "stock" },
  { symbol: "MSFT", name: "Microsoft Corp.", type: "stock" },
  { symbol: "GOOGL", name: "Alphabet Inc.", type: "stock" },
  { symbol: "AMZN", name: "Amazon.com Inc.", type: "stock" },
  { symbol: "NVDA", name: "NVIDIA Corp.", type: "stock" },
  { symbol: "TSLA", name: "Tesla Inc.", type: "stock" },
  { symbol: "META", name: "Meta Platforms", type: "stock" },
  { symbol: "SPY", name: "SPDR S&P 500 ETF", type: "etf" },
  { symbol: "QQQ", name: "Invesco QQQ Trust", type: "etf" },
  { symbol: "BTC", name: "Bitcoin", type: "crypto" },
  { symbol: "ETH", name: "Ethereum", type: "crypto" },
  { symbol: "SOL", name: "Solana", type: "crypto" },
];

// Base prices (approximate realistic starting points)
const BASE_PRICES: Record<string, number> = {
  AAPL: 230,
  MSFT: 430,
  GOOGL: 175,
  AMZN: 195,
  NVDA: 140,
  TSLA: 250,
  META: 580,
  SPY: 580,
  QQQ: 510,
  BTC: 65000,
  ETH: 3400,
  SOL: 150,
};

// Simple seeded random for reproducible simulation
function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// Generate realistic-looking current prices with daily drift
export function getSimulatedPrices(): MarketSymbol[] {
  const now = Date.now();
  const daySeed = Math.floor(now / 86400000);

  return POPULAR_SYMBOLS.map((s) => {
    const base = BASE_PRICES[s.symbol] ?? 100;
    const noise = (seededRandom(daySeed + s.symbol.charCodeAt(0)) - 0.5) * 0.04;
    const intraDay = (seededRandom(now / 60000 + s.symbol.length) - 0.5) * 0.01;
    const price = base * (1 + noise + intraDay);
    const changePercent = (noise + intraDay) * 100;
    const change = price * (changePercent / 100);

    return {
      ...s,
      price: Math.round(price * 100) / 100,
      change: Math.round(change * 100) / 100,
      changePercent: Math.round(changePercent * 100) / 100,
    };
  });
}

export function getSymbolPrice(symbol: string): number {
  const all = getSimulatedPrices();
  const found = all.find((s) => s.symbol === symbol);
  return found?.price ?? BASE_PRICES[symbol] ?? 100;
}

// Generate OHLCV candles for backtesting (geometric Brownian motion)
export function generateHistoricalCandles(
  symbol: string,
  startDate: string,
  endDate: string,
  intervalDays = 1
): Candle[] {
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  if (end <= start) return [];

  const base = BASE_PRICES[symbol] ?? 100;
  const candles: Candle[] = [];
  let price = base * 0.7;
  const msPerCandle = intervalDays * 86400000;
  let t = start;
  let seed = symbol.charCodeAt(0) * 1000;

  const vol = symbol === "BTC" || symbol === "ETH" || symbol === "SOL" ? 0.6 : 0.25;
  const drift = 0.08;

  while (t <= end) {
    const dt = intervalDays / 252;
    const shock = (seededRandom(seed++) - 0.5) * 2 * Math.sqrt(dt) * vol;
    const ret = drift * dt + shock;
    const open = price;
    const close = price * (1 + ret);
    const high = Math.max(open, close) * (1 + Math.abs(seededRandom(seed++)) * 0.01);
    const low = Math.min(open, close) * (1 - Math.abs(seededRandom(seed++)) * 0.01);
    const volume = Math.floor(1_000_000 * (0.5 + seededRandom(seed++)));

    candles.push({
      time: Math.floor(t / 1000),
      open: +open.toFixed(2),
      high: +high.toFixed(2),
      low: +low.toFixed(2),
      close: +close.toFixed(2),
      volume,
    });

    price = close;
    t += msPerCandle;
  }

  return candles;
}

// Simple SMA
export function sma(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
      continue;
    }
    let sum = 0;
    for (let j = 0; j < period; j++) sum += data[i - j];
    result.push(sum / period);
  }
  return result;
}

// RSI
export function rsi(closes: number[], period = 14): (number | null)[] {
  const result: (number | null)[] = new Array(closes.length).fill(null);
  if (closes.length < period + 1) return result;

  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    result[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return result;
}
