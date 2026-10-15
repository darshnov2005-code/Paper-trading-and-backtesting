import type { MarketSymbol, Candle } from "@/types";

export const POPULAR_SYMBOLS: Omit<MarketSymbol, "price" | "change" | "changePercent">[] = [
  { symbol: "NIFTY", name: "Nifty 50", type: "index" },
  { symbol: "BANKNIFTY", name: "Bank Nifty", type: "index" },
  { symbol: "FINNIFTY", name: "Fin Nifty", type: "index" },
  { symbol: "MIDCPNIFTY", name: "Midcap Nifty", type: "index" },
  { symbol: "RELIANCE", name: "Reliance Industries", type: "stock" },
  { symbol: "TCS", name: "Tata Consultancy", type: "stock" },
  { symbol: "HDFCBANK", name: "HDFC Bank", type: "stock" },
  { symbol: "INFY", name: "Infosys", type: "stock" },
  { symbol: "ICICIBANK", name: "ICICI Bank", type: "stock" },
  { symbol: "SBIN", name: "State Bank of India", type: "stock" },
  { symbol: "BHARTIARTL", name: "Bharti Airtel", type: "stock" },
  { symbol: "ITC", name: "ITC Limited", type: "stock" },
  { symbol: "LT", name: "Larsen & Toubro", type: "stock" },
  { symbol: "KOTAKBANK", name: "Kotak Mahindra Bank", type: "stock" },
  { symbol: "AXISBANK", name: "Axis Bank", type: "stock" },
  { symbol: "WIPRO", name: "Wipro", type: "stock" },
  { symbol: "HCLTECH", name: "HCL Technologies", type: "stock" },
  { symbol: "BAJFINANCE", name: "Bajaj Finance", type: "stock" },
  { symbol: "ASIANPAINT", name: "Asian Paints", type: "stock" },
  { symbol: "MARUTI", name: "Maruti Suzuki", type: "stock" },
];

const BASE_PRICES: Record<string, number> = {
  NIFTY: 24500, BANKNIFTY: 52000, FINNIFTY: 23500, MIDCPNIFTY: 12500,
  RELIANCE: 1280, TCS: 4100, HDFCBANK: 1720, INFY: 1850, ICICIBANK: 1280,
  SBIN: 820, BHARTIARTL: 1650, ITC: 470, LT: 3600, KOTAKBANK: 1780,
  AXISBANK: 1150, WIPRO: 540, HCLTECH: 1850, BAJFINANCE: 7200,
  ASIANPAINT: 2450, MARUTI: 12500,
};

function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

export function getSimulatedPrices(): MarketSymbol[] {
  const now = Date.now();
  const daySeed = Math.floor(now / 86400000);
  return POPULAR_SYMBOLS.map((s) => {
    const base = BASE_PRICES[s.symbol] ?? 1000;
    const volMult = s.type === "index" ? 0.015 : 0.025;
    const noise = (seededRandom(daySeed + s.symbol.charCodeAt(0) * 7) - 0.5) * volMult * 2;
    const intraDay = (seededRandom(now / 30000 + s.symbol.length * 3) - 0.5) * 0.008;
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
  return all.find((s) => s.symbol === symbol)?.price ?? BASE_PRICES[symbol] ?? 1000;
}

export function generateHistoricalCandles(
  symbol: string,
  startDate: string,
  endDate: string,
  intervalDays = 1
): Candle[] {
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  if (end <= start) return [];
  const base = BASE_PRICES[symbol] ?? 1000;
  const candles: Candle[] = [];
  let price = base * 0.85;
  const msPerCandle = intervalDays * 86400000;
  let t = start;
  let seed = symbol.charCodeAt(0) * 137;
  const isIndex = ["NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY"].includes(symbol);
  const vol = isIndex ? 0.18 : 0.28;
  const drift = 0.12;
  while (t <= end) {
    const dt = intervalDays / 252;
    const shock = (seededRandom(seed++) - 0.5) * 2 * Math.sqrt(dt) * vol;
    const ret = drift * dt + shock;
    const open = price;
    const close = price * (1 + ret);
    const high = Math.max(open, close) * (1 + Math.abs(seededRandom(seed++)) * 0.012);
    const low = Math.min(open, close) * (1 - Math.abs(seededRandom(seed++)) * 0.012);
    candles.push({
      time: Math.floor(t / 1000),
      open: +open.toFixed(2),
      high: +high.toFixed(2),
      low: +low.toFixed(2),
      close: +close.toFixed(2),
      volume: Math.floor((isIndex ? 5_000_000 : 800_000) * (0.4 + seededRandom(seed++))),
    });
    price = close;
    t += msPerCandle;
  }
  return candles;
}

export function generateIntradayCandles(symbol: string, currentPrice: number, count = 60): Candle[] {
  const candles: Candle[] = [];
  let price = currentPrice * 0.992;
  const now = Date.now();
  let seed = symbol.charCodeAt(0) * 91 + Math.floor(now / 60000);
  const isIndex = ["NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY"].includes(symbol);
  const vol = isIndex ? 0.0012 : 0.002;
  for (let i = 0; i < count; i++) {
    const ret = (seededRandom(seed++) - 0.48) * vol * 2;
    const open = price;
    const close = price * (1 + ret);
    const high = Math.max(open, close) * (1 + Math.abs(seededRandom(seed++)) * 0.003);
    const low = Math.min(open, close) * (1 - Math.abs(seededRandom(seed++)) * 0.003);
    candles.push({
      time: Math.floor((now - (count - i) * 5 * 60 * 1000) / 1000),
      open: +open.toFixed(2),
      high: +high.toFixed(2),
      low: +low.toFixed(2),
      close: +close.toFixed(2),
      volume: Math.floor((isIndex ? 200000 : 50000) * (0.5 + seededRandom(seed++))),
    });
    price = close;
  }
  if (candles.length) {
    const last = candles[candles.length - 1];
    last.close = currentPrice;
    last.high = Math.max(last.high, currentPrice);
    last.low = Math.min(last.low, currentPrice);
  }
  return candles;
}

export function sma(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) { result.push(null); continue; }
    let sum = 0;
    for (let j = 0; j < period; j++) sum += data[i - j];
    result.push(sum / period);
  }
  return result;
}

export function rsi(closes: number[], period = 14): (number | null)[] {
  const result: (number | null)[] = new Array(closes.length).fill(null);
  if (closes.length < period + 1) return result;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff; else losses -= diff;
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
