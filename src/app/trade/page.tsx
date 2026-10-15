"use client";

import { useEffect, useState, Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { usePortfolio } from "@/store/PortfolioContext";
import { getSimulatedPrices, POPULAR_SYMBOLS, generateIntradayCandles } from "@/lib/market-data";
import { generateOptionChain, getExpiries, type OptionContract } from "@/lib/options";
import { MiniChart } from "@/components/MiniChart";
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
  const [search, setSearch] = useState("");
  const [segment, setSegment] = useState<Segment>("OPT");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [product, setProduct] = useState<Product>("MIS");
  const [selectedOption, setSelectedOption] = useState<OptionContract | null>(null);
  const [qty, setQty] = useState("25");
  const [sl, setSl] = useState("");
  const [tgt, setTgt] = useState("");
  const [expiryIdx, setExpiryIdx] = useState(0);
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
  const expiries = useMemo(() => getExpiries(selected), [selected]);
  const ceChain = useMemo(
    () => (segment === "OPT" && spot > 0 ? generateOptionChain(selected, spot, "CE", expiryIdx) : []),
    [segment, spot, selected, expiryIdx]
  );
  const peChain = useMemo(
    () => (segment === "OPT" && spot > 0 ? generateOptionChain(selected, spot, "PE", expiryIdx) : []),
    [segment, spot, selected, expiryIdx]
  );

  const strikes = useMemo(() => {
    const map = new Map<number, { ce?: OptionContract; pe?: OptionContract }>();
    ceChain.forEach((c) => map.set(c.strike, { ...map.get(c.strike), ce: c }));
    peChain.forEach((c) => map.set(c.strike, { ...map.get(c.strike), pe: c }));
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [ceChain, peChain]);

  const activeContract = selectedOption;
  const tradeSymbol = segment === "OPT" && activeContract ? activeContract.symbol : selected;
  const tradePrice = segment === "OPT" && activeContract ? activeContract.premium : spot;
  const lotSize = segment === "OPT" && activeContract ? activeContract.lotSize : LOT_SIZES[selected] || 1;
  const quantity = parseFloat(qty) || 0;
  const estimated = quantity * tradePrice;
  const fees = Math.min(20, estimated * 0.0003);
  const position = portfolio.positions[tradeSymbol];
  const candles = useMemo(() => generateIntradayCandles(selected, spot || 1000, 48), [selected, spot]);

  const filteredMarkets = markets.filter(
    (m) =>
      !search ||
      m.symbol.toLowerCase().includes(search.toLowerCase()) ||
      m.name.toLowerCase().includes(search.toLowerCase())
  );

  const symbolInfo = {
    symbol: tradeSymbol,
    name:
      segment === "OPT" && activeContract
        ? `${activeContract.underlying} ${activeContract.strike} ${activeContract.type}`
        : POPULAR_SYMBOLS.find((s) => s.symbol === selected)?.name || selected,
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
      setMessage({ type: "error", text: "Select a strike from the chain" });
      return;
    }
    const stopLoss = sl ? parseFloat(sl) : undefined;
    const target = tgt ? parseFloat(tgt) : undefined;
    const res =
      side === "buy"
        ? buy(symbolInfo, quantity, tradePrice, { product, stopLoss, target })
        : sell(tradeSymbol, quantity, tradePrice);
    setMessage({
      type: res.success ? "success" : "error",
      text: res.success
        ? `${side.toUpperCase()} ${quantity} ${tradeSymbol} @ ₹${tradePrice.toFixed(2)}`
        : res.message,
    });
  };

  const setLots = (lots: number) => setQty(String(lots * lotSize));

  return (
    <div className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold sm:text-xl">Trade</h1>
          <p className="text-[10px] text-[var(--muted)] sm:text-xs">Equity · Futures · Options</p>
        </div>
        <div className="text-right text-xs sm:text-sm">
          <div className="text-[var(--muted)]">Cash</div>
          <div className="font-semibold">{formatCurrency(portfolio.cash)}</div>
        </div>
      </div>

      <div className="mb-4 flex gap-1 rounded-lg border border-[var(--border)] p-1 w-fit">
        {(["EQ", "FUT", "OPT"] as Segment[]).map((s) => (
          <button
            key={s}
            onClick={() => {
              setSegment(s);
              setSelectedOption(null);
              setMessage(null);
            }}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-semibold sm:px-4 sm:text-sm",
              segment === s ? "bg-[var(--green)] text-[#0b0e11]" : "text-[var(--muted)]"
            )}
          >
            {s === "EQ" ? "Equity" : s === "FUT" ? "Futures" : "Options"}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        {/* Searchable watchlist */}
        <div className="card lg:col-span-2 max-h-[50vh] overflow-hidden flex flex-col lg:max-h-[80vh]">
          <input
            className="input mb-2 text-xs"
            placeholder="Search symbol…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="overflow-y-auto flex-1 space-y-0.5">
            {filteredMarkets.map((m) => (
              <button
                key={m.symbol}
                onClick={() => {
                  setSelected(m.symbol);
                  setSelectedOption(null);
                  setExpiryIdx(0);
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-xs",
                  selected === m.symbol ? "bg-[var(--green)]/15 text-[var(--green)]" : "hover:bg-[var(--card-hover)]"
                )}
              >
                <span className="font-medium">{m.symbol}</span>
                <span className={cn("text-[10px]", m.changePercent >= 0 ? "pos" : "neg")}>
                  {formatPercent(m.changePercent)}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Center: chart + chain */}
        <div className="lg:col-span-7 space-y-3">
          <div className="card">
            <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold sm:text-2xl">{selected}</h2>
                {livePrice?.source === "nse" && (
                  <span className="rounded bg-[var(--green)]/20 px-1.5 py-0.5 text-[10px] font-bold text-[var(--green)]">NSE</span>
                )}
                {livePrice?.source === "yahoo" && (
                  <span className="rounded bg-[var(--yellow)]/20 px-1.5 py-0.5 text-[10px] font-bold text-[var(--yellow)]">LIVE</span>
                )}
              </div>
              <div className="text-right">
                <div className="text-xl font-bold sm:text-2xl">{formatCurrency(spot)}</div>
                <div className={cn("text-sm", (livePrice?.changePercent ?? 0) >= 0 ? "pos" : "neg")}>
                  {formatPercent(livePrice?.changePercent ?? 0)}
                </div>
              </div>
            </div>
            <MiniChart candles={candles} height={180} />
          </div>

          {segment === "OPT" && (
            <div className="card overflow-x-auto">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">Option Chain</h3>
                <div className="flex flex-wrap gap-1">
                  {expiries.map((e, i) => (
                    <button
                      key={e.date}
                      onClick={() => {
                        setExpiryIdx(i);
                        setSelectedOption(null);
                      }}
                      className={cn(
                        "rounded px-2 py-1 text-[10px] font-medium",
                        expiryIdx === i
                          ? "bg-[var(--green)] text-[#0b0e11]"
                          : "border border-[var(--border)] text-[var(--muted)]"
                      )}
                      title={e.kind}
                    >
                      {e.label}
                      <span className="ml-1 opacity-60">{e.kind === "weekly" ? "W" : "M"}</span>
                    </button>
                  ))}
                </div>
              </div>

              <table className="w-full min-w-[700px] text-[11px]">
                <thead>
                  <tr className="border-b border-[var(--border)] text-[var(--muted)]">
                    <th className="py-1.5 text-right pr-1">OI</th>
                    <th className="py-1.5 text-right">Δ</th>
                    <th className="py-1.5 text-right">LTP</th>
                    <th className="py-1.5 text-center font-bold text-white px-2">STRIKE</th>
                    <th className="py-1.5 text-left">LTP</th>
                    <th className="py-1.5 text-left">Δ</th>
                    <th className="py-1.5 text-left pl-1">OI</th>
                  </tr>
                  <tr className="text-[10px] text-[var(--muted)]">
                    <th colSpan={3} className="text-right pr-2 pb-1 text-[var(--green)]">CALLS (CE)</th>
                    <th />
                    <th colSpan={3} className="text-left pl-2 pb-1 text-[var(--red)]">PUTS (PE)</th>
                  </tr>
                </thead>
                <tbody>
                  {strikes.map(([strike, { ce, pe }]) => {
                    const isAtm =
                      Math.abs(strike - spot) <
                      (selected === "BANKNIFTY" ? 80 : selected.includes("NIFTY") ? 40 : 15);
                    const ceSel = activeContract?.type === "CE" && activeContract?.strike === strike;
                    const peSel = activeContract?.type === "PE" && activeContract?.strike === strike;
                    return (
                      <tr key={strike} className={cn("border-b border-[var(--border)]/30", isAtm && "bg-[var(--yellow)]/5")}>
                        <td
                          className={cn("py-1.5 text-right pr-1 cursor-pointer", ceSel && "bg-[var(--green)]/15")}
                          onClick={() => ce && setSelectedOption(ce)}
                        >
                          {ce ? `${(ce.oi! / 1000).toFixed(0)}K` : "—"}
                        </td>
                        <td
                          className={cn("py-1.5 text-right cursor-pointer", ceSel && "bg-[var(--green)]/15")}
                          onClick={() => ce && setSelectedOption(ce)}
                        >
                          {ce?.delta?.toFixed(2) ?? "—"}
                        </td>
                        <td
                          className={cn("py-1.5 text-right font-medium cursor-pointer pos", ceSel && "bg-[var(--green)]/15")}
                          onClick={() => ce && setSelectedOption(ce)}
                        >
                          {ce?.premium.toFixed(1) ?? "—"}
                        </td>
                        <td className={cn("py-1.5 text-center font-bold px-2", isAtm && "text-[var(--yellow)]")}>
                          {strike}
                        </td>
                        <td
                          className={cn("py-1.5 text-left font-medium cursor-pointer neg", peSel && "bg-[var(--red)]/15")}
                          onClick={() => pe && setSelectedOption(pe)}
                        >
                          {pe?.premium.toFixed(1) ?? "—"}
                        </td>
                        <td
                          className={cn("py-1.5 text-left cursor-pointer", peSel && "bg-[var(--red)]/15")}
                          onClick={() => pe && setSelectedOption(pe)}
                        >
                          {pe?.delta?.toFixed(2) ?? "—"}
                        </td>
                        <td
                          className={cn("py-1.5 text-left pl-1 cursor-pointer", peSel && "bg-[var(--red)]/15")}
                          onClick={() => pe && setSelectedOption(pe)}
                        >
                          {pe ? `${(pe.oi! / 1000).toFixed(0)}K` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {activeContract && (
                <div className="mt-2 flex flex-wrap gap-3 rounded bg-[#0b0e11] p-2 text-[11px]">
                  <span className="font-bold text-[var(--green)]">{activeContract.symbol}</span>
                  <span>₹{activeContract.premium}</span>
                  <span>Δ {activeContract.delta}</span>
                  <span>Θ {activeContract.theta}</span>
                  <span>IV {activeContract.iv}%</span>
                  <span>Lot {activeContract.lotSize}</span>
                  <span className="text-[var(--muted)]">{activeContract.expiryLabel}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Order ticket */}
        <div className="space-y-3 lg:col-span-3">
          <div className="card">
            <div className="mb-3 grid grid-cols-2 gap-1 rounded-lg border border-[var(--border)] p-1">
              <button
                onClick={() => setSide("buy")}
                className={cn("rounded-md py-2 text-sm font-bold", side === "buy" ? "bg-[var(--green)] text-[#0b0e11]" : "text-[var(--muted)]")}
              >
                BUY
              </button>
              <button
                onClick={() => setSide("sell")}
                className={cn("rounded-md py-2 text-sm font-bold", side === "sell" ? "bg-[var(--red)] text-white" : "text-[var(--muted)]")}
              >
                SELL
              </button>
            </div>

            <div className="mb-3 flex gap-1">
              {(["MIS", "NRML", "CNC"] as Product[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setProduct(p)}
                  className={cn(
                    "flex-1 rounded border py-1.5 text-[10px] font-semibold",
                    product === p
                      ? "border-[var(--green)] bg-[var(--green)]/10 text-[var(--green)]"
                      : "border-[var(--border)] text-[var(--muted)]"
                  )}
                >
                  {p}
                </button>
              ))}
            </div>

            <div className="mb-2">
              <div className="mb-1 flex justify-between text-[10px] text-[var(--muted)]">
                <span>Qty</span>
                <span>Lot {lotSize}</span>
              </div>
              <input
                type="number"
                min="1"
                className="input text-base font-semibold"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />
              <div className="mt-1.5 flex gap-1">
                {[1, 2, 5, 10].map((l) => (
                  <button
                    key={l}
                    onClick={() => setLots(l)}
                    className="rounded border border-[var(--border)] px-2 py-0.5 text-[10px]"
                  >
                    {l}L
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-3 grid grid-cols-2 gap-2">
              <div>
                <label className="mb-0.5 block text-[10px] text-[var(--muted)]">Stop Loss</label>
                <input type="number" className="input text-sm" placeholder="Optional" value={sl} onChange={(e) => setSl(e.target.value)} />
              </div>
              <div>
                <label className="mb-0.5 block text-[10px] text-[var(--muted)]">Target</label>
                <input type="number" className="input text-sm" placeholder="Optional" value={tgt} onChange={(e) => setTgt(e.target.value)} />
              </div>
            </div>

            <div className="mb-3 rounded-lg bg-[#0b0e11] p-2.5 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">Price</span>
                <span>₹{tradePrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">Value</span>
                <span>{formatCurrency(estimated)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">Charges</span>
                <span>₹{fees.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-semibold border-t border-[var(--border)] pt-1">
                <span>Total</span>
                <span>{formatCurrency(side === "buy" ? estimated + fees : estimated - fees)}</span>
              </div>
            </div>

            {message && (
              <div
                className={cn(
                  "mb-2 rounded px-2 py-1.5 text-xs",
                  message.type === "success" ? "bg-[var(--green)]/15 text-[var(--green)]" : "bg-[var(--red)]/15 text-[var(--red)]"
                )}
              >
                {message.text}
              </div>
            )}

            <button
              onClick={handleSubmit}
              className={cn("btn w-full py-2.5 text-sm font-bold", side === "buy" ? "btn-primary" : "btn-danger")}
            >
              {side === "buy" ? "BUY" : "SELL"}{" "}
              {segment === "OPT" ? activeContract?.symbol?.slice(-10) || "OPT" : selected}
            </button>
          </div>

          {position && (
            <div className="card text-xs space-y-1.5">
              <h3 className="font-semibold text-[var(--muted)]">POSITION</h3>
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">Qty</span>
                <span>{position.quantity}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">Avg</span>
                <span>{formatCurrency(position.avgCost)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">P&L</span>
                <span className={cn("font-bold", position.unrealizedPnL >= 0 ? "pos" : "neg")}>
                  {formatCurrency(position.unrealizedPnL)}
                </span>
              </div>
              <button
                onClick={() => {
                  setSide("sell");
                  setQty(String(position.quantity));
                }}
                className="btn btn-danger mt-2 w-full text-xs"
              >
                Square Off
              </button>
            </div>
          )}

          <div className="card text-[10px] text-[var(--muted)]">
            <div className="font-semibold text-white mb-1">How to use</div>
            <div>1. Search & select underlying</div>
            <div>2. Pick expiry (W = weekly, M = monthly)</div>
            <div>3. Click CE LTP (left) or PE LTP (right)</div>
            <div>4. Set qty, SL, Target → Buy/Sell</div>
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
