import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import YahooFinance from 'yahoo-finance2';
import { initDB, getUniverse, addTicker, removeTicker, getFundamentalsCache, saveFundamentalsCache, getPriceHistory, getNotes, addNote, deleteNote, savePriceHistory, saveFundamentalsHistory, getFundamentalsHistory, saveAlphaScore, getHoldings, addHolding, removeHolding, getLatestAiMemo, saveAiMemo, getAlphaScoreHistory, getLatestPriceHistory } from './src/db';
import { optimizePortfolio, OptimizationMethod } from './src/lib/optimizer';
import { calculatePiotroskiFScore, type AnnualFundamentalPeriod } from './src/lib/piotroski';
import { computeTrendsAndCAGR, computeTrailingPEBand, computeRiskMetrics } from './src/lib/financialAnalysis';
import { generateAiMemo } from './src/lib/aiCopilot';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

const QUOTE_CACHE: Record<string, { timestamp: number; data: any }> = {};
const QUOTE_CACHE_TTL = 10 * 1000; // 10 seconds

const FUNDAMENTAL_CACHE_TTL = 1000 * 60 * 60 * 12; // 12 hours
const FUNDAMENTAL_FAILURE_TTL = 1000 * 60 * 15; // 15 minutes — retry failed fetches much sooner than successful ones

const fundamentalQueue: string[] = [];
let isProcessingQueue = false;

async function processFundamentalQueue() {
  if (isProcessingQueue) return;
  isProcessingQueue = true;
  
  while (fundamentalQueue.length > 0) {
    const ticker = fundamentalQueue.shift();
    if (!ticker) continue;
    
    const cached = getFundamentalsCache(ticker);
    const cacheTtl = cached && cached.data === null ? FUNDAMENTAL_FAILURE_TTL : FUNDAMENTAL_CACHE_TTL;
    if (cached && (Date.now() - cached.timestamp < cacheTtl)) {
      continue;
    }
    
    try {
      const summary = await yahooFinance.quoteSummary(ticker, { modules: ['financialData', 'defaultKeyStatistics', 'summaryDetail'] }) as any;
      const fd = summary.financialData || {};
      const dks = summary.defaultKeyStatistics || {};
      const sd = summary.summaryDetail || {};

      // Real Piotroski F-Score + CFO/PAT, computed from actual multi-year
      // financial statements rather than the old fixed proxies (cfoPat: 1.1,
      // fScore: 5). This is a separate fetch/try-catch from the quoteSummary
      // call above on purpose: fundamentalsTimeSeries is a heavier, less
      // reliable endpoint (thin small-caps often lack enough statement
      // history), and a failure here should leave fScore/cfoPat as `null`
      // rather than wiping out the growth/ROE/valuation data we already got.
      let fScore: number | null = null;
      let fScoreDetail: ReturnType<typeof calculatePiotroskiFScore> | null = null;
      let cfoPat: number | null = null;

      try {
        const period1 = new Date();
        period1.setFullYear(period1.getFullYear() - 4);

        const series = (await yahooFinance.fundamentalsTimeSeries(ticker, {
          period1,
          period2: new Date(),
          type: 'annual',
          module: 'all',
        })) as unknown as AnnualFundamentalPeriod[];

        const piotroski = calculatePiotroskiFScore(series);
        fScore = piotroski.normalizedScore;
        fScoreDetail = piotroski;

        // Phase 1: Save fundamentals history
        if (series && series.length > 0) {
          saveFundamentalsHistory(ticker, series);
        }

        const latest = [...series]
          .filter((p) => p && p.date != null)
          .sort((a, b) => new Date(a.date as any).getTime() - new Date(b.date as any).getTime())
          .pop();

        if (latest && typeof latest.operatingCashFlow === 'number' && typeof latest.netIncome === 'number' && latest.netIncome > 0) {
          cfoPat = Number((latest.operatingCashFlow / latest.netIncome).toFixed(2));
        }
      } catch (statementErr: any) {
        console.error(`Statement history fetch failed for ${ticker} (F-Score/CFO-PAT unavailable):`, statementErr?.message || statementErr);
      }

      const data = {
        salesGrowth: fd.revenueGrowth != null ? fd.revenueGrowth * 100 : null,
        epsGrowth: fd.earningsGrowth != null ? fd.earningsGrowth * 100 : null,
        roe: fd.returnOnEquity != null ? fd.returnOnEquity * 100 : null,
        cfoPat, // real CFO/net-income ratio, or null if statement data unavailable
        fScore, // real 0-9 Piotroski F-Score (rescaled if some tests were ungradable), or null
        fScoreDetail, // full breakdown (criteria pass/fail + dataQuality) for the UI
        debtEquity: fd.debtToEquity != null ? fd.debtToEquity / 100 : null,
        peRatio: sd.trailingPE != null ? sd.trailingPE : (dks.forwardPE != null ? dks.forwardPE : null),
        fiftyTwoWeekChange: (dks['52WeekChange'] || 0) * 100,
        fiftyDayAverage: sd.fiftyDayAverage || 0,
        twoHundredDayAverage: sd.twoHundredDayAverage || 0,
        operatingCashFlow: fd.operatingCashflow != null ? fd.operatingCashflow : null,
        sharesOutstanding: dks.sharesOutstanding != null ? dks.sharesOutstanding : null,
        eps: dks.trailingEps != null ? dks.trailingEps : (dks.forwardEps != null ? dks.forwardEps : null)
      };
      
      saveFundamentalsCache(ticker, data);
    } catch(e: any) {
      console.error(`Fundamental fetch failed for ${ticker}`);
      saveFundamentalsCache(ticker, null);
    }
    
    // Two Yahoo requests per ticker now (quote summary + statement history),
    // so we pace a little more conservatively than before.
    await new Promise(r => setTimeout(r, 1200));
  }
  
  isProcessingQueue = false;
}

