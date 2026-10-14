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

function approxPremium(spot: number, strike: number, type: OptionType, daysToExpiry: number, iv = 0.16): number {
  const t = Math.max(daysToExpiry, 1) / 365;
  const moneyness = type === "CE" ? (spot - strike) / spot : (strike - spot) / spot;
  const intrinsic = Math.max(0, type === "CE" ? spot - strike : strike - spot);
  const timeValue = spot * iv * Math.sqrt(t) * 0.4 * Math.exp(-Math.abs(moneyness) * 3);
  return Math.max(0.05, +(intrinsic + timeValue).toFixed(2));
}

function getNextExpiries() {
  const now = new Date();
  const expiries: { date: string; label: string; days: number }[] = [];
  let d = new Date(now);
  d.setDate(d.getDate() + ((4 - d.getDay() + 7) % 7 || 7));
  for (let i = 0; i < 4; i++) {
    const exp = new Date(d);
    exp.setDate(d.getDate() + i * 7);
    const days = Math.ceil((exp.getTime() - now.getTime()) / 86400000);
    const label = exp.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }).toUpperCase();
    expiries.push({ date: exp.toISOString().slice(0, 10), label, days: Math.max(1, days) });
  }
  return expiries;
}

export function generateOptionChain(underlying: string, spot: number, type: OptionType = "CE"): OptionContract[] {
  const lotSize = LOTS[underlying] || 25;
  const expiry = getNextExpiries()[0];
  const step = underlying.includes("NIFTY") || underlying === "BANKNIFTY" ? 50 : 20;
  const atm = Math.round(spot / step) * step;
  const strikes: number[] = [];
  for (let i = -8; i <= 8; i++) strikes.push(atm + i * step);

  const seedBase = underlying.charCodeAt(0) * 100 + expiry.days;

  return strikes.map((strike, idx) => {
    const premium = approxPremium(spot, strike, type, expiry.days);
    const noise = (seededRandom(seedBase + idx + (type === "CE" ? 0 : 50)) - 0.5) * 0.08;
    const ltp = Math.max(0.05, +(premium * (1 + noise)).toFixed(2));
    const change = +(ltp * (seededRandom(seedBase + idx * 3) - 0.5) * 0.15).toFixed(2);
    const changePercent = ltp > 0 ? +((change / ltp) * 100).toFixed(2) : 0;
    const expLabel = expiry.label.replace(" ", "");
    return {
      symbol: `${underlying}${expLabel}${strike}${type}`,
      underlying,
      strike,
      type,
      expiry: expiry.date,
      expiryLabel: expiry.label,
      lotSize,
      premium: ltp,
      change,
      changePercent,
      oi: Math.floor(100000 + seededRandom(seedBase + idx) * 500000),
    };
  });
}

export function getExpiries() {
  return getNextExpiries();
}
