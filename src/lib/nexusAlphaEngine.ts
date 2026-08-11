export function sigmoid(x: number, mid: number, steepness: number, invert = false): number {
  const k = invert ? -steepness : steepness;
  const val = 1 / (1 + Math.exp(-k * (x - mid)));
  return Math.max(0, Math.min(100, Math.round(val * 100)));
}

export function calculateNexusMatrix(metrics: any, liveChange: number, regime: string, sector: string = 'General', price: number = 0) {
  const sales = metrics.salesGrowth != null ? sigmoid(metrics.salesGrowth, 15, 0.2) : null; 
  const eps = metrics.epsGrowth != null ? sigmoid(metrics.epsGrowth, 15, 0.2) : null;     
  const roe_roce = metrics.roe != null ? sigmoid(metrics.roe, 15, 0.2) : null;
  // cfoPat is now a real CFO/net-income ratio pulled from statement history
  // (see server.ts + src/lib/piotroski.ts) and can be `null` when Yahoo
  // doesn't have the underlying cash-flow data for this ticker — in that
  // case we exclude the factor rather than guessing a value.
  const cfo_pat = metrics.cfoPat != null ? sigmoid(metrics.cfoPat, 1.0, 4.0) : null;

  const isFinancial = sector.includes('Financial') || sector.includes('Bank') || sector.includes('NBFC');

  let peMidpoint = metrics.trailingPeMidpoint != null ? metrics.trailingPeMidpoint : 25;
  if (metrics.trailingPeMidpoint == null) {
    if (sector.includes('Tech') || sector.includes('IT')) peMidpoint = 35;
    if (sector.includes('Utilities') || sector.includes('Energy')) peMidpoint = 15;
    if (isFinancial) peMidpoint = 15; // Financials typically have lower P/Es
  }
  
  const valuation = metrics.peRatio != null ? sigmoid(metrics.peRatio === 0 ? 100 : metrics.peRatio, peMidpoint, 0.15, true) : null; 
  
  // Financials intrinsically run with high leverage, so D/E is not a valid penalty
  const debt_equity = isFinancial || metrics.debtEquity == null ? null : sigmoid(metrics.debtEquity, 1.0, 3.0, true);

  // f_score is now a real Piotroski F-Score computed from multi-year
  // financials (0-9, rescaled if some of the 9 tests were ungradable).
  // `metrics.fScore` is `null` when there isn't enough statement history
  // to compute it at all (e.g. a recent IPO) — again, excluded rather
  // than defaulted, since a fabricated "average" score is worse than
  // honestly having no opinion.
  const f_score = metrics.fScore != null ? sigmoid(metrics.fScore, 5, 0.8) : null;
  
  // Multi-timeframe Momentum Factor
  // Combines 1-day change, 52-week change, and distance from 50 & 200 DMAs
  let momentum = sigmoid(liveChange, 0, 0.5); // Fallback to 1-day momentum
  
  if (price > 0 && metrics.fiftyDayAverage && metrics.twoHundredDayAverage) {
    const dist50 = ((price - metrics.fiftyDayAverage) / metrics.fiftyDayAverage) * 100;
    const dist200 = ((price - metrics.twoHundredDayAverage) / metrics.twoHundredDayAverage) * 100;
    const dist52W = metrics.fiftyTwoWeekChange || 0;
    
    // Blend the timeframes: 40% intermediate (50 DMA), 40% long-term (200 DMA + 52W), 20% short-term (live)
    const blendedMomentum = (dist50 * 0.4) + (((dist200 + dist52W)/2) * 0.4) + (liveChange * 0.2);
    momentum = sigmoid(blendedMomentum, 0, 0.15); // Adjust steepness for blended return
  }
  
  const sentiment = 50; 
  const scores = { sales, roe_roce, cfo_pat, valuation, eps, f_score, debt_equity, momentum, sentiment };

  let weights: Record<string, number> = {
    sales: 0.15, roe_roce: 0.15, cfo_pat: 0.10, 
    valuation: 0.15, eps: 0.10, f_score: 0.10, 
    debt_equity: 0.10, momentum: 0.15, sentiment: 0.00
  };

  if (regime === 'Bull' || regime === 'Breakout') {
    weights = { ...weights, momentum: 0.25, sales: 0.20, valuation: 0.05, debt_equity: 0.05 };
  } else if (regime === 'Bear') {
    weights = { ...weights, valuation: 0.25, cfo_pat: 0.20, roe_roce: 0.20, momentum: 0.0, sales: 0.05, sentiment: 0.00 };
  }

  // Only factors with real data contribute to the composite, and their
  // weights are renormalized so a stock with a couple of missing inputs
  // isn't automatically dragged down (or flattered) relative to a stock
  // with a fully populated data set — a missing factor should make the
  // score less certain, not lower.
  let weightedSum = 0;
  let weightTotal = 0;
  let factorsAvailable = 0;
  const totalFactors = Object.keys(scores).length;

  for (const [key, val] of Object.entries(scores)) {
    if (val === null) continue;
    factorsAvailable++;
    const w = weights[key] || 0;
    weightedSum += val * w;
    weightTotal += w;
  }

  const nexusScore = weightTotal > 0 ? Number((weightedSum / weightTotal).toFixed(2)) : 0;

  return {
    scores,
    nexusScore,
    // Lets the UI show "score based on N/9 factors" instead of implying
    // every score is equally well-supported by data.
    dataCompleteness: { available: factorsAvailable, total: totalFactors },
  };
}
