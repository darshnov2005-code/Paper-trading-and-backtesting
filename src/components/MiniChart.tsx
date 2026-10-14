"use client";

import { useMemo } from "react";

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export function MiniChart({
  candles,
  width = 600,
  height = 220,
  upColor = "#0ecb81",
  downColor = "#f6465d",
}: {
  candles: Candle[];
  width?: number;
  height?: number;
  upColor?: string;
  downColor?: string;
}) {
  const { min, max } = useMemo(() => {
    if (!candles.length) return { min: 0, max: 0 };
    const lows = candles.map((c) => c.low);
    const highs = candles.map((c) => c.high);
    return { min: Math.min(...lows) * 0.998, max: Math.max(...highs) * 1.002 };
  }, [candles]);

  if (candles.length < 2) {
    return <div className="flex items-center justify-center text-sm text-[var(--muted)]" style={{ height }}>Not enough data</div>;
  }

  const pad = { top: 12, right: 12, bottom: 20, left: 50 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const range = max - min || 1;
  const x = (i: number) => pad.left + (i / (candles.length - 1)) * plotW;
  const y = (v: number) => pad.top + (1 - (v - min) / range) * plotH;
  const candleW = Math.max(2, (plotW / candles.length) * 0.6);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" style={{ maxHeight: height }}>
      {[0.25, 0.5, 0.75].map((t) => (
        <line key={t} x1={pad.left} x2={width - pad.right} y1={pad.top + t * plotH} y2={pad.top + t * plotH} stroke="#2b3139" strokeWidth="1" />
      ))}
      {candles.map((c, i) => {
        const cx = x(i);
        const isUp = c.close >= c.open;
        const color = isUp ? upColor : downColor;
        const bodyTop = y(Math.max(c.open, c.close));
        const bodyBot = y(Math.min(c.open, c.close));
        const bodyH = Math.max(1, bodyBot - bodyTop);
        return (
          <g key={i}>
            <line x1={cx} x2={cx} y1={y(c.high)} y2={y(c.low)} stroke={color} strokeWidth="1" />
            <rect x={cx - candleW / 2} y={bodyTop} width={candleW} height={bodyH} fill={color} />
          </g>
        );
      })}
      <text x={4} y={pad.top + 4} fill="#848e9c" fontSize="10">{max.toFixed(0)}</text>
      <text x={4} y={height - pad.bottom} fill="#848e9c" fontSize="10">{min.toFixed(0)}</text>
    </svg>
  );
}
