export function calculateCharges(params: {
  turnover: number;
  side: "buy" | "sell";
  product: "MIS" | "NRML" | "CNC";
  isOption: boolean;
}) {
  const { turnover, side, product, isOption } = params;
  let brokerage = 0;
  if (isOption || product === "MIS" || product === "NRML") {
    brokerage = Math.min(20, turnover * 0.0003);
  }
  let stt = 0;
  if (isOption) {
    if (side === "sell") stt = turnover * 0.001;
  } else if (product === "CNC") {
    if (side === "sell") stt = turnover * 0.001;
  } else {
    if (side === "sell") stt = turnover * 0.00025;
  }
  const exchange = turnover * (isOption ? 0.00053 : 0.000325);
  const gst = (brokerage + exchange) * 0.18;
  const sebi = turnover * 0.000001;
  const stamp = side === "buy" ? turnover * (isOption ? 0.00003 : 0.00015) : 0;
  const total = brokerage + stt + exchange + gst + sebi + stamp;
  return {
    brokerage: +brokerage.toFixed(2),
    stt: +stt.toFixed(2),
    exchange: +exchange.toFixed(2),
    gst: +gst.toFixed(2),
    sebi: +sebi.toFixed(2),
    stamp: +stamp.toFixed(2),
    total: +total.toFixed(2),
  };
}
