import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import YahooFinance from 'yahoo-finance2';
import { initDB, getUniverse, addTicker, removeTicker, getFundamentalsCache, saveFundamentalsCache } from './src/db';
import { calculatePiotroskiFScore, type AnnualFundamentalPeriod } from './src/lib/piotroski';

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
        salesGrowth: (fd.revenueGrowth || 0) * 100,
        epsGrowth: (fd.earningsGrowth || 0) * 100,
        roe: (fd.returnOnEquity || 0) * 100,
        cfoPat, // real CFO/net-income ratio, or null if statement data unavailable
        fScore, // real 0-9 Piotroski F-Score (rescaled if some tests were ungradable), or null
        fScoreDetail, // full breakdown (criteria pass/fail + dataQuality) for the UI
        debtEquity: fd.debtToEquity ? fd.debtToEquity / 100 : 0.5,
        peRatio: sd.trailingPE || dks.forwardPE || 15,
        fiftyTwoWeekChange: (dks['52WeekChange'] || 0) * 100,
        fiftyDayAverage: sd.fiftyDayAverage || 0,
        twoHundredDayAverage: sd.twoHundredDayAverage || 0
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

        return {
          ticker: q.symbol,
          price: q.regularMarketPrice,
          change: q.regularMarketChangePercent,
          marketCap: q.marketCap,
          volume: q.regularMarketVolume,
          fundamentals: cachedFund?.data || null
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
      const period2 = new Date();
      const period1 = new Date();
      period1.setDate(period1.getDate() - 30);

      const result = await yahooFinance.chart(ticker, {
        period1,
        period2,
        interval: '1d'
      }) as any;

      const points = (result.quotes || [])
        .filter((q: any) => q.close != null)
        .map((q: any) => ({
          date: new Date(q.date).toISOString().slice(0, 10),
          price: Number(q.close.toFixed(2))
        }));

      if (points.length === 0) {
        return res.status(404).json({ error: 'No historical data available' });
      }

      res.json({ data: points });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'History fetch failed' });
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
