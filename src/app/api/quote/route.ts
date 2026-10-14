import { NextRequest, NextResponse } from "next/server";

const INDEX_MAP: Record<string, string> = {
  NIFTY: "NIFTY 50",
  BANKNIFTY: "NIFTY BANK",
  FINNIFTY: "NIFTY FIN SERVICE",
  MIDCPNIFTY: "NIFTY MID SELECT",
};

const YAHOO_MAP: Record<string, string> = {
  NIFTY: "^NSEI",
  BANKNIFTY: "^NSEBANK",
  FINNIFTY: "NIFTY_FIN_SERVICE.NS",
  MIDCPNIFTY: "NIFTY_MID_SELECT.NS",
  RELIANCE: "RELIANCE.NS",
  TCS: "TCS.NS",
  HDFCBANK: "HDFCBANK.NS",
  INFY: "INFY.NS",
  ICICIBANK: "ICICIBANK.NS",
  SBIN: "SBIN.NS",
  BHARTIARTL: "BHARTIARTL.NS",
  ITC: "ITC.NS",
  LT: "LT.NS",
  KOTAKBANK: "KOTAKBANK.NS",
  AXISBANK: "AXISBANK.NS",
  WIPRO: "WIPRO.NS",
  HCLTECH: "HCLTECH.NS",
  BAJFINANCE: "BAJFINANCE.NS",
  ASIANPAINT: "ASIANPAINT.NS",
  MARUTI: "MARUTI.NS",
};

async function fetchFromNSE(symbol: string) {
  const isIndex = !!INDEX_MAP[symbol];
  const url = isIndex
    ? "https://www.nseindia.com/api/allIndices"
    : `https://www.nseindia.com/api/quote-equity?symbol=${encodeURIComponent(symbol)}`;

  const homeRes = await fetch("https://www.nseindia.com", {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
    },
    next: { revalidate: 60 },
  });
  const cookies = (homeRes.headers.getSetCookie?.() || []).map((c) => c.split(";")[0]).join("; ");

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
      Accept: "application/json",
      Referer: "https://www.nseindia.com/",
      Cookie: cookies,
    },
    next: { revalidate: 10 },
  });
  if (!res.ok) throw new Error(`NSE ${res.status}`);
  const data = await res.json();

  if (isIndex) {
    const name = INDEX_MAP[symbol];
    const idx = data?.data?.find((d: any) => d.index === name || d.indexSymbol === symbol);
    if (!idx) throw new Error("Index not found");
    return {
      price: Number(idx.last),
      change: Number(idx.variation),
      changePercent: Number(idx.percentChange),
      previousClose: Number(idx.last) - Number(idx.variation),
      source: "nse",
    };
  }
  const p = data?.priceInfo;
  if (!p) throw new Error("No priceInfo");
  return {
    price: Number(p.lastPrice),
    change: Number(p.change),
    changePercent: Number(p.pChange),
    previousClose: Number(p.previousClose),
    source: "nse",
  };
}

async function fetchFromYahoo(symbol: string) {
  const yahoo = YAHOO_MAP[symbol] || `${symbol}.NS`;
  const res = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahoo)}?interval=1d&range=1d`,
    { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 15 } }
  );
  if (!res.ok) throw new Error("Yahoo failed");
  const data = await res.json();
  const meta = data?.chart?.result?.[0]?.meta;
  if (!meta) throw new Error("No data");
  const price = meta.regularMarketPrice ?? meta.previousClose;
  const prev = meta.chartPreviousClose ?? meta.previousClose;
  const change = price - prev;
  return {
    price: +Number(price).toFixed(2),
    change: +Number(change).toFixed(2),
    changePercent: +((change / prev) * 100).toFixed(2),
    previousClose: prev,
    source: "yahoo",
  };
}

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol")?.toUpperCase();
  if (!symbol) return NextResponse.json({ error: "symbol required" }, { status: 400 });

  try {
    const data = await fetchFromNSE(symbol);
    return NextResponse.json({ symbol, ...data, currency: "INR" });
  } catch {
    try {
      const data = await fetchFromYahoo(symbol);
      return NextResponse.json({ symbol, ...data, currency: "INR" });
    } catch (e) {
      return NextResponse.json({ symbol, price: 0, change: 0, changePercent: 0, source: "error", error: String(e) });
    }
  }
}
