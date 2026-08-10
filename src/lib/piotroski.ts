/**
 * Piotroski F-Score
 * ------------------
 * Implements the classic 9-point Piotroski (2000) test for fundamental
 * financial strength, computed from real annual financial-statement data
 * pulled via Yahoo Finance's `fundamentalsTimeSeries` endpoint — instead
 * of the hardcoded `fScore: 5` placeholder this used to ship with.
 *
 * Design choice: each of the 9 tests is scored independently, and a test
 * is only counted if its underlying line items are actually present for
 * both the current and prior fiscal year. Line items like "current
 * assets/liabilities" or "gross profit" are frequently absent for banks
 * and NBFCs (they don't file a classified balance sheet or a gross-profit
 * line), which is exactly the kind of company in this universe (Federal
 * Bank, DCB Bank, Muthoot Finance, HDB Financial, Canfin Homes...).
 * Silently treating "no data" as "fail" would systematically punish every
 * financial-sector stock. Instead, missing tests are excluded from both
 * the numerator and denominator, and the result is normalized back onto
 * the familiar 0–9 scale so it stays comparable across companies with
 * different disclosure depth. `dataQuality` tells the caller (and the UI)
 * how much of the test was actually gradable.
 */

export interface AnnualFundamentalPeriod {
  date: Date | string | number;
  totalRevenue?: number;
  netIncome?: number;
  grossProfit?: number;
  totalAssets?: number;
  currentAssets?: number;
  currentLiabilities?: number;
  longTermDebt?: number;
  totalDebt?: number;
  operatingCashFlow?: number;
  ordinarySharesNumber?: number;
  netCommonStockIssuance?: number;
}

export interface PiotroskiCriterion {
  key: string;
  label: string;
  /** true = passed, false = failed, null = could not be evaluated (data not reported) */
  pass: boolean | null;
  detail: string;
}

export interface PiotroskiResult {
  /** Raw points earned out of the tests that could actually be evaluated */
  pointsEarned: number;
  /** How many of the 9 tests had enough data to be evaluated (0-9) */
  pointsPossible: number;
  /** pointsEarned/pointsPossible rescaled onto the familiar 0-9 Piotroski scale, or null if nothing was gradable */
  normalizedScore: number | null;
  dataQuality: 'full' | 'partial' | 'insufficient';
  criteria: PiotroskiCriterion[];
  periodsUsed: { current: string; prior: string } | null;
}

