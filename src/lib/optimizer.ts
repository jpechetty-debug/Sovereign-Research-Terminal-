export type OptimizationMethod = 'equal_weight' | 'inverse_volatility';

interface HoldingData {
  ticker: string;
  priceHistory: { date: string, close: number }[];
}

export function optimizePortfolio(holdings: HoldingData[], method: OptimizationMethod): Record<string, number> {
  const weights: Record<string, number> = {};
  
  if (holdings.length === 0) return weights;

  if (method === 'equal_weight') {
    const weight = 1 / holdings.length;
    for (const h of holdings) {
      weights[h.ticker] = weight;
    }
    return weights;
  }

  if (method === 'inverse_volatility') {
    const volatilities: Record<string, number> = {};
    let totalInvVol = 0;

    for (const h of holdings) {
      const prices = h.priceHistory.map(p => p.close).filter(p => p > 0);
      if (prices.length < 2) {
        // Fallback if not enough history
        volatilities[h.ticker] = 1;
        totalInvVol += 1;
        continue;
      }

      // Calculate daily returns
      const returns: number[] = [];
      for (let i = 1; i < prices.length; i++) {
        returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
      }

      // Calculate standard deviation of returns
      const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
      const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (returns.length - 1);
      const stdDev = Math.sqrt(variance);

      // We use standard deviation as a proxy for volatility. Avoid div by zero.
      const vol = stdDev > 0 ? stdDev : 0.001;
      const invVol = 1 / vol;
      
      volatilities[h.ticker] = invVol;
      totalInvVol += invVol;
    }

    // Normalize weights so they sum to 1
    for (const h of holdings) {
      weights[h.ticker] = volatilities[h.ticker] / totalInvVol;
    }
    return weights;
  }

  return weights;
}
