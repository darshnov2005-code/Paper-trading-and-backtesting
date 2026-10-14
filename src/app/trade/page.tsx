"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { usePortfolio } from "@/store/PortfolioContext";
import { getSimulatedPrices, POPULAR_SYMBOLS } from "@/lib/market-data";
import { formatCurrency, formatPercent, cn } from "@/lib/utils";
import type { MarketSymbol } from "@/types";

const LOT_SIZES: Record<string, number> = {
  NIFTY: 25, BANKNIFTY: 15, FINNIFTY: 25, MIDCPNIFTY: 50,
  RELIANCE: 250, TCS: 150, HDFCBANK: 550, INFY: 300, ICICIBANK: 700,
  SBIN: 1500, BHARTIARTL: 475, ITC: 1600, LT: 150, KOTAKBANK: 400,
  AXISBANK: 625, WIPRO: 1500, HCLTECH: 350, BAJFINANCE: 125,
  ASIANPAINT: 200, MARUTI: 50,
};

type Product = "MIS" | "NRML" | "CNC";

function TradeContent() {
  const searchParams = useSearchParams();
  const initial = searchParams.get("symbol") || "NIFTY";
  const { portfolio, buy, sell, updatePrices, totalValue } = usePortfolio();

  const [markets, setMarkets] = useState<MarketSymbol[]>([]);
  const [selected, setSelected] = useState(initial);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [product, setProduct] = useState<Product>("MIS");
  const [qty, setQty] = useState("25");
  const [orderType, setOrderType] = useState<"MARKET" | "LIMIT">("MARKET");
  const [limitPrice, setLimitPrice] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [livePrice, setLivePrice] = useState<{ price: number; change: number; changePercent: number; source: string } | null>(null);
  const [loadingLive, setLoadingLive] = useState(false);

  useEffect(() => {
    const load = () => {
      const prices = getSimulatedPrices();
      setMarkets(prices);
      const map: Record<string, number> = {};
      prices.forEach((p) => (map[p.symbol] = p.price));
      updatePrices(map);
    };
    load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, [updatePrices]);

  useEffect(() => {
    let cancelled = false;
    const fetchLive = async () => {
      setLoadingLive(true);
      try {
        const res = await fetch(`/api/quote?symbol=${selected}`);
        const data = await res.json();
        if (!cancelled && data.price > 0) {
          setLivePrice(data);
        } else if (!cancelled) {
          const sim = markets.find((m) => m.symbol === selected);
          if (sim) setLivePrice({ price: sim.price, change: sim.change, changePercent: sim.changePercent, source: "sim" });
        }
      } catch {
        const sim = markets.find((m) => m.symbol === selected);
        if (sim && !cancelled) setLivePrice({ price: sim.price, change: sim.change, changePercent: sim.changePercent, source: "sim" });
      } finally {
        if (!cancelled) setLoadingLive(false);
      }
    };
    fetchLive();
    const id = setInterval(fetchLive, 12000);
    return () => { cancelled = true; clearInterval(id); };
  }, [selected, markets]);

  const symbolInfo = markets.find((m) => m.symbol === selected) || {
    symbol: selected,
    name: POPULAR_SYMBOLS.find((s) => s.symbol === selected)?.name || selected,
    type: "stock" as const,
    price: livePrice?.price || 0,
    change: 0,
    changePercent: 0,
  };

  const price = livePrice?.price || symbolInfo.price;
  const changePct = livePrice?.changePercent ?? symbolInfo.changePercent;
  const position = portfolio.positions[selected];
  const lotSize = LOT_SIZES[selected] || 1;
  const quantity = parseFloat(qty) || 0;
  const estimated = quantity * price;
  const fees = estimated * 0.0003;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (quantity <= 0) {
      setMessage({ type: "error", text: "Enter valid quantity" });
      return;
    }
    const res = side === "buy"
      ? buy({ ...symbolInfo, price }, quantity, price)
      : sell(selected, quantity, price);
    setMessage({ type: res.success ? "success" : "error", text: res.message + (res.success ? ` (${product})` : "") });
    if (res.success) setQty(String(lotSize));
  };

  const setLots = (lots: number) => setQty(String(lots * lotSize));

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Trade</h1>
          <p className="text-xs text-[var(--muted)]">Intraday · Futures · Options · Delivery</p>
        </div>
        <div className="text-right text-sm">
          <div className="text-[var(--muted)]">Available Cash</div>
          <div className="font-semibold">{formatCurrency(portfolio.cash)}</div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-12">
        <div className="card lg:col-span-3 max-h-[70vh] overflow-y-auto">
          <h2 className="mb-3 text-sm font-semibold text-[var(--muted)]">WATCHLIST</h2>
          <div className="space-y-1">
            {markets.map((m) => (
              <button
                key={m.symbol}
                onClick={() => { setSelected(m.symbol); setMessage(null); setQty(String(LOT_SIZES[m.symbol] || 1)); }}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition",
                  selected === m.symbol ? "bg-[var(--green)]/15 text-[var(--green)]" : "hover:bg-[var(--card-hover)]"
                )}
              >
                <div>
                  <div className="font-medium">{m.symbol}</div>
                  <div className="text-[10px] text-[var(--muted)]">{m.type === "index" ? "INDEX" : "EQ"}</div>
                </div>
                <div className="text-right">
                  <div className="font-medium">{new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(m.price)}</div>
                  <div className={cn("text-[10px]", m.changePercent >= 0 ? "pos" : "neg")}>{formatPercent(m.changePercent)}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="card lg:col-span-5">
          <div className="mb-5 flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold">{selected}</h2>
                {livePrice?.source === "nse" && <span className="rounded bg-[var(--green)]/20 px-1.5 py-0.5 text-[10px] font-bold text-[var(--green)]">NSE LIVE</span>}
                {livePrice?.source === "yahoo" && <span className="rounded bg-[var(--yellow)]/20 px-1.5 py-0.5 text-[10px] font-bold text-[var(--yellow)]">LIVE</span>}
                {loadingLive && <span className="text-xs text-[var(--muted)]">updating…</span>}
              </div>
              <p className="text-sm text-[var(--muted)]">{symbolInfo.name}</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold">{formatCurrency(price)}</div>
              <div className={cn("text-sm font-medium", changePct >= 0 ? "pos" : "neg")}>{formatPercent(changePct)}</div>
            </div>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-1 rounded-lg border border-[var(--border)] p-1">
            <button type="button" onClick={() => setSide("buy")} className={cn("rounded-md py-2.5 text-sm font-bold transition", side === "buy" ? "bg-[var(--green)] text-[#0b0e11]" : "text-[var(--muted)] hover:text-white")}>BUY</button>
            <button type="button" onClick={() => setSide("sell")} className={cn("rounded-md py-2.5 text-sm font-bold transition", side === "sell" ? "bg-[var(--red)] text-white" : "text-[var(--muted)] hover:text-white")}>SELL</button>
          </div>

          <div className="mb-4">
            <label className="mb-1.5 block text-xs font-medium text-[var(--muted)]">PRODUCT</label>
            <div className="flex gap-2">
              {(["MIS", "NRML", "CNC"] as Product[]).map((p) => (
                <button key={p} type="button" onClick={() => setProduct(p)} className={cn("flex-1 rounded-md border py-2 text-xs font-semibold transition", product === p ? "border-[var(--green)] bg-[var(--green)]/10 text-[var(--green)]" : "border-[var(--border)] text-[var(--muted)] hover:border-[#3a4149]")}>
                  {p}<div className="mt-0.5 text-[9px] font-normal opacity-70">{p === "MIS" ? "Intraday" : p === "NRML" ? "F&O Carry" : "Delivery"}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="mb-4 flex gap-4 text-sm">
            <label className="flex items-center gap-2 cursor-pointer"><input type="radio" checked={orderType === "MARKET"} onChange={() => setOrderType("MARKET")} className="accent-[var(--green)]" /> Market</label>
            <label className="flex items-center gap-2 cursor-pointer"><input type="radio" checked={orderType === "LIMIT"} onChange={() => setOrderType("LIMIT")} className="accent-[var(--green)]" /> Limit</label>
          </div>

          {orderType === "LIMIT" && (
            <div className="mb-4">
              <label className="mb-1 block text-xs text-[var(--muted)]">Limit Price</label>
              <input type="number" className="input" value={limitPrice} onChange={(e) => setLimitPrice(e.target.value)} placeholder={String(price)} />
            </div>
          )}

          <div className="mb-3">
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs text-[var(--muted)]">Quantity</label>
              <span className="text-[10px] text-[var(--muted)]">Lot: {lotSize}</span>
            </div>
            <input type="number" min="1" className="input text-lg font-semibold" value={qty} onChange={(e) => setQty(e.target.value)} />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[1, 2, 5, 10].map((lots) => (
                <button key={lots} type="button" onClick={() => setLots(lots)} className="rounded border border-[var(--border)] px-2.5 py-1 text-xs hover:border-[var(--green)]">{lots} Lot</button>
              ))}
            </div>
          </div>

          <div className="mb-4 rounded-lg bg-[#0b0e11] p-3 text-sm">
            <div className="flex justify-between"><span className="text-[var(--muted)]">Est. Value</span><span>{formatCurrency(estimated)}</span></div>
            <div className="mt-1 flex justify-between"><span className="text-[var(--muted)]">Charges (approx)</span><span>{formatCurrency(fees)}</span></div>
            <div className="mt-1 flex justify-between font-semibold"><span>Total</span><span>{formatCurrency(side === "buy" ? estimated + fees : estimated - fees)}</span></div>
          </div>

          {message && (
            <div className={cn("mb-3 rounded-lg px-3 py-2 text-sm", message.type === "success" ? "bg-[var(--green)]/15 text-[var(--green)]" : "bg-[var(--red)]/15 text-[var(--red)]")}>{message.text}</div>
          )}

          <button onClick={handleSubmit} className={cn("btn w-full py-3 text-base font-bold", side === "buy" ? "btn-primary" : "btn-danger")}>
            {side === "buy" ? "BUY" : "SELL"} {selected} · {product}
          </button>
        </div>

        <div className="space-y-4 lg:col-span-4">
          <div className="card">
            <h3 className="mb-3 text-sm font-semibold text-[var(--muted)]">ACCOUNT</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-[var(--muted)]">Total Value</span><span className="font-medium">{formatCurrency(totalValue)}</span></div>
              <div className="flex justify-between"><span className="text-[var(--muted)]">Cash</span><span className="font-medium">{formatCurrency(portfolio.cash)}</span></div>
            </div>
          </div>

          {position ? (
            <div className="card">
              <h3 className="mb-3 text-sm font-semibold text-[var(--muted)]">YOUR POSITION</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-[var(--muted)]">Qty</span><span className="font-medium">{position.quantity}</span></div>
                <div className="flex justify-between"><span className="text-[var(--muted)]">Avg Cost</span><span>{formatCurrency(position.avgCost)}</span></div>
                <div className="flex justify-between"><span className="text-[var(--muted)]">LTP</span><span>{formatCurrency(position.currentPrice)}</span></div>
                <div className="flex justify-between"><span className="text-[var(--muted)]">Value</span><span>{formatCurrency(position.marketValue)}</span></div>
                <div className="flex justify-between border-t border-[var(--border)] pt-2">
                  <span className="text-[var(--muted)]">Unrealized P&L</span>
                  <span className={cn("font-bold", position.unrealizedPnL >= 0 ? "pos" : "neg")}>{formatCurrency(position.unrealizedPnL)} ({formatPercent(position.unrealizedPnLPercent)})</span>
                </div>
              </div>
              <button onClick={() => { setSide("sell"); setQty(String(position.quantity)); }} className="btn btn-danger mt-4 w-full">Square Off</button>
            </div>
          ) : (
            <div className="card text-center text-sm text-[var(--muted)] py-8">No position in {selected}</div>
          )}

          <div className="card">
            <h3 className="mb-2 text-sm font-semibold text-[var(--muted)]">PRODUCT GUIDE</h3>
            <ul className="space-y-1.5 text-xs text-[var(--muted)]">
              <li><span className="text-[var(--green)] font-semibold">MIS</span> — Intraday. Auto square-off by 3:20 PM</li>
              <li><span className="text-[var(--yellow)] font-semibold">NRML</span> — F&O overnight / carry forward</li>
              <li><span className="text-white font-semibold">CNC</span> — Equity delivery</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TradePage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-[var(--muted)]">Loading trade terminal…</div>}>
      <TradeContent />
    </Suspense>
  );
}
