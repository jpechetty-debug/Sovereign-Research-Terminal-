export function sigmoid(x: number, mid: number, steepness: number, invert = false): number {
  const k = invert ? -steepness : steepness;
  const val = 1 / (1 + Math.exp(-k * (x - mid)));
  return Math.max(0, Math.min(100, Math.round(val * 100)));
}

export type CrossSectionalFactorScores = {
  sales: number | null;
  eps: number | null;
  roe_roce: number | null;
  valuation: number | null;
};

export type CrossSectionalInput = {
  ticker: string;
  metrics: Record<string, unknown>;
};

function asFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Scores a value against its peers using an average rank for ties. The best
 * value is 100, the worst is 0, and an all-tied universe is neutral at 50.
 */
function percentileScore(value: unknown, peerValues: unknown[], higherIsBetter: boolean): number | null {
  const numericValue = asFiniteNumber(value);
  const peers = peerValues
    .map(asFiniteNumber)
    .filter((peer): peer is number => peer !== null);

  if (numericValue === null || peers.length < 2) return null;

  const lower = peers.filter(peer => peer < numericValue).length;
  const ties = peers.filter(peer => peer === numericValue).length;
  const increasingPercentile = ((lower + (ties - 1) / 2) / (peers.length - 1)) * 100;
  const score = higherIsBetter ? increasingPercentile : 100 - increasingPercentile;

  return Number(score.toFixed(2));
}

/**
 * Builds factor scores from the current scan instead of anchoring them to
 * permanent thresholds. P/E only admits profitable companies (positive P/E)
 * so a loss-making company cannot look inexpensive merely because its P/E is
 * negative or unavailable.
 */
export function calculateCrossSectionalScores(universe: CrossSectionalInput[]): Map<string, CrossSectionalFactorScores> {
  const salesGrowth = universe.map(({ metrics }) => metrics.salesGrowth);
  const epsGrowth = universe.map(({ metrics }) => metrics.epsGrowth);
  const roe = universe.map(({ metrics }) => metrics.roe);
  const positivePe = universe
    .map(({ metrics }) => asFiniteNumber(metrics.peRatio))
    .filter((pe): pe is number => pe !== null && pe > 0);

  return new Map(universe.map(({ ticker, metrics }) => {
    const peRatio = asFiniteNumber(metrics.peRatio);

    return [ticker, {
      sales: percentileScore(metrics.salesGrowth, salesGrowth, true),
      eps: percentileScore(metrics.epsGrowth, epsGrowth, true),
      roe_roce: percentileScore(metrics.roe, roe, true),
      valuation: peRatio !== null && peRatio > 0
        ? percentileScore(peRatio, positivePe, false)
        : null,
    }];
  }));
}

export function calculateNexusMatrix(
  metrics: any,
  liveChange: number,
  regime: string,
  sector: string = 'General',
  price: number = 0,
  relativeScores?: CrossSectionalFactorScores,
) {
  // Use the current universe's percentile ranks whenever at least two valid
  // peers are available. Fixed anchors remain only as a graceful fallback for
  // a one-stock/insufficient-data scan.
  const sales = relativeScores?.sales ?? (metrics.salesGrowth != null ? sigmoid(metrics.salesGrowth, 15, 0.2) : null);
  const eps = relativeScores?.eps ?? (metrics.epsGrowth != null ? sigmoid(metrics.epsGrowth, 15, 0.2) : null);
  const roe_roce = relativeScores?.roe_roce ?? (metrics.roe != null ? sigmoid(metrics.roe, 15, 0.2) : null);
  // cfoPat is now a real CFO/net-income ratio pulled from statement history
  // (see server.ts + src/lib/piotroski.ts) and can be `null` when Yahoo
  // doesn't have the underlying cash-flow data for this ticker — in that
  // case we exclude the factor rather than guessing a value.
  const cfo_pat = metrics.cfoPat != null ? sigmoid(metrics.cfoPat, 1.0, 4.0) : null;

  const isFinancial = sector.includes('Financial') || sector.includes('Bank') || sector.includes('NBFC');

  const peRatio = asFiniteNumber(metrics.peRatio);
  const anchorPe = asFiniteNumber(metrics.trailingPeMidpoint) ?? 25;
  const valuation = peRatio === null || peRatio <= 0
    ? null
    : relativeScores?.valuation ?? sigmoid(peRatio, anchorPe, 0.15, true);
  
  // Financials intrinsically run with high leverage, so D/E is not a valid penalty
  const debt_equity = isFinancial || metrics.debtEquity == null ? null : sigmoid(metrics.debtEquity, 1.0, 3.0, true);
  
  // Realized Volatility: Inverted so lower volatility = safer = higher score
  const volatility = metrics.volatility != null ? sigmoid(metrics.volatility, 40, 0.15, true) : null;

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
  const scores = { sales, roe_roce, cfo_pat, valuation, eps, f_score, debt_equity, volatility, momentum, sentiment };

  let weights: Record<string, number> = {
    sales: 0.15, roe_roce: 0.15, cfo_pat: 0.10, 
    valuation: 0.15, eps: 0.10, f_score: 0.10, 
    debt_equity: 0.05, volatility: 0.05, momentum: 0.15, sentiment: 0.00
  };

  if (regime === 'Bull' || regime === 'Breakout') {
    weights = { ...weights, momentum: 0.25, sales: 0.20, valuation: 0.05, debt_equity: 0.025, volatility: 0.025 };
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

  // Compute signed point contributions relative to a neutral 50 baseline
  const contributions: { factor: string, points: number }[] = [];
  if (weightTotal > 0) {
    for (const [key, val] of Object.entries(scores)) {
      if (val === null) continue;
      const w = weights[key] || 0;
      if (w === 0) continue;
      
      const renormalizedWeight = w / weightTotal;
      const points = (val - 50) * renormalizedWeight;
      
      // Formatting names for UI display
      const factorNames: Record<string, string> = {
        sales: 'Sales Growth', roe_roce: 'ROE/ROCE', cfo_pat: 'Cash Conv.',
        valuation: 'Valuation', eps: 'EPS Growth', f_score: 'Piotroski',
        debt_equity: 'Leverage', volatility: 'Volatility', momentum: 'Momentum', sentiment: 'Sentiment'
      };
      
      contributions.push({
        factor: factorNames[key] || key,
        points: Number(points.toFixed(1))
      });
    }
  }

  // Sort contributions by absolute impact (highest magnitude first)
  contributions.sort((a, b) => Math.abs(b.points) - Math.abs(a.points));

  // Phase 8: Named category scores — group existing factors into 5 buckets
  const avgBucket = (keys: string[]) => {
    const vals = keys.map(k => (scores as any)[k]).filter((v: any) => v !== null) as number[];
    return vals.length > 0 ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : null;
  };

  const categoryScores = {
    quality:  avgBucket(['f_score', 'cfo_pat', 'roe_roce']),
    growth:   avgBucket(['sales', 'eps']),
    value:    avgBucket(['valuation']),
    momentum: avgBucket(['momentum']),
    risk:     avgBucket(['debt_equity', 'volatility']),
  };

  return {
    scores,
    contributions,
    categoryScores,
    nexusScore,
    dataCompleteness: { available: factorsAvailable, total: totalFactors },
  };
}
