export function calculateDCF(
  freeCashFlow: number,
  growthRate: number,
  terminalGrowthRate: number,
  discountRate: number,
  years: number,
  sharesOutstanding: number,
  netDebt: number = 0
): number | null {
  if (sharesOutstanding <= 0 || discountRate <= 0 || freeCashFlow <= 0) return null;

  let presentValue = 0;
  let currentFCF = freeCashFlow;

  // Project FCF over 'years' and discount
  for (let i = 1; i <= years; i++) {
    currentFCF *= (1 + growthRate);
    presentValue += currentFCF / Math.pow(1 + discountRate, i);
  }

  // Terminal Value (Gordon Growth Model)
  // TV = FCF_n * (1 + g) / (WACC - g)
  if (discountRate <= terminalGrowthRate) return null; // Invalid model constraints

  const terminalValue = (currentFCF * (1 + terminalGrowthRate)) / (discountRate - terminalGrowthRate);
  const pvTerminalValue = terminalValue / Math.pow(1 + discountRate, years);

  // Enterprise Value to Equity Value
  const enterpriseValue = presentValue + pvTerminalValue;
  const equityValue = enterpriseValue - netDebt;

  const intrinsicValuePerShare = equityValue / sharesOutstanding;
  return intrinsicValuePerShare > 0 ? intrinsicValuePerShare : 0;
}

export function calculateReverseDCF(
  currentPrice: number,
  freeCashFlow: number,
  terminalGrowthRate: number,
  discountRate: number,
  years: number,
  sharesOutstanding: number,
  netDebt: number = 0
): number | null {
  if (sharesOutstanding <= 0 || discountRate <= 0 || freeCashFlow <= 0 || currentPrice <= 0) return null;

  // We binary search the implied growth rate between -0.5 (-50%) and 1 (100%)
  let low = -0.5;
  let high = 1.0;
  const targetEquityValue = currentPrice * sharesOutstanding;
  const targetEnterpriseValue = targetEquityValue + netDebt;
  const tolerance = 0.01;

  for (let iter = 0; iter < 50; iter++) { // 50 iterations max
    const mid = (low + high) / 2;
    
    let pv = 0;
    let currentFCF = freeCashFlow;
    
    for (let i = 1; i <= years; i++) {
      currentFCF *= (1 + mid);
      pv += currentFCF / Math.pow(1 + discountRate, i);
    }
    
    // Terminal value
    let tv = 0;
    if (discountRate > terminalGrowthRate) {
      tv = (currentFCF * (1 + terminalGrowthRate)) / (discountRate - terminalGrowthRate);
    }
    const pvTv = tv / Math.pow(1 + discountRate, years);
    const ev = pv + pvTv;

    if (Math.abs(ev - targetEnterpriseValue) / targetEnterpriseValue < tolerance) {
      return mid; // Found it
    }

    if (ev > targetEnterpriseValue) {
      high = mid; // EV is too high, decrease growth rate
    } else {
      low = mid; // EV is too low, increase growth rate
    }
  }

  return (low + high) / 2; // Return best effort
}
