export function deriveRegime(liveChangePercent: number, metrics: { salesGrowth: number; epsGrowth: number }): string {
  const fundamentalStrength = (metrics.salesGrowth + metrics.epsGrowth) / 2;
  if (liveChangePercent > 3) return 'Breakout';
  if (liveChangePercent < -3) return 'Bear';
  if (liveChangePercent > 0 && fundamentalStrength > 15) return 'Bull';
  return 'Neutral';
}

export function sigmoid(x: number, mid: number, steepness: number, invert = false): number {
  const k = invert ? -steepness : steepness;
  const val = 1 / (1 + Math.exp(-k * (x - mid)));
  return Math.max(0, Math.min(100, Math.round(val * 100)));
}

export function calculateNexusMatrix(metrics: any, liveChange: number, regime: string, sector: string = 'General') {
  const sales = sigmoid(metrics.salesGrowth, 15, 0.2); 
  const eps = sigmoid(metrics.epsGrowth, 15, 0.2);     
  const roe_roce = sigmoid(metrics.roe, 15, 0.2);      
  const cfo_pat = sigmoid(metrics.cfoPat, 1.0, 4.0);   
  
  let peMidpoint = 25;
  if (sector.includes('Tech') || sector.includes('IT')) peMidpoint = 35;
  if (sector.includes('Utilities') || sector.includes('Energy')) peMidpoint = 15;
  
  const valuation = sigmoid(metrics.peRatio === 0 ? 100 : metrics.peRatio, peMidpoint, 0.15, true); 
  const debt_equity = sigmoid(metrics.debtEquity, 1.0, 3.0, true);

  const f_score = sigmoid(metrics.fScore, 5, 0.8);
  const momentum = sigmoid(liveChange, 0, 0.5); 
  const sentiment = 50; 
  const scores = { sales, roe_roce, cfo_pat, valuation, eps, f_score, debt_equity, momentum, sentiment };

  let weights = {
    sales: 0.15, roe_roce: 0.15, cfo_pat: 0.10, 
    valuation: 0.15, eps: 0.10, f_score: 0.10, 
    debt_equity: 0.10, momentum: 0.15, sentiment: 0.00
  };

  if (regime === 'Bull' || regime === 'Breakout') {
    weights = { ...weights, momentum: 0.25, sales: 0.20, valuation: 0.05, debt_equity: 0.05 };
  } else if (regime === 'Bear') {
    weights = { ...weights, valuation: 0.25, cfo_pat: 0.20, roe_roce: 0.20, momentum: 0.0, sales: 0.05, sentiment: 0.00 };
  }

  const nexusScore = Object.entries(scores).reduce((acc, [key, val]) => {
    return acc + (val * (weights[key as keyof typeof weights] || 0));
  }, 0);

  return {
    scores,
    nexusScore: Number(nexusScore.toFixed(2))
  };
}
