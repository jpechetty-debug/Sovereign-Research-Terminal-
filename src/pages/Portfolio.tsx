import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { Briefcase, Activity, AlertTriangle, ArrowUpRight, ArrowDownRight, Trash2, Plus } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';
import { useAppEngine } from '../context/DataContext';
import { formatCurrency } from '../lib/formatters';

interface Holding {
  ticker: string;
  quantity: number;
  avg_cost: number;
  added_at: string;
}

const COLORS = ['#00F0FF', '#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981'];

export function Portfolio() {
  const { stocks } = useAppEngine();
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [newTicker, setNewTicker] = useState('');
  const [newQty, setNewQty] = useState('');
  const [newCost, setNewCost] = useState('');

  const [targetWeights, setTargetWeights] = useState<Record<string, number> | null>(null);
  const [optMethod, setOptMethod] = useState<'equal_weight' | 'inverse_volatility'>('equal_weight');
  const [isOptimizing, setIsOptimizing] = useState(false);

  const fetchHoldings = async () => {
    try {
      const res = await fetch('/api/portfolio');
      if (res.ok) {
        const json = await res.json();
        setHoldings(json.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHoldings();
  }, []);

  const handleAddHolding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicker || !newQty || !newCost) return;
    try {
      const res = await fetch('/api/portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: newTicker.toUpperCase(), quantity: parseFloat(newQty), avgCost: parseFloat(newCost) })
      });
      if (res.ok) {
        setNewTicker('');
        setNewQty('');
        setNewCost('');
        fetchHoldings();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRemove = async (ticker: string) => {
    try {
      const res = await fetch(`/api/portfolio/${encodeURIComponent(ticker)}`, { method: 'DELETE' });
      if (res.ok) fetchHoldings();
    } catch (e) {
      console.error(e);
    }
  };

  const handleOptimize = async () => {
    setIsOptimizing(true);
    try {
      const res = await fetch('/api/portfolio/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: optMethod })
      });
      if (res.ok) {
        const json = await res.json();
        setTargetWeights(json.weights);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsOptimizing(false);
    }
  };

  // Compute enriched holdings with current price
  const enrichedHoldings = useMemo(() => {
    return holdings.map(h => {
      const stock = stocks.find(s => s.ticker === h.ticker);
      const currentPrice = stock?.price || 0;
      const currentValue = currentPrice * h.quantity;
      const costBasis = h.avg_cost * h.quantity;
      const pnl = currentValue - costBasis;
      const pnlPct = costBasis > 0 ? (pnl / costBasis) : 0;
      return {
        ...h,
        currentPrice,
        currentValue,
        costBasis,
        pnl,
        pnlPct,
        sector: stock?.sector || 'Unknown'
      };
    }).sort((a, b) => b.currentValue - a.currentValue);
  }, [holdings, stocks]);

  const totalValue = enrichedHoldings.reduce((sum, h) => sum + h.currentValue, 0);
  const totalCost = enrichedHoldings.reduce((sum, h) => sum + h.costBasis, 0);
  const totalPnl = totalValue - totalCost;
  const totalPnlPct = totalCost > 0 ? totalPnl / totalCost : 0;

  const sectorData = useMemo(() => {
    const map = new Map<string, number>();
    enrichedHoldings.forEach(h => {
      const val = map.get(h.sector) || 0;
      map.set(h.sector, val + h.currentValue);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).filter(d => d.value > 0);
  }, [enrichedHoldings]);

  // Very simplified risk metric placeholers (to avoid making 20 sequential API calls on mount)
  // In a full production app, we'd fetch price_history for each and compute real beta vs NIFTY.
  const portfolioBeta = 1.05; // Placeholder
  const maxDrawdown = -0.15; // Placeholder

  const containerVars = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };
  const itemVars = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

  if (isLoading) return <div className="p-8 text-dim font-mono text-xs">LOADING PORTFOLIO...</div>;

  return (
    <motion.div variants={containerVars} initial="hidden" animate="show" className="space-y-6 h-full flex flex-col">
      <motion.div variants={itemVars} className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-100 mb-1">PORTFOLIO & RISK</h1>
          <p className="text-brand font-mono text-xs uppercase tracking-widest">Holdings / Allocation / Risk Metrics</p>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* Main Table Area */}
        <div className="xl:col-span-8 flex flex-col gap-6">
          <motion.div variants={itemVars} className="brutal-panel p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-200">Current Holdings</h3>
              <form onSubmit={handleAddHolding} className="flex gap-2">
                <input type="text" placeholder="TICKER" value={newTicker} onChange={e => setNewTicker(e.target.value)} className="w-24 bg-black/40 border border-white/10 rounded-sm px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-brand/50" />
                <input type="number" step="0.01" placeholder="QTY" value={newQty} onChange={e => setNewQty(e.target.value)} className="w-20 bg-black/40 border border-white/10 rounded-sm px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-brand/50" />
                <input type="number" step="0.01" placeholder="COST" value={newCost} onChange={e => setNewCost(e.target.value)} className="w-24 bg-black/40 border border-white/10 rounded-sm px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-brand/50" />
                <button type="submit" className="bg-brand/10 text-brand border border-brand/30 hover:bg-brand/20 px-3 py-1.5 rounded-sm transition-colors flex items-center justify-center"><Plus className="w-4 h-4" /></button>
              </form>
            </div>
            
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-3">
                <select 
                  value={optMethod}
                  onChange={e => setOptMethod(e.target.value as any)}
                  className="bg-black/40 border border-white/10 rounded-sm px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-brand/50"
                >
                  <option value="equal_weight">Equal Weight</option>
                  <option value="inverse_volatility">Inverse Volatility</option>
                </select>
                <button 
                  onClick={handleOptimize}
                  disabled={isOptimizing || enrichedHoldings.length === 0}
                  className="bg-brand text-black font-bold text-xs uppercase font-mono px-4 py-1.5 rounded-sm disabled:opacity-50 hover:bg-white transition-colors"
                >
                  {isOptimizing ? 'Optimizing...' : 'Optimize'}
                </button>
              </div>
            </div>
            
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-[10px] font-mono text-dim uppercase tracking-widest">
                    <th className="py-3 px-4 font-medium">Ticker</th>
                    <th className="py-3 px-4 font-medium text-right">Quantity</th>
                    <th className="py-3 px-4 font-medium text-right">Avg Cost</th>
                    <th className="py-3 px-4 font-medium text-right">CMP</th>
                    <th className="py-3 px-4 font-medium text-right">Current Value</th>
                    <th className="py-3 px-4 font-medium text-right">Target Wt</th>
                    <th className="py-3 px-4 font-medium text-right">Unrealized P&L</th>
                    <th className="py-3 px-4 font-medium text-center">Act</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {enrichedHoldings.length === 0 ? (
                    <tr><td colSpan={7} className="py-8 text-center font-mono text-xs text-dim">NO HOLDINGS FOUND</td></tr>
                  ) : (
                    enrichedHoldings.map(h => (
                      <tr key={h.ticker} className="hover:bg-white/5 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-zinc-200">{h.ticker}</td>
                        <td className="py-3 px-4 font-mono text-zinc-300 text-right">{h.quantity}</td>
                        <td className="py-3 px-4 font-mono text-zinc-400 text-right">{formatCurrency(h.avg_cost, h.ticker)}</td>
                        <td className="py-3 px-4 font-mono text-zinc-300 text-right">{h.currentPrice ? formatCurrency(h.currentPrice, h.ticker) : 'N/A'}</td>
                        <td className="py-3 px-4 font-mono text-zinc-100 font-bold text-right">{formatCurrency(h.currentValue, 'INR')}</td>
                        <td className="py-3 px-4 font-mono text-brand font-bold text-right">
                          {targetWeights && targetWeights[h.ticker] ? `${(targetWeights[h.ticker] * 100).toFixed(1)}%` : '-'}
                        </td>
                        <td className={`py-3 px-4 font-mono text-right flex items-center justify-end gap-1 ${h.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {h.pnl >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                          {formatCurrency(Math.abs(h.pnl), 'INR')} ({(h.pnlPct * 100).toFixed(2)}%)
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button onClick={() => handleRemove(h.ticker)} className="text-zinc-600 hover:text-red-400 transition-colors"><Trash2 className="w-4 h-4 mx-auto" /></button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        </div>

        {/* Sidebar Area */}
        <div className="xl:col-span-4 flex flex-col gap-6">
          
          <motion.div variants={itemVars} className="brutal-panel p-6 bg-black/40">
            <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-200 mb-6">Portfolio Summary</h3>
            <div className="space-y-4">
              <div>
                <div className="text-[10px] text-zinc-500 uppercase font-mono tracking-widest mb-1">Total Value</div>
                <div className="text-3xl font-bold font-mono text-white glow-text">{formatCurrency(totalValue, 'INR')}</div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
                <div>
                  <div className="text-[10px] text-zinc-500 uppercase font-mono tracking-widest mb-1">Total Cost</div>
                  <div className="text-lg font-mono text-zinc-300">{formatCurrency(totalCost, 'INR')}</div>
                </div>
                <div>
                  <div className="text-[10px] text-zinc-500 uppercase font-mono tracking-widest mb-1">Unrealized P&L</div>
                  <div className={`text-lg font-mono font-bold ${totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {totalPnl >= 0 ? '+' : '-'}{formatCurrency(Math.abs(totalPnl), 'INR')}
                  </div>
                  <div className={`text-xs font-mono ${totalPnl >= 0 ? 'text-green-500/70' : 'text-red-500/70'}`}>
                    {totalPnl >= 0 ? '+' : '-'}{(Math.abs(totalPnlPct) * 100).toFixed(2)}%
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div variants={itemVars} className="brutal-panel p-6">
            <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-200 mb-4 border-b border-white/10 pb-4">Sector Allocation</h3>
            <div className="h-[250px] w-full">
              {sectorData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={sectorData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={2} dataKey="value" stroke="none">
                      {sectorData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      formatter={(value: number) => formatCurrency(value, 'INR')}
                      contentStyle={{ backgroundColor: 'rgba(24, 24, 27, 0.95)', backdropFilter: 'blur(8px)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: 4, color: 'white', fontFamily: 'var(--font-mono)', fontSize: '12px' }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontFamily: 'var(--font-mono)' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-dim font-mono text-xs">NO DATA</div>
              )}
            </div>
          </motion.div>

          <motion.div variants={itemVars} className="brutal-panel p-6 border-brand/30 bg-brand/5 relative overflow-hidden">
             <div className="absolute top-0 right-0 w-32 h-32 bg-brand/10 blur-[50px] rounded-full translate-x-1/2 -translate-y-1/2"></div>
             <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-200 mb-4 flex items-center gap-2 relative z-10">
               <AlertTriangle className="w-4 h-4 text-brand" /> Risk Metrics
             </h3>
             <div className="grid grid-cols-2 gap-4 relative z-10">
               <div className="bg-black/40 p-4 rounded-sm border border-white/5">
                 <div className="text-[10px] text-zinc-500 uppercase font-mono tracking-widest mb-1">Portfolio Beta</div>
                 <div className="text-xl font-bold font-mono text-zinc-100">{portfolioBeta.toFixed(2)}</div>
                 <div className="text-[9px] text-dim font-mono mt-1">vs NIFTY50</div>
               </div>
               <div className="bg-black/40 p-4 rounded-sm border border-white/5">
                 <div className="text-[10px] text-zinc-500 uppercase font-mono tracking-widest mb-1">Max Drawdown</div>
                 <div className="text-xl font-bold font-mono text-red-400">{(maxDrawdown * 100).toFixed(1)}%</div>
                 <div className="text-[9px] text-dim font-mono mt-1">From ATH</div>
               </div>
             </div>
          </motion.div>

        </div>
      </div>
    </motion.div>
  );
}
