export type OptionType = "CE" | "PE";

export interface OptionContract {
  symbol: string;
  underlying: string;
  strike: number;
  type: OptionType;
  expiry: string;
  expiryLabel: string;
  lotSize: number;
  premium: number;
  change: number;
  changePercent: number;
  oi?: number;
  delta?: number;
  theta?: number;
  vega?: number;
  gamma?: number;
  iv?: number;
}

const LOTS: Record<string, number> = {
  NIFTY: 25, BANKNIFTY: 15, FINNIFTY: 25, MIDCPNIFTY: 50,
  RELIANCE: 250, TCS: 150, HDFCBANK: 550, INFY: 300,
  ICICIBANK: 700, SBIN: 1500,
};

function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function normCDF(x: number) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp(-x * x / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - p : p;
}

function approxGreeks(spot: number, strike: number, type: OptionType, days: number, iv = 0.16) {
  const t = Math.max(days, 1) / 365;
  const sqrtT = Math.sqrt(t);
  const d1 = (Math.log(spot / strike) + (0.06 + (iv * iv) / 2) * t) / (iv * sqrtT);
  const d2 = d1 - iv * sqrtT;
  const nd1 = normCDF(d1);
  const nd2 = normCDF(d2);
  const pdf = Math.exp(-d1 * d1 / 2) / Math.sqrt(2 * Math.PI);
  const delta = type === "CE" ? nd1 : nd1 - 1;
  const gamma = pdf / (spot * iv * sqrtT);
  const theta = type === "CE"
    ? (-spot * pdf * iv / (2 * sqrtT) - 0.06 * strike * Math.exp(-0.06 * t) * nd2) / 365
    : (-spot * pdf * iv / (2 * sqrtT) + 0.06 * strike * Math.exp(-0.06 * t) * (1 - nd2)) / 365;
  const vega = (spot * pdf * sqrtT) / 100;
  return { delta: +delta.toFixed(3), gamma: +gamma.toFixed(5), theta: +theta.toFixed(2), vega: +vega.toFixed(2), iv: +(iv * 100).toFixed(1) };
}

function approxPremium(spot: number, strike: number, type: OptionType, days: number, iv = 0.16) {
  const t = Math.max(days, 1) / 365;
  const intrinsic = Math.max(0, type === "CE" ? spot - strike : strike - spot);
  const moneyness = Math.abs((spot - strike) / spot);
  const timeValue = spot * iv * Math.sqrt(t) * 0.4 * Math.exp(-moneyness * 3);
  return Math.max(0.05, +(intrinsic + timeValue).toFixed(2));
}

export function getExpiries() {
  const now = new Date();
  const list: { date: string; label: string; days: number }[] = [];
  let d = new Date(now);
  d.setDate(d.getDate() + ((4 - d.getDay() + 7) % 7 || 7));
  for (let i = 0; i < 4; i++) {
    const exp = new Date(d);
    exp.setDate(d.getDate() + i * 7);
    const days = Math.max(1, Math.ceil((exp.getTime() - now.getTime()) / 86400000));
    const label = exp.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }).toUpperCase();
    list.push({ date: exp.toISOString().slice(0, 10), label, days });
  }
  return list;
}

export function generateOptionChain(underlying: string, spot: number, type: OptionType = "CE", expiryIndex = 0): OptionContract[] {
  const lotSize = LOTS[underlying] || 25;
  const expiries = getExpiries();
  const expiry = expiries[Math.min(expiryIndex, expiries.length - 1)];
  const step = underlying.includes("NIFTY") || underlying === "BANKNIFTY" ? 50 : 20;
  const atm = Math.round(spot / step) * step;
  const strikes: number[] = [];
  for (let i = -10; i <= 10; i++) strikes.push(atm + i * step);
  const seedBase = underlying.charCodeAt(0) * 100 + expiry.days + (type === "CE" ? 0 : 77);

  return strikes.map((strike, idx) => {
    const iv = 0.14 + seededRandom(seedBase + idx) * 0.08;
    const premium = approxPremium(spot, strike, type, expiry.days, iv);
    const noise = (seededRandom(seedBase + idx * 2) - 0.5) * 0.06;
    const ltp = Math.max(0.05, +(premium * (1 + noise)).toFixed(2));
    const change = +(ltp * (seededRandom(seedBase + idx * 3) - 0.5) * 0.12).toFixed(2);
    const greeks = approxGreeks(spot, strike, type, expiry.days, iv);
    const expLabel = expiry.label.replace(" ", "");
    return {
      symbol: `${underlying}${expLabel}${strike}${type}`,
      underlying, strike, type,
      expiry: expiry.date, expiryLabel: expiry.label, lotSize,
      premium: ltp, change,
      changePercent: ltp > 0 ? +((change / ltp) * 100).toFixed(2) : 0,
      oi: Math.floor(80000 + seededRandom(seedBase + idx) * 600000),
      ...greeks,
    };
  });
}

export const STRATEGIES = [
  { id: "long_call", name: "Long Call", desc: "Buy CE – bullish" },
  { id: "long_put", name: "Long Put", desc: "Buy PE – bearish" },
  { id: "bull_call", name: "Bull Call Spread", desc: "Buy CE + Sell higher CE" },
  { id: "bear_put", name: "Bear Put Spread", desc: "Buy PE + Sell lower PE" },
  { id: "long_straddle", name: "Long Straddle", desc: "Buy ATM CE + ATM PE" },
  { id: "short_straddle", name: "Short Straddle", desc: "Sell ATM CE + ATM PE" },
];
