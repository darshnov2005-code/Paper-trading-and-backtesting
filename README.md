# PaperTrade — Paper Trading & Backtesting

A modern, fully client-side paper trading and strategy backtesting platform.

**Live:** Deploy this repo to Vercel (no env vars needed).

## Features

- **Paper Trading**: $100k virtual capital, buy/sell stocks & crypto, 0.1% fees, portfolio + trade history, localStorage persistence
- **Backtesting**: SMA Crossover, RSI, Buy & Hold — equity curve, Sharpe, max drawdown, win rate, profit factor
- **Markets**: Browse popular symbols with simulated live prices

## Tech

- Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS 4
- 100% client-side (perfect for Vercel serverless)
- No database, no API keys required

## Run locally

```bash
npm install
npm run dev
```

## Deploy on Vercel

1. Import this GitHub repo in [vercel.com](https://vercel.com)
2. Deploy — zero configuration needed

## Disclaimer

Educational tool only. All data is simulated. Not financial advice.
