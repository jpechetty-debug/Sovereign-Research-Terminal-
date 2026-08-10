import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useAppEngine } from '../context/DataContext';
import { Search, Filter, ArrowUpDown, RefreshCw, Command, Zap, Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { formatCurrency } from '../lib/formatters';

export function Screener() {
  const navigate = useNavigate();
  const { stocks, isScanning, runRealtimeScan, alerts } = useAppEngine();

  const containerVars = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };
  const itemVars = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0 }
  };

  const [searchQuery, setSearchQuery] = useState('');
  
  const filteredStocks = useMemo(() => {
    if (!searchQuery) return stocks;
    const q = searchQuery.toLowerCase();
    return stocks.filter(s => 
      s.ticker.toLowerCase().includes(q) || 
      s.name.toLowerCase().includes(q) ||
      s.sector.toLowerCase().includes(q)
    );
  }, [stocks, searchQuery]);

  return (
    <motion.div variants={containerVars} initial="hidden" animate="show" className="space-y-6 h-full flex flex-col">
      <motion.div variants={itemVars} className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-100 mb-1">NEXUS SCREENER</h1>
          <p className="text-brand font-mono text-xs uppercase tracking-widest">Institutional Filter Matrix / Query Results</p>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={runRealtimeScan}
            disabled={isScanning}
            className="px-5 py-2.5 bg-black/40 border border-brand/50 text-brand font-mono text-xs font-bold tracking-wider uppercase flex items-center gap-2 hover:bg-brand hover:text-black transition-all disabled:opacity-50 disabled:cursor-not-allowed w-56 justify-center rounded-sm shadow-[0_0_10px_rgba(0,240,255,0.1)]"
          >
            <RefreshCw className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} /> 
            {isScanning ? 'SCANNING API...' : 'FORCE REALTIME SCAN'}
          </button>
        </div>
      </motion.div>

      <motion.div variants={itemVars} className="brutal-panel p-4 flex gap-4 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand/70" />
          <input 
            type="text" 
            placeholder="SEARCH TICKER, NAME, OR SECTOR..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-black/40 border border-white/10 text-brand font-mono text-xs px-10 py-3 rounded-sm focus:outline-none focus:border-brand/50 focus:bg-brand/5 focus:shadow-[0_0_15px_rgba(0,240,255,0.1)] transition-all shadow-inner"
          />
        </div>
      </motion.div>

      <motion.div variants={itemVars} className="flex-1 brutal-panel flex flex-col overflow-hidden rounded-sm">
        <div className="overflow-x-auto flex-1 custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-max">
            <thead className="bg-black/40 backdrop-blur-md sticky top-0 z-10 shadow-md">
              <tr className="text-[10px] font-mono text-dim uppercase tracking-[0.15em] border-b border-white/10">
                <th className="py-4 px-5 font-medium whitespace-nowrap cursor-pointer hover:text-white transition-colors select-none">
                  <div className="flex items-center gap-1.5">Ticker <ArrowUpDown className="w-3 h-3 text-zinc-600"/></div>
                </th>
                <th className="py-4 px-5 font-medium">Company Name</th>
                <th className="py-4 px-5 font-medium">Sector</th>
                <th className="py-4 px-5 font-medium text-right">Market Cap</th>
                <th className="py-4 px-5 font-medium text-right">Close Price</th>
                <th className="py-4 px-5 font-medium text-center cursor-pointer hover:text-white transition-colors">
                  <div className="flex items-center justify-center gap-1.5">Nexus<ArrowUpDown className="w-3 h-3 text-brand"/></div>
                </th>
                <th className="py-4 px-5 font-medium text-center">Quality Gate</th>
                <th className="py-4 px-5 font-medium text-center">F-Score</th>
                <th className="py-4 px-5 font-medium text-right">PE Ratio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {[...filteredStocks].sort((a,b) => b.nexusScore - a.nexusScore).map((stock) => (
                <tr 
                  key={stock.ticker} 
                  className="hover:bg-white/5 transition-colors cursor-pointer group"
                  onClick={() => navigate(`/stock/${stock.ticker}`)}
                >
                  <td className="py-3 px-5 font-mono font-bold text-zinc-200 group-hover:text-brand transition-colors">
                    <div className="flex items-center gap-2">
                      {stock.nexusScore > 80 && <Zap className="w-3 h-3 text-brand" />}
                      {alerts.some(a => a.ticker === stock.ticker && !a.isTriggered) && <Bell className="w-3 h-3 text-zinc-400" />}
                      {stock.ticker}
                    </div>
                  </td>
                  <td className="py-3 px-5 text-sm font-medium text-zinc-300 truncate max-w-[200px]">{stock.name}</td>
                  <td className="py-3 px-5 text-dim text-xs">{stock.sector}</td>
                  <td className="py-3 px-5 text-right font-mono tabular-data text-xs text-zinc-400">{stock.marketCap}</td>
                  <td className="py-3 px-5 text-right font-mono tabular-data text-sm">{formatCurrency(stock.price, stock.ticker)}</td>
                  <td className="py-3 px-5 text-center font-mono font-bold text-xs tabular-data text-brand glow-text">{stock.nexusScore.toFixed(1)}</td>
                  <td className="py-3 px-5 text-center">
                    {stock.metrics.fScore == null ? (
                      <span className="px-2 py-1 bg-white/5 border border-white/10 text-dim text-[9px] uppercase font-mono tracking-widest rounded-sm">N/A</span>
                    ) : (stock.metrics.fScore >= 5 && (stock.metrics.debtEquity < 1.5 || stock.sector.includes('Financial') || stock.sector.includes('Bank') || stock.sector.includes('NBFC'))) ? (
                      <span className="px-2 py-1 bg-green-500/10 border border-green-500/30 text-green-400 text-[9px] uppercase font-mono tracking-widest rounded-sm">PASS</span>
                    ) : (
                      <span className="px-2 py-1 bg-red-500/10 border border-red-500/30 text-red-400 text-[9px] uppercase font-mono tracking-widest rounded-sm">FAIL</span>
                    )}
                  </td>
                  <td className="py-3 px-5 text-center font-mono text-xs tabular-data text-zinc-300">
                    {stock.metrics.fScore == null ? '—' : Number.isInteger(stock.metrics.fScore) ? stock.metrics.fScore : stock.metrics.fScore.toFixed(1)}
                  </td>
                  <td className="py-3 px-5 text-right font-mono text-xs tabular-data text-zinc-400">{(stock.metrics.peRatio).toFixed(1)}x</td>
                </tr>
              ))}
              {/* Filler rows to maintain height visual */}
              {Array.from({length: 10}).map((_, i) => (
                 <tr key={`filler-${i}`} className="opacity-[0.15]">
                  <td className="py-3 px-5 font-mono font-bold">---</td>
                  <td className="py-3 px-5 text-sm">Loading datablock null...</td>
                  <td className="py-3 px-5 text-dim text-xs">---</td>
                  <td className="py-3 px-5 text-right font-mono text-xs">---</td>
                  <td className="py-3 px-5 text-right font-mono text-xs">---</td>
                  <td className="py-3 px-5 text-center font-mono font-bold text-xs">---</td>
                  <td className="py-3 px-5 text-center">---</td>
                  <td className="py-3 px-5 text-center font-mono text-xs">---</td>
                  <td className="py-3 px-5 text-right font-mono text-xs">---</td>
                 </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </motion.div>
  );
}
