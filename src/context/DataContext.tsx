import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { calculateNexusMatrix, deriveRegime } from '../lib/nexusAlphaEngine';
import { MOCK_STOCKS } from '../data/mockData';

type StockData = typeof MOCK_STOCKS[0];

export interface PriceAlert {
  id: string;
  ticker: string;
  targetPrice: number;
  direction: 'above' | 'below';
  isTriggered: boolean;
  createdAt: Date;
}

export interface VixData {
  price: number;
  change: number;
}

interface DataContextType {
  stocks: StockData[];
  isScanning: boolean;
  lastScanned: Date | null;
  refreshUniverse: () => Promise<void>;
  runRealtimeScan: () => Promise<void>;
  isLiveEngineActive: boolean;
  toggleLiveEngine: () => void;
  alerts: PriceAlert[];
  addAlert: (ticker: string, targetPrice: number, direction: 'above' | 'below') => void;
  removeAlert: (id: string) => void;
  dismissTriggeredAlert: (id: string) => void;
  vix: VixData | null;
  // Real market breadth: % of the current universe trading up on the day.
  marketBreadthPct: number | null;
  marketRegime: 'Bull' | 'Bear' | 'Choppy' | 'Unknown';
}

const DataContext = createContext<DataContextType | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [stocks, setStocks] = useState<StockData[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [lastScanned, setLastScanned] = useState<Date | null>(null);
  const [isLiveEngineActive, setIsLiveEngineActive] = useState(false);
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [vix, setVix] = useState<VixData | null>(null);
  const [marketBreadthPct, setMarketBreadthPct] = useState<number | null>(null);
  
  const hasScanned = useRef(false);
  const stocksRef = useRef(stocks);
  const alertsRef = useRef(alerts);

  // Sync state to ref for background polling
  useEffect(() => {
    stocksRef.current = stocks;
  }, [stocks]);

  useEffect(() => {
    alertsRef.current = alerts;
  }, [alerts]);

  const addAlert = useCallback((ticker: string, targetPrice: number, direction: 'above' | 'below') => {
    setAlerts(prev => [...prev, {
      id: Math.random().toString(36).substr(2, 9),
      ticker,
      targetPrice,
      direction,
      isTriggered: false,
      createdAt: new Date()
    }]);
  }, []);

  const removeAlert = useCallback((id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  }, []);

  const dismissTriggeredAlert = useCallback((id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id)); // For simplicity, just remove it on dismiss
  }, []);

  const refreshUniverse = useCallback(async () => {
    try {
      const res = await fetch('/api/universe');
      if (res.ok) {
        const { data } = await res.json();
        // Convert to StockData format
        const initializedStocks: StockData[] = data.map((d: any) => ({
          ticker: d.ticker,
          name: d.name,
          sector: d.sector,
          nexusScore: 0,
          price: 0,
          change: 0,
          marketCap: "Unknown",
          regime: "Unknown",
          metrics: { mcapCr: 0, pledge: 0, salesGrowth: 0, epsGrowth: 0, roe: 0, cfoPat: 0, fScore: 0, debtEquity: 0, peRatio: 0 },
          scores: { sales: 0, roe_roce: 0, cfo_pat: 0, valuation: 0, eps: 0, f_score: 0, debt_equity: 0, momentum: 0, sentiment: 0 }
        }));
        setStocks(initializedStocks);
      }
    } catch (err) {
      console.error("Failed to fetch universe", err);
    }
  }, []);

  const runRealtimeScan = useCallback(async () => {
    setIsScanning(true);
    try {
      const currentStocks = stocksRef.current;
      if (currentStocks.length === 0) return;
      
      const currentAlerts = alertsRef.current;
      const tickers = currentStocks.map(s => s.ticker).join(',');
      const res = await fetch(`/api/scan?symbols=${tickers}`);
      if (!res.ok) throw new Error("API FAILED");
      const { data, vix: liveVix } = await res.json();
      
      const newStocks = currentStocks.map(stock => {
        const live = data.find((d: any) => d.ticker === stock.ticker);
        if (live) {
          const formatMcap = (m: number) => {
             const cr = m / 10000000;
             if (cr >= 100000) return (cr / 100000).toFixed(2) + 'L Cr';
             if (cr >= 1000) return (cr / 1000).toFixed(2) + 'k Cr';
             return cr.toFixed(2) + ' Cr';
          };

          // Regime is now derived from real live momentum + fundamentals
          // on every scan, instead of a static value baked into the seed
          // dataset that never changed regardless of actual market action.
          const metrics = live.fundamentals ? { ...stock.metrics, ...live.fundamentals } : stock.metrics;
          const liveRegime = deriveRegime(live.change || 0, metrics);
          const matrix = calculateNexusMatrix(metrics, live.change || 0, liveRegime, stock.sector);

          return {
            ...stock,
            metrics,
            price: live.price,
            change: live.change || 0,
            marketCap: live.marketCap ? formatMcap(live.marketCap) : stock.marketCap,
            regime: liveRegime,
            scores: matrix.scores,
            nexusScore: matrix.nexusScore
          };
        }
        return stock;
      });

      setStocks(newStocks);
      setLastScanned(new Date());
      setVix(liveVix ?? null);

      // Real market breadth: % of the universe with a live-fetched stock
      // trading positive on the day. This replaces the hardcoded
      // "BULL PHASE" label that never reflected actual market conditions.
      const withLiveData = newStocks.filter(s => data.some((d: any) => d.ticker === s.ticker));
      if (withLiveData.length > 0) {
        const upCount = withLiveData.filter(s => s.change > 0).length;
        setMarketBreadthPct(Math.round((upCount / withLiveData.length) * 100));
      }

      // Evaluate alerts
      if (currentAlerts.length > 0) {
        let alertsModified = false;
        const evaluatedAlerts = currentAlerts.map(alert => {
          if (alert.isTriggered) return alert; // already triggered
          
          const liveStock = data.find((d: any) => d.ticker === alert.ticker);
          if (liveStock) {
            const isHit = alert.direction === 'above' 
              ? liveStock.price >= alert.targetPrice 
              : liveStock.price <= alert.targetPrice;
            
            if (isHit) {
              alertsModified = true;
              return { ...alert, isTriggered: true };
            }
          }
          return alert;
        });

        if (alertsModified) {
          setAlerts(evaluatedAlerts);
        }
      }

    } catch (err) {
      console.error("Scan failed", err);
    } finally {
      setIsScanning(false);
    }
  }, []);

  useEffect(() => {
    if (!hasScanned.current) {
      refreshUniverse().then(() => {
        runRealtimeScan();
      });
      hasScanned.current = true;
    }
  }, [runRealtimeScan, refreshUniverse]);

  // Realtime Engine Poll Loop
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLiveEngineActive) {
      interval = setInterval(() => {
        runRealtimeScan();
      }, 5000); // Poll every 5 seconds for live UI flashes
    }
    return () => clearInterval(interval);
  }, [isLiveEngineActive, runRealtimeScan]);

  const toggleLiveEngine = () => setIsLiveEngineActive(prev => !prev);

  const marketRegime: DataContextType['marketRegime'] = marketBreadthPct === null
    ? 'Unknown'
    : marketBreadthPct >= 60 ? 'Bull'
    : marketBreadthPct <= 40 ? 'Bear'
    : 'Choppy';

  return (
    <DataContext.Provider value={{ 
      stocks, isScanning, lastScanned, refreshUniverse, runRealtimeScan, isLiveEngineActive, toggleLiveEngine,
      alerts, addAlert, removeAlert, dismissTriggeredAlert,
      vix, marketBreadthPct, marketRegime
    }}>
      {children}
    </DataContext.Provider>
  );
}

export const useAppEngine = () => {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("Missing DataProvider");
  return ctx;
};