let cachedVix: { timestamp: number; data: any } | null = null;
const VIX_CACHE_TTL = 15 * 1000;

async function startServer() {
  // Initialize Database
  initDB();

  const app = express();
  app.use(express.json());
  
  const PORT = Number(process.env.PORT) || 3000;

  // Basic API Key Middleware
  if (process.env.API_KEY) {
    app.use('/api', (req, res, next) => {
      const apiKey = req.headers['x-api-key'] || req.query.api_key;
      if (apiKey !== process.env.API_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      next();
    });
  }

  // Universe Endpoints
  app.get('/api/universe', (req, res) => {
    try {
      const universe = getUniverse();
      res.json({ data: universe });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch universe' });
    }
  });

  app.post('/api/ticker', (req, res) => {
    const { ticker, name, sector } = req.body;
    if (!ticker) return res.status(400).json({ error: 'Ticker is required' });
    const success = addTicker(ticker, name || ticker, sector || 'Unknown');
    if (success) {
      res.json({ success: true });
    } else {
      res.status(500).json({ error: 'Failed to add ticker' });
    }
  });

  app.delete('/api/ticker/:ticker', (req, res) => {
    const success = removeTicker(req.params.ticker);
    if (success) {
      res.json({ success: true });
    } else {
      res.status(500).json({ error: 'Failed to remove ticker' });
    }
  });

  // Analysis Endpoints
  app.get('/api/analysis/:ticker', (req, res) => {
    try {
      const ticker = req.params.ticker;
      const history = getFundamentalsHistory(ticker);
      const analysis = computeTrendsAndCAGR(history as any);
      res.json({ success: true, data: analysis });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to compute analysis' });
    }
  });

  // Notes Endpoints
  app.get('/api/notes/:ticker', (req, res) => {
    try {
      const notes = getNotes(req.params.ticker);
      res.json({ data: notes });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch notes' });
    }
  });

  app.post('/api/notes/:ticker', (req, res) => {
    const { body, tag, targetPrice, lastReviewedAt } = req.body;
    if (!body) return res.status(400).json({ error: 'Note body is required' });
    
    const result = addNote(req.params.ticker, body, tag || 'journal', targetPrice, lastReviewedAt);
    if (result) {
      res.json({ success: true, id: result.id });
    } else {
      res.status(500).json({ error: 'Failed to add note' });
    }
  });

  app.delete('/api/notes/:id', (req, res) => {
    const success = deleteNote(req.params.id);
    if (success) {
      res.json({ success: true });
    } else {
      res.status(500).json({ error: 'Failed to remove note' });
    }
  });

  // Portfolio Endpoints
  app.get('/api/portfolio', async (req, res) => {
    try {
      const holdings = getHoldings();
      
      let maxDrawdown = 0;
      let portfolioBeta = 1.0; 
      
      if (holdings.length > 0) {
        const dateMap = new Map<string, number>();
        holdings.forEach(h => {
          const history = getPriceHistory(h.ticker) as { date: string, close: number }[];
          history.forEach(p => {
            const current = dateMap.get(p.date) || 0;
            dateMap.set(p.date, current + (p.close * h.quantity));
          });
        });
        
        const sortedDates = Array.from(dateMap.keys()).sort();
        const portValues = sortedDates.map(d => dateMap.get(d)!);
        
        if (portValues.length > 0) {
          let peak = portValues[0];
          let maxDd = 0;
          for (const val of portValues) {
            if (val > peak) peak = val;
            const dd = (val - peak) / peak;
            if (dd < maxDd) maxDd = dd;
          }
          maxDrawdown = maxDd;
        }
        
        let niftyHistory = getPriceHistory('^NSEI') as { date: string, close: number }[];
        
        if (!niftyHistory || niftyHistory.length === 0) {
          try {
            const now = new Date();
            const period1 = new Date();
            period1.setDate(period1.getDate() - 365); // 1 year of history
            
            const result = await yahooFinance.chart('^NSEI', {
              period1,
              period2: now,
              interval: '1d'
            }) as any;
            
            if (result && result.quotes) {
              const points = result.quotes
                .filter((q: any) => q.close != null)
                .map((q: any) => ({
                  date: new Date(q.date).toISOString().slice(0, 10),
                  price: Number(q.close.toFixed(2)),
                  open: q.open != null ? Number(q.open.toFixed(2)) : undefined,
                  high: q.high != null ? Number(q.high.toFixed(2)) : undefined,
                  low: q.low != null ? Number(q.low.toFixed(2)) : undefined,
                  volume: q.volume
                }));
              savePriceHistory('^NSEI', points);
              niftyHistory = points.map((p: any) => ({ date: p.date, close: p.price }));
            }
          } catch (e) {
            console.error("Failed to fetch ^NSEI history for portfolio beta", e);
          }
        }

        if (niftyHistory && niftyHistory.length > 0 && portValues.length > 1) {
          const portReturns: number[] = [];
          const benchReturns: number[] = [];
          
          for (let i = 1; i < sortedDates.length; i++) {
            const date = sortedDates[i];
            const prevDate = sortedDates[i-1];
            const prevVal = dateMap.get(prevDate);
            if (!prevVal) continue;
            
            const portRet = (dateMap.get(date)! - prevVal) / prevVal;
            
            const benchDay = niftyHistory.find(n => n.date === date);
            const benchPrev = niftyHistory.find(n => n.date === prevDate);
            
            if (benchDay && benchPrev && benchPrev.close > 0) {
              const benchRet = (benchDay.close - benchPrev.close) / benchPrev.close;
              portReturns.push(portRet);
              benchReturns.push(benchRet);
            }
          }
          
          if (portReturns.length > 0) {
            const portMean = portReturns.reduce((a, b) => a + b, 0) / portReturns.length;
            const benchMean = benchReturns.reduce((a, b) => a + b, 0) / benchReturns.length;
            
            let covariance = 0;
            let variance = 0;
            for (let i = 0; i < portReturns.length; i++) {
              covariance += (portReturns[i] - portMean) * (benchReturns[i] - benchMean);
              variance += Math.pow(benchReturns[i] - benchMean, 2);
            }
            
            if (variance > 0) {
              portfolioBeta = covariance / variance;
            }
          }
        }
      }
      
      res.json({ success: true, data: holdings, maxDrawdown, portfolioBeta });
    } catch (err) {
      console.error("Portfolio fetch err:", err);
      res.status(500).json({ error: 'Failed to fetch portfolio' });
    }
  });

  app.post('/api/portfolio', (req, res) => {
    const { ticker, quantity, avgCost } = req.body;
    if (!ticker || quantity === undefined || avgCost === undefined) {
      return res.status(400).json({ error: 'Missing portfolio data' });
    }
    const success = addHolding(ticker, quantity, avgCost);
    if (success) {
      res.json({ success: true });
    } else {
      res.status(500).json({ error: 'Failed to add holding' });
    }
  });

  app.delete('/api/portfolio/:ticker', (req, res) => {
    const success = removeHolding(req.params.ticker);
    if (success) {
      res.json({ success: true });
    } else {
      res.status(500).json({ error: 'Failed to remove holding' });
    }
  });

  // AI Copilot Endpoint
  app.get('/api/ai/memo/:ticker', (req, res) => {
    try {
      const memo = getLatestAiMemo(req.params.ticker);
      if (memo) {
        res.json({ success: true, data: JSON.parse(memo.memo_json), generated_at: memo.generated_at });
      } else {
        res.json({ success: false, data: null });
      }
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch AI memo' });
    }
  });

  app.post('/api/ai/memo/:ticker', async (req, res) => {
    try {
      const ticker = req.params.ticker;
      const { name, sector, price, nexusScore, factorScores } = req.body;
      
      const cachedFund = getFundamentalsCache(ticker);
      if (!cachedFund || !cachedFund.data) {
        return res.status(400).json({ error: 'Fundamentals not cached for this ticker. Try again later.' });
      }

      const notes = getNotes(ticker);

      const memo = await generateAiMemo({
        ticker,
        name,
        sector,
        price,
        fundamentals: cachedFund.data,
        nexusScore,
        factorScores,
        notes
      });

      if (memo) {
        saveAiMemo(ticker, JSON.stringify(memo));
        res.json({ success: true, data: memo });
      } else {
        res.status(500).json({ error: 'AI generation failed' });
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to generate AI memo' });
    }
  });

  app.get('/api/scan', async (req, res) => {
    try {
      const tickersArr = (req.query.symbols as string || '').split(',').filter(Boolean);
      if (tickersArr.length === 0) {
         return res.status(400).json({ error: 'No symbols provided' });
      }

      const now = Date.now();
      const neededTickers = tickersArr.filter(t => !QUOTE_CACHE[t] || (now - QUOTE_CACHE[t].timestamp > QUOTE_CACHE_TTL));

      if (neededTickers.length > 0) {
        try {
          const quotes = await yahooFinance.quote(neededTickers) as any;
          const results: any[] = Array.isArray(quotes) ? quotes : [quotes];
          for (const q of results) {
             QUOTE_CACHE[q.symbol] = { timestamp: now, data: q };
          }
        } catch (err) {
          console.error("Quote fetch error:", err);
        }
      }

      const scanData = tickersArr.map(t => {
        const q = QUOTE_CACHE[t]?.data;
        if (!q) return null;

        // Background fundamental fetch queueing
        const cachedFund = getFundamentalsCache(t);
        const fundTtl = cachedFund && cachedFund.data === null ? FUNDAMENTAL_FAILURE_TTL : FUNDAMENTAL_CACHE_TTL;
        if (!cachedFund || (now - cachedFund.timestamp > fundTtl)) {
           if (!fundamentalQueue.includes(t)) {
              fundamentalQueue.push(t);
           }
        }
        
        let trailingPeMidpoint = null;
        let volatility = null;
        let maxDrawdown1Y = null;
        if (cachedFund?.data) {
           let eps = cachedFund.data.eps;
           // Fallback to computing from price and PE ratio if missing from defaultKeyStatistics
           if (!eps && q.regularMarketPrice && cachedFund.data.peRatio) {
             eps = q.regularMarketPrice / cachedFund.data.peRatio;
           }
           
           const ph = getLatestPriceHistory(t, 250); // last 1 year roughly
           if (eps) {
             const band = computeTrailingPEBand(ph as any, eps);
             if (band) trailingPeMidpoint = band;
           }
           
           if (ph && ph.length > 0) {
             const risk = computeRiskMetrics(ph as any);
             volatility = risk.volatility;
             maxDrawdown1Y = risk.maxDrawdown1Y;
           }
        }

        return {
          ticker: q.symbol,
          price: q.regularMarketPrice,
          change: q.regularMarketChangePercent,
          marketCap: q.marketCap,
          volume: q.regularMarketVolume,
          fundamentals: cachedFund?.data ? { ...cachedFund.data, trailingPeMidpoint, volatility, maxDrawdown1Y } : null
        };
      }).filter(Boolean);

      // Trigger queue processing
      if (fundamentalQueue.length > 0) {
        processFundamentalQueue().catch(() => {});
      }

      let vix: { price: number; change: number } | null = null;
      if (cachedVix && (now - cachedVix.timestamp < VIX_CACHE_TTL)) {
         vix = cachedVix.data;
      } else {
        try {
          const vixQuote = await yahooFinance.quote('^INDIAVIX') as any;
          vix = {
            price: vixQuote.regularMarketPrice,
            change: vixQuote.regularMarketChangePercent
          };
          cachedVix = { timestamp: now, data: vix };
        } catch (vixErr) {
          console.warn('VIX fetch failed:', vixErr);
          if (cachedVix) vix = cachedVix.data; // Fallback to stale cache
        }
      }

      res.json({ data: scanData, vix });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Realtime fetch failed' });
    }
  });

  app.get('/api/history/:ticker', async (req, res) => {
    try {
      const ticker = req.params.ticker;
      
      const dbHistory = getPriceHistory(ticker) as any[];
      const now = new Date();
      const oneDayMs = 24 * 60 * 60 * 1000;
      
      let needsFetch = true;
      if (dbHistory.length > 0) {
        const lastDate = new Date(dbHistory[dbHistory.length - 1].date);
        // If the last date is within 2 days, we consider it fresh enough for this MVP 
        // (handles weekends naively, but prevents constant fetching)
        if (now.getTime() - lastDate.getTime() < 2 * oneDayMs) {
          needsFetch = false;
        }
      }

      if (needsFetch) {
        const period2 = new Date();
        const period1 = new Date();
        // Fetch a bit more than 30 days to be safe if DB is empty, or just 30 days
        period1.setDate(period1.getDate() - 30);

        try {
          const result = await yahooFinance.chart(ticker, {
            period1,
            period2,
            interval: '1d'
          }) as any;

          const points = (result.quotes || [])
            .filter((q: any) => q.close != null)
            .map((q: any) => ({
              date: new Date(q.date).toISOString().slice(0, 10),
              price: Number(q.close.toFixed(2)),
              open: q.open != null ? Number(q.open.toFixed(2)) : undefined,
              high: q.high != null ? Number(q.high.toFixed(2)) : undefined,
              low: q.low != null ? Number(q.low.toFixed(2)) : undefined,
              volume: q.volume
            }));

          if (points.length > 0) {
            savePriceHistory(ticker, points);
          }
        } catch (fetchErr) {
          console.error("Yahoo chart fetch failed:", fetchErr);
          // If fetch fails, we'll just fall back to whatever is in the DB
        }
      }

      // Read fresh from DB to ensure we have the combined data
      const updatedHistory = getPriceHistory(ticker) as any[];
      
      // Filter to just the last 30 days for the UI
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const cutoffDate = thirtyDaysAgo.toISOString().slice(0, 10);
      
      const recentPoints = updatedHistory
        .filter(p => p.date >= cutoffDate)
        .map(p => ({
          date: p.date,
          price: p.close
        }));

      if (recentPoints.length === 0) {
        return res.status(404).json({ error: 'No historical data available' });
      }

      res.json({ data: recentPoints });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'History fetch failed' });
    }
  });

  app.post('/api/score-snapshot', (req, res) => {
    try {
      const { ticker, nexusScore, factorScores, regime } = req.body;
      if (!ticker || nexusScore === undefined) {
        return res.status(400).json({ error: 'Ticker and nexusScore are required' });
      }
      
      const date = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      saveAlphaScore(ticker, date, nexusScore, factorScores || {}, regime || 'Neutral');
      
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Score snapshot failed' });
    }
  });

  // --- BACKTESTING ENDPOINT ---
  app.get('/api/backtest', (req, res) => {
    try {
      const history = getAlphaScoreHistory();
      
      const forwardReturns = history.map(snapshot => {
        const prices = getPriceHistory(snapshot.ticker) as { date: string, close: number }[];
        const startDateIdx = prices.findIndex(p => p.date >= snapshot.date);
        let return30 = null;
        let return90 = null;

        if (startDateIdx !== -1) {
          const startPrice = prices[startDateIdx].close;
          const end30Idx = startDateIdx + 21;
          if (end30Idx < prices.length) {
            return30 = (prices[end30Idx].close - startPrice) / startPrice;
          }
          const end90Idx = startDateIdx + 63;
          if (end90Idx < prices.length) {
            return90 = (prices[end90Idx].close - startPrice) / startPrice;
          }
        }

        return { ...snapshot, return30, return90 };
      });

      // Phase 9: Top-10 vs Nifty portfolio reconstruction
      const dateMap = new Map<string, typeof history>();
      for (const snap of history) {
        const arr = dateMap.get(snap.date) || [];
        arr.push(snap);
        dateMap.set(snap.date, arr);
      }

      const niftyPrices = getPriceHistory('^NSEI') as { date: string, close: number }[];
      const niftyMap = new Map(niftyPrices.map(p => [p.date, p.close]));

      const sortedDates = Array.from(dateMap.keys()).sort();
      const portfolioReturns: number[] = [];
      const benchmarkReturns: number[] = [];
      let wins = 0;
      let total = 0;

      for (let i = 0; i < sortedDates.length - 1; i++) {
        const date = sortedDates[i];
        const nextDate = sortedDates[i + 1];
        const snaps = dateMap.get(date)!;
        // Top 10 by nexus_score
        const top10 = [...snaps].sort((a, b) => b.nexus_score - a.nexus_score).slice(0, 10);

        let portReturn = 0;
        let validCount = 0;
        for (const t of top10) {
          const prices = getPriceHistory(t.ticker) as { date: string, close: number }[];
          const p0 = prices.find(p => p.date >= date);
          const p1 = prices.find(p => p.date >= nextDate);
          if (p0 && p1 && p0.close > 0) {
            portReturn += (p1.close - p0.close) / p0.close;
            validCount++;
          }
        }
        if (validCount === 0) continue;
        portReturn /= validCount; // equal-weight

        const n0 = niftyMap.get(date) || niftyMap.get(sortedDates.find(d => d >= date && niftyMap.has(d)) || '');
        const n1 = niftyMap.get(nextDate) || niftyMap.get(sortedDates.find(d => d >= nextDate && niftyMap.has(d)) || '');
        let benchReturn = 0;
        if (n0 && n1 && n0 > 0) benchReturn = (n1 - n0) / n0;

        portfolioReturns.push(portReturn);
        benchmarkReturns.push(benchReturn);
        if (portReturn > benchReturn) wins++;
        total++;
      }

      // Aggregate metrics
      const cumPort = portfolioReturns.reduce((acc, r) => acc * (1 + r), 1);
      const cumBench = benchmarkReturns.reduce((acc, r) => acc * (1 + r), 1);
      const periods = portfolioReturns.length || 1;
      const avgPort = portfolioReturns.reduce((a, b) => a + b, 0) / periods;
      const stdPort = Math.sqrt(portfolioReturns.reduce((a, r) => a + (r - avgPort) ** 2, 0) / periods);
      const sharpe = stdPort > 0 ? (avgPort / stdPort) * Math.sqrt(252) : 0; // annualized

      // Max drawdown of cumulative equity curve
      let peak = 1;
      let maxDd = 0;
      let equity = 1;
      for (const r of portfolioReturns) {
        equity *= (1 + r);
        if (equity > peak) peak = equity;
        const dd = (equity - peak) / peak;
        if (dd < maxDd) maxDd = dd;
      }

      const topNMetrics = {
        // FIXME: Dividing by 252 assumes periods ≈ trading days. Since periods are actually 
        // rebalance snapshots (app opens), sparse usage could distort this annualized CAGR.
        // Revisit this logic once more historical snapshot data accumulates.
        cagr: periods > 0 ? (Math.pow(cumPort, 1 / Math.max(periods / 252, 0.01)) - 1) * 100 : 0,
        benchCagr: periods > 0 ? (Math.pow(cumBench, 1 / Math.max(periods / 252, 0.01)) - 1) * 100 : 0,
        sharpe: Number(sharpe.toFixed(2)),
        maxDrawdown: Number((maxDd * 100).toFixed(2)),
        winRate: total > 0 ? Number(((wins / total) * 100).toFixed(1)) : 0,
        periods: total,
        dateRange: sortedDates.length > 0 ? { from: sortedDates[0], to: sortedDates[sortedDates.length - 1] } : null
      };

      res.json({ data: forwardReturns, topNMetrics });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch backtest data' });
    }
  });

  // --- PORTFOLIO OPTIMIZE ENDPOINT ---
  app.post('/api/portfolio/optimize', (req, res) => {
    try {
      const { method } = req.body as { method: OptimizationMethod };
      if (!method) {
        return res.status(400).json({ error: 'Method is required' });
      }

      const holdings = getHoldings();
      const holdingsData = holdings.map(h => {
        const priceHistory = getPriceHistory(h.ticker) as { date: string, close: number }[];
        return {
          ticker: h.ticker,
          priceHistory
        };
      });

      const weights = optimizePortfolio(holdingsData, method);
      res.json({ weights });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Optimization failed' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
