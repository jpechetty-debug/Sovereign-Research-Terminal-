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
  const row = db.prepare('SELECT data, strftime("%s", updated_at) * 1000 as timestamp FROM fundamentals WHERE ticker = ?').get(ticker) as any;
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
