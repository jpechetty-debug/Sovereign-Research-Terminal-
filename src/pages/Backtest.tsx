import React, { useState, useEffect, useMemo } from 'react';
import { Layers, Activity, AlertTriangle, TrendingUp, Shield, Target, Trophy } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { motion } from 'motion/react';

interface BacktestSnapshot {
  ticker: string;
  date: string;
  nexus_score: number;
  return30: number | null;
  return90: number | null;
}

interface TopNMetrics {
  cagr: number;
  benchCagr: number;
  sharpe: number;
  maxDrawdown: number;
  winRate: number;
  periods: number;
  dateRange: { from: string; to: string } | null;
}

export function Backtest() {
  const [data, setData] = useState<BacktestSnapshot[]>([]);
  const [topNMetrics, setTopNMetrics] = useState<TopNMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/backtest')
      .then(r => r.json())
      .then(d => {
        if (d.data) setData(d.data);
        if (d.topNMetrics) setTopNMetrics(d.topNMetrics);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const decileData = useMemo(() => {
    if (data.length === 0) return [];
    const snapshotsWith30 = data.filter(d => d.return30 !== null);
    const sorted = [...snapshotsWith30].sort((a, b) => a.nexus_score - b.nexus_score);
    const deciles: { decile: string, return30: number, return90: number, count: number }[] = [];
    const decileSize = Math.max(1, Math.floor(sorted.length / 10));

    for (let i = 0; i < 10; i++) {
      const start = i * decileSize;
      const end = i === 9 ? sorted.length : (i + 1) * decileSize;
      const slice = sorted.slice(start, end);
      const avg30 = slice.reduce((sum, s) => sum + (s.return30 || 0), 0) / (slice.length || 1);
      const slice90 = slice.filter(s => s.return90 !== null);
      const avg90 = slice90.length > 0 ? slice90.reduce((sum, s) => sum + (s.return90 || 0), 0) / slice90.length : 0;
      deciles.push({ decile: `D${i + 1}`, return30: avg30 * 100, return90: avg90 * 100, count: slice.length });
    }
    return deciles;
  }, [data]);

  return (
    <div className="flex-1 overflow-y-auto p-8 relative">
      <div className="max-w-6xl mx-auto space-y-8 relative z-10">
        
        <header className="flex justify-between items-end border-b border-white/10 pb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Layers className="text-brand w-6 h-6" />
              <h1 className="text-3xl font-mono text-zinc-100 uppercase tracking-tight font-bold">Backtest Harness</h1>
            </div>
            <p className="text-dim text-sm max-w-2xl leading-relaxed">
              Analyze the historical predictive power of the Nexus Alpha Score. Decile 10 (D10) represents the highest scoring stocks.
            </p>
          </div>
        </header>

        {loading ? (
          <div className="h-64 flex items-center justify-center border border-white/10 bg-black/40">
            <div className="flex items-center gap-3 text-dim font-mono animate-pulse">
              <Activity className="w-4 h-4" />
              PROCESSING HISTORY...
            </div>
          </div>
        ) : (
          <>
            {/* Phase 9: Top-10 vs Nifty Metrics */}
            {topNMetrics && topNMetrics.periods > 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-mono text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-brand" /> Top-10 Portfolio vs Nifty 50
                  </h3>
                  {topNMetrics.dateRange && (
                    <span className="text-[10px] font-mono text-zinc-500 bg-white/5 px-3 py-1 border border-white/10 rounded-sm uppercase tracking-widest">
                      Backtest window: {topNMetrics.dateRange.from} → {topNMetrics.dateRange.to}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <MetricCard icon={<TrendingUp className="w-4 h-4" />} label="Portfolio CAGR" value={`${topNMetrics.cagr.toFixed(1)}%`} color={topNMetrics.cagr > 0 ? 'green' : 'red'} />
                  <MetricCard icon={<TrendingUp className="w-4 h-4" />} label="Nifty CAGR" value={`${topNMetrics.benchCagr.toFixed(1)}%`} color="zinc" />
                  <MetricCard icon={<Target className="w-4 h-4" />} label="Sharpe Ratio" value={`${topNMetrics.sharpe}`} color={topNMetrics.sharpe > 1 ? 'green' : 'zinc'} />
                  <MetricCard icon={<Shield className="w-4 h-4" />} label="Max Drawdown" value={`${topNMetrics.maxDrawdown.toFixed(1)}%`} color="red" />
                  <MetricCard icon={<Trophy className="w-4 h-4" />} label="Win Rate" value={`${topNMetrics.winRate}%`} color={topNMetrics.winRate > 50 ? 'green' : 'red'} />
                </div>

                <div className="text-[10px] font-mono text-zinc-600 border border-yellow-500/20 bg-yellow-500/5 px-3 py-2 rounded-sm">
                  ⚠ Data window limited to available alpha_score_history snapshots ({topNMetrics.periods} rebalance periods). Not a multi-year backtest.
                </div>
              </motion.div>
            )}

            {/* Existing Decile Analysis */}
            {decileData.length === 0 || data.length < 50 ? (
              <div className="border border-yellow-500/30 bg-yellow-500/10 p-6 flex gap-4">
                <AlertTriangle className="text-yellow-500 w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-yellow-500 font-bold mb-1">Insufficient Historical Data</h3>
                  <p className="text-zinc-300 text-sm">
                    The backtest harness requires historical Nexus Score snapshots to calculate forward returns. 
                    Currently, there are {data.length} snapshots available. Wait for more data to accumulate or run the backfill script.
                  </p>
                </div>
              </div>
            ) : (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="border border-white/10 bg-black/40 p-6"
              >
                <h3 className="text-sm font-mono text-zinc-300 uppercase tracking-wider mb-6">Forward Returns by Score Decile</h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={decileData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                      <XAxis dataKey="decile" stroke="#666" tick={{ fill: '#888', fontSize: 12 }} />
                      <YAxis stroke="#666" tick={{ fill: '#888', fontSize: 12 }} tickFormatter={(val) => `${val.toFixed(1)}%`} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#111', borderColor: '#333' }}
                        itemStyle={{ color: '#00f0ff' }}
                        formatter={(val: number) => [`${val.toFixed(2)}%`, '']}
                      />
                      <Legend />
                      <Bar dataKey="return30" name="30-Day Forward Return" fill="#00f0ff">
                        {decileData.map((entry, index) => (
                          <Cell key={`cell-30-${index}`} fill={entry.return30 >= 0 ? '#00f0ff' : '#ef4444'} fillOpacity={0.8} />
                        ))}
                      </Bar>
                      <Bar dataKey="return90" name="90-Day Forward Return" fill="#a855f7">
                        {decileData.map((entry, index) => (
                          <Cell key={`cell-90-${index}`} fill={entry.return90 >= 0 ? '#a855f7' : '#ef4444'} fillOpacity={0.8} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 text-xs text-dim font-mono">
                  Total historical snapshots analyzed: {data.length}
                </div>
              </motion.div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  const colorMap: Record<string, string> = {
    green: 'text-green-400 border-green-500/30 bg-green-500/10',
    red: 'text-red-400 border-red-500/30 bg-red-500/10',
    zinc: 'text-zinc-300 border-white/10 bg-white/5',
  };
  return (
    <div className={`border p-4 rounded-sm ${colorMap[color] || colorMap.zinc}`}>
      <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-2">{icon} {label}</div>
      <div className="text-2xl font-mono font-bold tabular-data">{value}</div>
    </div>
  );
}
