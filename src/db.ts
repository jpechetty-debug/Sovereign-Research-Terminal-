import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { MOCK_STOCKS } from './data/mockData';

const dbPath = path.join(process.cwd(), 'local_data.db');
const db = new Database(dbPath);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// Initialize tables
export function initDB() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS universe (
      ticker TEXT PRIMARY KEY,
      name TEXT,
      sector TEXT,
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS fundamentals (
      ticker TEXT PRIMARY KEY,
      data TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS fundamentals_history (
      ticker TEXT NOT NULL,
      period_end DATE NOT NULL,
      period_type TEXT NOT NULL,
      revenue REAL, net_income REAL, operating_cash_flow REAL,
      total_assets REAL, total_liabilities REAL,
      current_assets REAL, current_liabilities REAL,
      gross_profit REAL, shares_outstanding REAL,
      raw_json TEXT,
      PRIMARY KEY (ticker, period_end, period_type)
    );

    CREATE TABLE IF NOT EXISTS price_history (
      ticker TEXT NOT NULL, 
      date DATE NOT NULL,
      open REAL, high REAL, low REAL, close REAL, volume INTEGER,
      PRIMARY KEY (ticker, date)
    );

    CREATE TABLE IF NOT EXISTS alpha_score_history (
      ticker TEXT NOT NULL, 
      date DATE NOT NULL,
      nexus_score REAL, factor_scores TEXT, regime TEXT,
      PRIMARY KEY (ticker, date)
    );

    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticker TEXT NOT NULL,
      body TEXT NOT NULL,
      tag TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS portfolio_holdings (
      ticker TEXT PRIMARY KEY,
      quantity REAL NOT NULL,
      avg_cost REAL NOT NULL,
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ai_memos (
      ticker TEXT NOT NULL,
      generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      memo_json TEXT NOT NULL,
      PRIMARY KEY (ticker, generated_at)
    );
  `);

  const count = db.prepare('SELECT count(*) as c FROM universe').get() as { c: number };
  if (count.c === 0) {
    console.log("Seeding database with initial universe...");
    const insert = db.prepare('INSERT INTO universe (ticker, name, sector) VALUES (?, ?, ?)');
    const insertMany = db.transaction((stocks: typeof MOCK_STOCKS) => {
      for (const stock of stocks) {
        insert.run(stock.ticker, stock.name, stock.sector);
      }
    });
    insertMany(MOCK_STOCKS);
  }
}

export function getUniverse() {
  return db.prepare('SELECT ticker, name, sector FROM universe').all() as { ticker: string, name: string, sector: string }[];
}

export function addTicker(ticker: string, name: string, sector: string) {
  try {
    const insert = db.prepare('INSERT INTO universe (ticker, name, sector) VALUES (?, ?, ?)');
    insert.run(ticker, name, sector);
    return true;
  } catch (err) {
    console.error("Error adding ticker", err);
    return false;
  }
}

export function removeTicker(ticker: string) {
  try {
    const remove = db.prepare('DELETE FROM universe WHERE ticker = ?');
    remove.run(ticker);
    
    const removeFundamentals = db.prepare('DELETE FROM fundamentals WHERE ticker = ?');
    removeFundamentals.run(ticker);
    return true;
  } catch (err) {
    console.error("Error removing ticker", err);
    return false;
  }
}

export function getFundamentalsCache(ticker: string): { data: any, timestamp: number } | null {
  const row = db.prepare("SELECT data, strftime('%s', updated_at) * 1000 as timestamp FROM fundamentals WHERE ticker = ?").get(ticker) as any;
  if (!row) return null;
  return { data: JSON.parse(row.data), timestamp: row.timestamp };
}

export function saveFundamentalsCache(ticker: string, data: any) {
  const stmt = db.prepare(`
    INSERT INTO fundamentals (ticker, data, updated_at) 
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(ticker) DO UPDATE SET 
      data=excluded.data, 
      updated_at=CURRENT_TIMESTAMP
  `);
  stmt.run(ticker, JSON.stringify(data));
}

export function saveFundamentalsHistory(ticker: string, seriesData: any[]) {
  const stmt = db.prepare(`
    INSERT INTO fundamentals_history (
      ticker, period_end, period_type, revenue, net_income, operating_cash_flow,
      total_assets, total_liabilities, current_assets, current_liabilities,
      gross_profit, shares_outstanding, raw_json
    ) VALUES (
      @ticker, @period_end, @period_type, @revenue, @net_income, @operating_cash_flow,
      @total_assets, @total_liabilities, @current_assets, @current_liabilities,
      @gross_profit, @shares_outstanding, @raw_json
    )
    ON CONFLICT(ticker, period_end, period_type) DO UPDATE SET
      revenue=excluded.revenue, net_income=excluded.net_income, operating_cash_flow=excluded.operating_cash_flow,
      total_assets=excluded.total_assets, total_liabilities=excluded.total_liabilities,
      current_assets=excluded.current_assets, current_liabilities=excluded.current_liabilities,
      gross_profit=excluded.gross_profit, shares_outstanding=excluded.shares_outstanding,
      raw_json=excluded.raw_json
  `);
  
  const insertMany = db.transaction((items: any[]) => {
    for (const item of items) {
      stmt.run(item);
    }
  });
  
  insertMany(seriesData.map(s => ({
    ticker,
    period_end: new Date(s.date as any).toISOString().slice(0, 10),
    period_type: 'annual', // assuming 'annual' since we fetch type: 'annual'
    revenue: s.totalRevenue || null,
    net_income: s.netIncome || null,
    operating_cash_flow: s.operatingCashFlow || null,
    total_assets: s.totalAssets || null,
    total_liabilities: s.totalLiabilitiesNetMinorityInterest || null,
    current_assets: s.currentAssets || null,
    current_liabilities: s.currentLiabilities || null,
    gross_profit: s.grossProfit || null,
    shares_outstanding: s.shareIssued || null,
    raw_json: JSON.stringify(s)
  })));
}

export function savePriceHistory(ticker: string, pointsData: { date: string, price: number, open?: number, high?: number, low?: number, volume?: number }[]) {
  const stmt = db.prepare(`
    INSERT INTO price_history (ticker, date, open, high, low, close, volume)
    VALUES (@ticker, @date, @open, @high, @low, @close, @volume)
    ON CONFLICT(ticker, date) DO UPDATE SET
      open=excluded.open, high=excluded.high, low=excluded.low, close=excluded.close, volume=excluded.volume
  `);
  
  const insertMany = db.transaction((items: any[]) => {
    for (const item of items) {
      stmt.run(item);
    }
  });
  
  insertMany(pointsData.map(p => ({
    ticker,
    date: p.date,
    open: p.open || null,
    high: p.high || null,
    low: p.low || null,
    close: p.price,
    volume: p.volume || null
  })));
}

export function getPriceHistory(ticker: string) {
  return db.prepare('SELECT date, open, high, low, close, volume FROM price_history WHERE ticker = ? ORDER BY date ASC').all(ticker);
}

export function getLatestPriceHistory(ticker: string, limit: number = 250) {
  return db.prepare('SELECT date, open, high, low, close, volume FROM price_history WHERE ticker = ? ORDER BY date DESC LIMIT ?').all(ticker, limit);
}

export function getFundamentalsHistory(ticker: string) {
  return db.prepare('SELECT period_end, period_type, revenue, net_income, operating_cash_flow, total_assets, total_liabilities, current_assets, current_liabilities, gross_profit, shares_outstanding FROM fundamentals_history WHERE ticker = ? ORDER BY period_end ASC').all(ticker);
}

export function saveAlphaScore(ticker: string, date: string, nexusScore: number, factorScores: any, regime: string) {
  const stmt = db.prepare(`
    INSERT INTO alpha_score_history (ticker, date, nexus_score, factor_scores, regime)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(ticker, date) DO UPDATE SET
      nexus_score=excluded.nexus_score, factor_scores=excluded.factor_scores, regime=excluded.regime
  `);
  stmt.run(ticker, date, nexusScore, JSON.stringify(factorScores), regime);
}

export function getNotes(ticker: string) {
  return db.prepare('SELECT id, ticker, body, tag, created_at FROM notes WHERE ticker = ? ORDER BY created_at DESC').all(ticker);
}

export function addNote(ticker: string, body: string, tag: string) {
  try {
    const insert = db.prepare('INSERT INTO notes (ticker, body, tag) VALUES (?, ?, ?)');
    const info = insert.run(ticker, body, tag);
    return { id: info.lastInsertRowid };
  } catch (err) {
    console.error("Error adding note", err);
    return null;
  }
}

export function deleteNote(id: number | string) {
  try {
    const remove = db.prepare('DELETE FROM notes WHERE id = ?');
    remove.run(id);
    return true;
  } catch (err) {
    console.error("Error removing note", err);
    return false;
  }
}

// --- PORTFOLIO ---

export function getHoldings() {
  return db.prepare('SELECT ticker, quantity, avg_cost, added_at FROM portfolio_holdings').all() as any[];
}

export function addHolding(ticker: string, quantity: number, avg_cost: number) {
  try {
    const stmt = db.prepare('INSERT OR REPLACE INTO portfolio_holdings (ticker, quantity, avg_cost) VALUES (?, ?, ?)');
    stmt.run(ticker, quantity, avg_cost);
    return true;
  } catch (err) {
    console.error("Error adding holding:", err);
    return false;
  }
}

export function removeHolding(ticker: string) {
  try {
    const stmt = db.prepare('DELETE FROM portfolio_holdings WHERE ticker = ?');
    stmt.run(ticker);
    return true;
  } catch (err) {
    console.error("Error removing holding:", err);
    return false;
  }
}

// --- AI MEMOS ---

export function getLatestAiMemo(ticker: string) {
  return db.prepare('SELECT memo_json, generated_at FROM ai_memos WHERE ticker = ? ORDER BY generated_at DESC LIMIT 1').get(ticker) as any | undefined;
}

export function saveAiMemo(ticker: string, memoJson: string) {
  try {
    const stmt = db.prepare('INSERT INTO ai_memos (ticker, memo_json) VALUES (?, ?)');
    stmt.run(ticker, memoJson);
    return true;
  } catch (err) {
    console.error("Error saving AI memo:", err);
    return false;
  }
}

// --- BACKTESTING ---

export function getAlphaScoreHistory() {
  return db.prepare('SELECT ticker, date, nexus_score, factor_scores, regime FROM alpha_score_history ORDER BY date ASC').all() as any[];
}
