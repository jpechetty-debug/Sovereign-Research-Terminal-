export interface FundamentalRow {
  period_end: string;
  revenue: number | null;
  net_income: number | null;
  gross_profit: number | null;
  shares_outstanding: number | null;
}

export function computeCAGR(startValue: number, endValue: number, years: number): number | null {
  if (years <= 0 || startValue <= 0 || endValue <= 0) return null;
  return (Math.pow(endValue / startValue, 1 / years) - 1) * 100;
}

export function computeMarginTrends(history: FundamentalRow[]) {
  // Assuming history is sorted oldest to newest
  return history.map(row => {
    const grossMargin = (row.gross_profit && row.revenue && row.revenue > 0) ? (row.gross_profit / row.revenue) * 100 : null;
    const netMargin = (row.net_income && row.revenue && row.revenue > 0) ? (row.net_income / row.revenue) * 100 : null;
    return {
      period_end: row.period_end,
      grossMargin,
      netMargin,
      revenue: row.revenue,
      netIncome: row.net_income,
    };
  });
}

export function computeTrendsAndCAGR(history: FundamentalRow[]) {
  if (history.length < 2) {
    return {
      revenueCagr: null,
      epsCagr: null,
      margins: computeMarginTrends(history),
      years: 0
    };
  }

  // Sort by date ascending to ensure proper start/end
  const sorted = [...history].sort((a, b) => new Date(a.period_end).getTime() - new Date(b.period_end).getTime());
  const start = sorted[0];
  const end = sorted[sorted.length - 1];
  
  // Rough estimate of years (ms to years)
  const msPerYear = 1000 * 60 * 60 * 24 * 365.25;
  let years = (new Date(end.period_end).getTime() - new Date(start.period_end).getTime()) / msPerYear;
  if (years < 1) years = 1; // Minimum 1 year if we have 2 periods

  const revenueCagr = start.revenue && end.revenue ? computeCAGR(start.revenue, end.revenue, years) : null;
  
  const startEps = (start.net_income && start.shares_outstanding) ? start.net_income / start.shares_outstanding : null;
  const endEps = (end.net_income && end.shares_outstanding) ? end.net_income / end.shares_outstanding : null;
  const epsCagr = startEps && endEps && startEps > 0 && endEps > 0 ? computeCAGR(startEps, endEps, years) : null;

  return {
    revenueCagr,
    epsCagr,
    margins: computeMarginTrends(sorted),
    years: Math.round(years * 10) / 10
  };
}

export function computeTrailingPEBand(priceHistory: { close: number, date: string }[], latestEps: number | null): number | null {
  if (!latestEps || latestEps <= 0 || priceHistory.length === 0) return null;
  
  // Calculate historical P/E ratios for all available price points
  const peRatios = priceHistory.map(p => p.close / latestEps).filter(pe => pe > 0 && pe < 500); // Sanity bounds
  
  if (peRatios.length === 0) return null;

  // We'll return the median P/E as the historical "midpoint" for this stock
  peRatios.sort((a, b) => a - b);
  const mid = Math.floor(peRatios.length / 2);
  
  return peRatios.length % 2 !== 0 ? peRatios[mid] : (peRatios[mid - 1] + peRatios[mid]) / 2;
}
