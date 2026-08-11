import YahooFinance from 'yahoo-finance2';
import { initDB, getUniverse, saveFundamentalsHistory, savePriceHistory } from '../src/db';
import { AnnualFundamentalPeriod } from '../src/lib/piotroski';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

async function backfill() {
  console.log('Initializing DB...');
  initDB();

  const universe = getUniverse();
  console.log(`Starting backfill for ${universe.length} tickers...`);

  for (const { ticker } of universe) {
    console.log(`[${ticker}] Fetching statement history...`);
    
    // Fundamentals
    try {
      const period1 = new Date();
      period1.setFullYear(period1.getFullYear() - 4);
      
      const series = (await yahooFinance.fundamentalsTimeSeries(ticker, {
        period1,
        period2: new Date(),
        type: 'annual',
        module: 'all',
      })) as unknown as AnnualFundamentalPeriod[];
      
      if (series && series.length > 0) {
        saveFundamentalsHistory(ticker, series);
        console.log(`[${ticker}] Saved ${series.length} fundamental periods.`);
      } else {
        console.log(`[${ticker}] No fundamental history found.`);
      }
    } catch (err: any) {
      console.error(`[${ticker}] Failed to fetch fundamentals:`, err?.message);
    }

    // Price History (last 30 days or more)
    console.log(`[${ticker}] Fetching price history...`);
    try {
      const period1 = new Date();
      period1.setDate(period1.getDate() - 90); // Grab last 90 days for backfill
      
      const result = await yahooFinance.chart(ticker, {
        period1,
        period2: new Date(),
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
        console.log(`[${ticker}] Saved ${points.length} price points.`);
      } else {
        console.log(`[${ticker}] No price history found.`);
      }
    } catch (err: any) {
      console.error(`[${ticker}] Failed to fetch price history:`, err?.message);
    }

    // Wait to respect rate limits
    console.log(`[${ticker}] Waiting 1200ms...`);
    await new Promise(r => setTimeout(r, 1200));
  }
  
  console.log('Backfill complete!');
}

backfill().catch(console.error);
