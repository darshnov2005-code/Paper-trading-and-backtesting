export interface Position {
  symbol: string;
  name: string;
  quantity: number;
  avgCost: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
}

export interface Trade {
  id: string;
  symbol: string;
  name: string;
  side: "buy" | "sell";
  quantity: number;
  price: number;
  total: number;
  timestamp: number;
  fees: number;
}

export interface Portfolio {
  cash: number;
  initialCash: number;
  positions: Record<string, Position>;
  trades: Trade[];
  createdAt: number;
}

export interface MarketSymbol {
  symbol: string;
  name: string;
  type: "stock" | "crypto" | "etf";
  price: number;
  change: number;
  changePercent: number;
  volume?: number;
  marketCap?: number;
}

export interface Candle {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface BacktestConfig {
  symbol: string;
  strategy: "sma_crossover" | "buy_hold" | "rsi" | "macd";
  startDate: string;
  endDate: string;
  initialCapital: number;
  shortPeriod?: number;
  longPeriod?: number;
  rsiPeriod?: number;
  overbought?: number;
  oversold?: number;
  feesPercent?: number;
}

export interface BacktestResult {
  equityCurve: { time: number; equity: number; benchmark: number }[];
  trades: { time: number; side: "buy" | "sell"; price: number; quantity: number }[];
  metrics: {
    totalReturn: number;
    totalReturnPercent: number;
    annualizedReturn: number;
    maxDrawdown: number;
    sharpeRatio: number;
    winRate: number;
    totalTrades: number;
    profitFactor: number;
    finalEquity: number;
  };
  config: BacktestConfig;
}
