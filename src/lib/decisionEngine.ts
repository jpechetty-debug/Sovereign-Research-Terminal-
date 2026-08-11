export interface FactorContribution {
  factor: string;
  points: number;
}

export interface DecisionVerdict {
  verdict: 'BUY' | 'HOLD' | 'AVOID';
  confidence: number;
  reasons: FactorContribution[];
  risks: FactorContribution[];
}

export function generateVerdict(
  nexusScore: number, 
  contributions: FactorContribution[],
  dataCompleteness: { available: number; total: number }
): DecisionVerdict {
  // Confidence is strictly data completeness
  const confidence = dataCompleteness.total > 0 
    ? Math.round((dataCompleteness.available / dataCompleteness.total) * 100)
    : 0;

  // Determine explicit deterministic verdict based on thresholds
  let verdict: 'BUY' | 'HOLD' | 'AVOID' = 'AVOID';
  
  if (nexusScore >= 75 && confidence >= 60) {
    verdict = 'BUY';
  } else if (nexusScore >= 50 && confidence >= 40) {
    verdict = 'HOLD';
  }

  // If confidence is extremely low, cap the rating to AVOID due to uncertainty
  if (confidence < 40) {
    verdict = 'AVOID';
  }

  // Extract reasons (positive contributors) and risks (negative contributors)
  // We sort them by magnitude of points
  const sortedContributions = [...contributions].sort((a, b) => Math.abs(b.points) - Math.abs(a.points));
  
  const reasons = sortedContributions.filter(c => c.points > 0).slice(0, 3);
  const risks = sortedContributions.filter(c => c.points < 0).slice(0, 2);

  return {
    verdict,
    confidence,
    reasons,
    risks
  };
}

