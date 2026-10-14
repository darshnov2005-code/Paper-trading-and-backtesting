"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { usePortfolio } from "@/store/PortfolioContext";
import { getSimulatedPrices, POPULAR_SYMBOLS } from "@/lib/market-data";
import { generateOptionChain, type OptionContract, type OptionType } from "@/lib/options";
import { formatCurrency, formatPercent, cn } from "@/lib/utils";
import type { MarketSymbol } from "@/types";

const LOT_SIZES: Record<string, number> = {
  NIFTY: 25, BANKNIFTY: 15, FINNIFTY: 25, MIDCPNIFTY: 50,
  RELIANCE: 250, TCS: 150, HDFCBANK: 550, INFY: 300, ICICIBANK: 700, SBIN: 1500,
};

type Product = "MIS" | "NRML" | "CNC";
type Segment = "EQ" | "FUT" | "OPT";

function TradeContent() {
  const searchParams = useSearchParams();
  const initial = searchParams.get("symbol") || "NIFTY";
  const { portfolio, buy, sell, updatePrices, totalValue } = usePortfolio();

  const [markets, setMarkets] = useState<MarketSymbol[]>([]);
  const [selected, setSelected] = useState(initial);
  const [segment, setSegment] = useState<Segment>("OPT");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [product, setProduct] = useState<Product>("MIS");
  const [optionType, setOptionType] = useState<OptionType>("CE");
  const [selectedOption, setSelectedOption] = useState<OptionContract | null>(null);
  const [qty, setQty] = useState("25");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [livePrice, setLivePrice] = useState<{ price: number; changePercent: number; source: string } | null>(null);

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
      try {
        const res = await fetch(`/api/quote?symbol=${selected}`);
        const data = await res.json();
        if (!cancelled && data.price > 0) setLivePrice(data);
        else {
          const sim = markets.find((m) => m.symbol === selected);
          if (sim && !cancelled) setLivePrice({ price: sim.price, changePercent: sim.changePercent, source: "sim" });
        }
      } catch {
        const sim = markets.find((m) => m.symbol === selected);
        if (sim && !cancelled) setLivePrice({ price: sim.price, changePercent: sim.changePercent, source: "sim" });
      }
    };
    fetchLive();
    const id = setInterval(fetchLive, 12000);
    return () => { cancelled = true; clearInterval(id); };
  }, [selected, markets]);

  const spot = livePrice?.price || markets.find((m) => m.symbol === selected)?.price || 0;
  const optionChain = segment === "OPT" && spot > 0 ? generateOptionChain(selected, spot, optionType) : [];
  const activeContract = selectedOption || optionChain[8] || null;

  const tradeSymbol = segment === "OPT" && activeContract ? activeContract.symbol : selected;
  const tradePrice = segment === "OPT" && activeContract ? activeContract.premium : spot;
  const lotSize = segment === "OPT" && activeContract ? activeContract.lotSize : (LOT_SIZES[selected] || 1);
  const quantity = parseFloat(qty) || 0;
  const estimated = quantity * tradePrice;
  const fees = estimated * 0.0003;
  const position = portfolio.positions[tradeSymbol];

  const symbolInfo = {
    symbol: tradeSymbol,
    name: segment === "OPT" && activeContract
      ? `${activeContract.underlying} ${activeContract.strike} ${activeContract.type}`
      : (POPULAR_SYMBOLS.find((s) => s.symbol === selected)?.name || selected),
    type: "stock" as const,
    price: tradePrice,
    change: 0,
    changePercent: 0,
  };

  const handleSubmit = () => {
    setMessage(null);
    if (quantity <= 0) {
      setMessage({ type: "error", text: "Enter valid quantity" });
      return;
    }
    if (segment === "OPT" && !activeContract) {
      setMessage({ type: "error", text: "Select a strike from the option chain" });
      return;
    }
    const res = side === "buy"
      ? buy(symbolInfo, quantity, tradePrice)
      : sell(tradeSymbol, quantity, tradePrice);
    setMessage({
      type: res.success ? "success" : "error",
      text: res.success
        ? `${side.toUpperCase()} ${quantity} ${tradeSymbol} @ ₹${tradePrice} (${product})`
        : res.message,
    });
  };

  const setLots = (lots: number) => setQty(String(lots * lotSize));

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Trade</h1>
          <p className="text-xs text-[var(--muted)]">Equity · Futures · Options (CE/PE)</p>
        </div>
        <div className="text-right text-sm">
          <div className="text-[var(--muted)]">Available Cash</div>
          <div className="font-semibold">{formatCurrency(portfolio.cash)}</div>
        </div>
      </div>

      <div className="mb-5 flex gap-1 rounded-lg border border-[var(--border)] p-1 w-fit">
        {(["EQ", "FUT", "OPT"] as Segment[]).map((s) => (
          <button key={s} onClick={() => { setSegment(s); setSelectedOption(null); setMessage(null); }} className={cn("rounded-md px-4 py-2 text-sm font-semibold", segment === s ? "bg-[var(--green)] text-[#0b0e11]" : "text-[var(--muted)]")}>
            {s === "EQ" ? "Equity" : s === "FUT" ? "Futures" : "Options"}
          </button>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-12">
        <div className="card lg:col-span-3 max-h-[70vh] overflow-y-auto">
          <h2 className="mb-3 text-sm font-semibold text-[var(--muted)]">UNDERLYING</h2>
          <div className="space-y-1">
            {markets.map((m) => (
              <button key={m.symbol} onClick={() => { setSelected(m.symbol); setSelectedOption(null); }} className={cn("flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm", selected === m.symbol ? "bg-[var(--green)]/15 text-[var(--green)]" : "hover:bg-[var(--card-hover)]")}>
                <div><div className="font-medium">{m.symbol}</div><div className="text-[10px] text-[var(--muted)]">{m.type === "index" ? "INDEX" : "EQ"}</div></div>
                <div className="text-right"><div className="font-medium">{new Intl.NumberFormat("en-IN").format(m.price)}</div><div className={cn("text-[10px]", m.changePercent >= 0 ? "pos" : "neg")}>{formatPercent(m.changePercent)}</div></div>
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-5 space-y-4">
          <div className="card">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-bold">{selected}</h2>
                  {livePrice?.source === "nse" && <span className="rounded bg-[var(--green)]/20 px-1.5 py-0.5 text-[10px] font-bold text-[var(--green)]">NSE LIVE</span>}
                  {livePrice?.source === "yahoo" && <span className="rounded bg-[var(--yellow)]/20 px-1.5 py-0.5 text-[10px] font-bold text-[var(--yellow)]">LIVE</span>}
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold">{formatCurrency(spot)}</div>
                <div className={cn("text-sm", (livePrice?.changePercent ?? 0) >= 0 ? "pos" : "neg")}>{formatPercent(livePrice?.changePercent ?? 0)}</div>
              </div>
            </div>
          </div>

          {segment === "OPT" && (
            <div className="card">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold">Option Chain</h3>
                <div className="flex gap-1 rounded border border-[var(--border)] p-0.5">
                  <button onClick={() => { setOptionType("CE"); setSelectedOption(null); }} className={cn("rounded px-3 py-1 text-xs font-bold", optionType === "CE" ? "bg-[var(--green)] text-[#0b0e11]" : "text-[var(--muted)]")}>CE</button>
                  <button onClick={() => { setOptionType("PE"); setSelectedOption(null); }} className={cn("rounded px-3 py-1 text-xs font-bold", optionType === "PE" ? "bg-[var(--red)] text-white" : "text-[var(--muted)]")}>PE</button>
                </div>
              </div>
              <div className="max-h-56 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead><tr className="text-[var(--muted)] border-b border-[var(--border)]"><th className="py-1.5 text-left">Strike</th><th className="py-1.5 text-right">LTP</th><th className="py-1.5 text-right">Chg%</th></tr></thead>
                  <tbody>
                    {optionChain.map((opt) => (
                      <tr key={opt.symbol} onClick={() => setSelectedOption(opt)} className={cn("cursor-pointer border-b border-[var(--border)]/40 hover:bg-[var(--card-hover)]", activeContract?.strike === opt.strike && "bg-[var(--green)]/10")}>
                        <td className="py-2">{opt.strike}</td>
                        <td className="py-2 text-right">{opt.premium.toFixed(2)}</td>
                        <td className={cn("py-2 text-right", opt.changePercent >= 0 ? "pos" : "neg")}>{formatPercent(opt.changePercent)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {activeContract && (
                <div className="mt-3 rounded bg-[#0b0e11] p-2 text-xs">
                  Selected: <span className="font-bold text-[var(--green)]">{activeContract.symbol}</span> · ₹{activeContract.premium} · Lot {activeContract.lotSize}
                </div>
              )}
            </div>
          )}

          <div className="card">
            <div className="mb-4 grid grid-cols-2 gap-1 rounded-lg border border-[var(--border)] p-1">
              <button onClick={() => setSide("buy")} className={cn("rounded-md py-2.5 text-sm font-bold", side === "buy" ? "bg-[var(--green)] text-[#0b0e11]" : "text-[var(--muted)]")}>BUY</button>
              <button onClick={() => setSide("sell")} className={cn("rounded-md py-2.5 text-sm font-bold", side === "sell" ? "bg-[var(--red)] text-white" : "text-[var(--muted)]")}>SELL</button>
            </div>

            <div className="mb-4 flex gap-2">
              {(["MIS", "NRML", "CNC"] as Product[]).map((p) => (
                <button key={p} onClick={() => setProduct(p)} className={cn("flex-1 rounded-md border py-2 text-xs font-semibold", product === p ? "border-[var(--green)] bg-[var(--green)]/10 text-[var(--green)]" : "border-[var(--border)] text-[var(--muted)]")}>{p}</button>
              ))}
            </div>

            <div className="mb-3">
              <div className="mb-1 flex justify-between text-xs text-[var(--muted)]"><span>Quantity</span><span>Lot: {lotSize}</span></div>
              <input type="number" min="1" className="input text-lg font-semibold" value={qty} onChange={(e) => setQty(e.target.value)} />
              <div className="mt-2 flex gap-1.5">{[1,2,5,10].map(l => <button key={l} onClick={() => setLots(l)} className="rounded border border-[var(--border)] px-2.5 py-1 text-xs">{l} Lot</button>)}</div>
            </div>

            <div className="mb-4 rounded-lg bg-[#0b0e11] p-3 text-sm">
              <div className="flex justify-between"><span className="text-[var(--muted)]">Price</span><span>₹{tradePrice.toFixed(2)}</span></div>
              <div className="mt-1 flex justify-between"><span className="text-[var(--muted)]">Value</span><span>{formatCurrency(estimated)}</span></div>
              <div className="mt-1 flex justify-between font-semibold"><span>Total</span><span>{formatCurrency(side === "buy" ? estimated + fees : estimated - fees)}</span></div>
            </div>

            {message && <div className={cn("mb-3 rounded-lg px-3 py-2 text-sm", message.type === "success" ? "bg-[var(--green)]/15 text-[var(--green)]" : "bg-[var(--red)]/15 text-[var(--red)]")}>{message.text}</div>}

            <button onClick={handleSubmit} className={cn("btn w-full py-3 text-base font-bold", side === "buy" ? "btn-primary" : "btn-danger")}>
              {side === "buy" ? "BUY" : "SELL"} {segment === "OPT" ? (activeContract?.symbol || "OPTION") : selected} · {product}
            </button>
          </div>
        </div>

        <div className="space-y-4 lg:col-span-4">
          <div className="card">
            <h3 className="mb-3 text-sm font-semibold text-[var(--muted)]">ACCOUNT</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-[var(--muted)]">Total Value</span><span>{formatCurrency(totalValue)}</span></div>
              <div className="flex justify-between"><span className="text-[var(--muted)]">Cash</span><span>{formatCurrency(portfolio.cash)}</span></div>
            </div>
          </div>

          {position ? (
            <div className="card">
              <h3 className="mb-3 text-sm font-semibold text-[var(--muted)]">POSITION</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-[var(--muted)]">Symbol</span><span className="text-xs font-medium">{position.symbol}</span></div>
                <div className="flex justify-between"><span className="text-[var(--muted)]">Qty</span><span>{position.quantity}</span></div>
                <div className="flex justify-between"><span className="text-[var(--muted)]">Avg</span><span>{formatCurrency(position.avgCost)}</span></div>
                <div className="flex justify-between border-t border-[var(--border)] pt-2"><span className="text-[var(--muted)]">P&L</span><span className={cn("font-bold", position.unrealizedPnL >= 0 ? "pos" : "neg")}>{formatCurrency(position.unrealizedPnL)}</span></div>
              </div>
              <button onClick={() => { setSide("sell"); setQty(String(position.quantity)); }} className="btn btn-danger mt-4 w-full">Square Off</button>
            </div>
          ) : (
            <div className="card py-8 text-center text-sm text-[var(--muted)]">No open position</div>
          )}

          <div className="card text-xs text-[var(--muted)] space-y-1">
            <div className="font-semibold text-white mb-1">How to trade Options</div>
            <div>1. Click <b>Options</b> tab</div>
            <div>2. Select Nifty / BankNifty / stock</div>
            <div>3. Choose CE or PE</div>
            <div>4. Click a strike in the chain</div>
            <div>5. Set quantity (lots) and Buy/Sell</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TradePage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-[var(--muted)]">Loading…</div>}>
      <TradeContent />
    </Suspense>
  );
}