function toTime(d: Date | string | number): number {
  return d instanceof Date ? d.getTime() : new Date(d).getTime();
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/**
 * @param periodsInput Annual statement data, at least 2 fiscal years, in any order.
 *   Pass the array returned by `yahooFinance.fundamentalsTimeSeries(ticker, { type: 'annual', module: 'all' })`.
 */
export function calculatePiotroskiFScore(periodsInput: AnnualFundamentalPeriod[]): PiotroskiResult {
  const periods = [...(periodsInput || [])]
    .filter((p) => p && p.date != null)
    .sort((a, b) => toTime(a.date) - toTime(b.date));

  if (periods.length < 2) {
    return {
      pointsEarned: 0,
      pointsPossible: 0,
      normalizedScore: null,
      dataQuality: 'insufficient',
      criteria: [],
      periodsUsed: null,
    };
  }

  const curr = periods[periods.length - 1];
  const prev = periods[periods.length - 2];

  const criteria: PiotroskiCriterion[] = [];

  const addCriterion = (
    key: string,
    label: string,
    evaluate: () => boolean | null,
    detailPass: string,
    detailFail: string,
    detailMissing: string,
  ) => {
    let pass: boolean | null;
    try {
      pass = evaluate();
    } catch {
      pass = null;
    }
    criteria.push({ key, label, pass, detail: pass === null ? detailMissing : pass ? detailPass : detailFail });
  };

  const roaCurr = (() => {
    const ni = num(curr.netIncome);
    const ta = num(curr.totalAssets);
    return ni !== null && ta ? ni / ta : null;
  })();
  const roaPrev = (() => {
    const ni = num(prev.netIncome);
    const ta = num(prev.totalAssets);
    return ni !== null && ta ? ni / ta : null;
  })();

  // --- Profitability (4 tests) ---

  addCriterion(
    'roa',
    'Positive ROA',
    () => (roaCurr === null ? null : roaCurr > 0),
    'Net income is positive relative to total assets.',
    'Net loss relative to total assets.',
    'Net income or total assets not reported for the latest fiscal year.',
  );

  addCriterion(
    'cfo',
    'Positive Operating Cash Flow',
    () => {
      const cfo = num(curr.operatingCashFlow);
      return cfo === null ? null : cfo > 0;
    },
    'Operating cash flow is positive.',
    'Operating cash flow is negative — earnings are not converting to cash.',
    'Operating cash flow not reported for the latest fiscal year.',
  );

  addCriterion(
    'deltaRoa',
    'Improving ROA',
    () => (roaCurr === null || roaPrev === null ? null : roaCurr > roaPrev),
    'Return on assets improved year-over-year.',
    'Return on assets declined year-over-year.',
    'Insufficient data for a two-year ROA comparison.',
  );

  addCriterion(
    'accruals',
    'Earnings Quality (CFO > Net Income)',
    () => {
      const cfo = num(curr.operatingCashFlow);
      const ni = num(curr.netIncome);
      return cfo === null || ni === null ? null : cfo > ni;
    },
    'Cash earnings exceed reported net income (low accrual risk).',
    'Reported net income exceeds cash earnings — an earnings-quality flag.',
    'Operating cash flow or net income not reported.',
  );

  // --- Leverage, Liquidity & Source of Funds (3 tests) ---

  addCriterion(
    'leverage',
    'Declining Leverage',
    () => {
      const ltdCurr = num(curr.longTermDebt) ?? num(curr.totalDebt);
      const ltdPrev = num(prev.longTermDebt) ?? num(prev.totalDebt);
      const taCurr = num(curr.totalAssets);
      const taPrev = num(prev.totalAssets);
      if (ltdCurr === null || ltdPrev === null || !taCurr || !taPrev) return null;
      return ltdCurr / taCurr < ltdPrev / taPrev;
    },
    'Long-term debt relative to assets decreased.',
    'Long-term debt relative to assets increased.',
    'Long-term debt or total assets not reported for both years.',
  );

  addCriterion(
    'liquidity',
    'Improving Current Ratio',
    () => {
      const caCurr = num(curr.currentAssets);
      const clCurr = num(curr.currentLiabilities);
      const caPrev = num(prev.currentAssets);
      const clPrev = num(prev.currentLiabilities);
      if (caCurr === null || !clCurr || caPrev === null || !clPrev) return null;
      return caCurr / clCurr > caPrev / clPrev;
    },
    'Current ratio improved (better short-term liquidity).',
    'Current ratio deteriorated.',
    'Current assets/liabilities not reported for both years — common for banks and NBFCs, which do not file a classified balance sheet.',
  );

  addCriterion(
    'shares',
    'No Dilution',
    () => {
      const shCurr = num(curr.ordinarySharesNumber);
      const shPrev = num(prev.ordinarySharesNumber);
      if (shCurr !== null && shPrev !== null) return shCurr <= shPrev * 1.001; // small tolerance for rounding
      const issuance = num(curr.netCommonStockIssuance);
      if (issuance !== null) return issuance <= 0;
      return null;
    },
    'No net new shares issued during the year.',
    'Company issued net new shares (dilution).',
    'Shares outstanding / issuance data not reported.',
  );

  // --- Operating Efficiency (2 tests) ---

  addCriterion(
    'grossMargin',
    'Improving Gross Margin',
    () => {
      const gpCurr = num(curr.grossProfit);
      const revCurr = num(curr.totalRevenue);
      const gpPrev = num(prev.grossProfit);
      const revPrev = num(prev.totalRevenue);
      if (gpCurr === null || !revCurr || gpPrev === null || !revPrev) return null;
      return gpCurr / revCurr > gpPrev / revPrev;
    },
    'Gross margin expanded year-over-year.',
    'Gross margin contracted year-over-year.',
    'Gross profit not reported — common for banks/NBFCs and some services companies.',
  );

  addCriterion(
    'assetTurnover',
    'Improving Asset Turnover',
    () => {
      const revCurr = num(curr.totalRevenue);
      const taCurr = num(curr.totalAssets);
      const revPrev = num(prev.totalRevenue);
      const taPrev = num(prev.totalAssets);
      if (revCurr === null || !taCurr || revPrev === null || !taPrev) return null;
      return revCurr / taCurr > revPrev / taPrev;
    },
    'Asset turnover improved (more revenue per rupee of assets).',
    'Asset turnover declined.',
    'Revenue or total assets not reported for both years.',
  );

  const evaluated = criteria.filter((c) => c.pass !== null);
  const pointsEarned = evaluated.filter((c) => c.pass === true).length;
  const pointsPossible = evaluated.length;

  const normalizedScore = pointsPossible === 0 ? null : Number(((pointsEarned / pointsPossible) * 9).toFixed(2));

  const dataQuality: PiotroskiResult['dataQuality'] =
    pointsPossible === 0 ? 'insufficient' : pointsPossible === 9 ? 'full' : 'partial';

  return {
    pointsEarned,
    pointsPossible,
    normalizedScore,
    dataQuality,
    criteria,
    periodsUsed: {
      current: new Date(curr.date).toISOString().slice(0, 10),
      prior: new Date(prev.date).toISOString().slice(0, 10),
    },
  };
}
