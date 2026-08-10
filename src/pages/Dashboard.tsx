import React from 'react';
import { Activity, ShieldAlert, ArrowUpRight, ArrowDownRight, Zap, Target } from 'lucide-react';
import { useAppEngine } from '../context/DataContext';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { formatCurrency } from '../lib/formatters';

const HIGH_CONVICTION_THRESHOLD = 80;

interface GeneratedAlert {
  ticker: string;
  title: string;
  msg: string;
  severity: 'high' | 'medium' | 'low';
}

function generateAlerts(stocks: ReturnType<typeof useAppEngine>['stocks']): GeneratedAlert[] {
  const alerts: GeneratedAlert[] = [];

  stocks.forEach(s => {
    if (s.metrics.fScore <= 2) {
      alerts.push({
        ticker: s.ticker,
        title: 'F-Score Weakness',
        severity: 'high',
        msg: `Piotroski F-Score at ${s.metrics.fScore}/9 — weak fundamental quality signal.`
      });
    }
    if (Math.abs(s.change) >= 4) {
      alerts.push({
        ticker: s.ticker,
        title: s.change > 0 ? 'Momentum Spike' : 'Momentum Drop',
        severity: 'medium',
        msg: `Moved ${s.change > 0 ? '+' : ''}${s.change.toFixed(2)}% today — above the 4% intraday threshold.`
      });
    }
    if (s.metrics.debtEquity >= 0.6) {
      alerts.push({
        ticker: s.ticker,
        title: 'Elevated Leverage',
        severity: 'low',
        msg: `Debt/Equity at ${s.metrics.debtEquity.toFixed(2)}x — above the 0.6x comfort threshold.`
      });
    }
  });

  const severityRank = { high: 0, medium: 1, low: 2 };
  return alerts.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]).slice(0, 5);
}

export function Dashboard() {
  const navigate = useNavigate();
  const { stocks, vix } = useAppEngine();
  const highConvictionCount = stocks.filter(s => s.nexusScore > HIGH_CONVICTION_THRESHOLD).length;
  const liveAlerts = generateAlerts(stocks);

  const containerVars = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };
  
  const itemVars = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } }
  };

  return (
    <motion.div variants={containerVars} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={itemVars} className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-100 mb-1">TERMINAL DASHBOARD</h1>
          <p className="text-brand font-mono text-xs uppercase tracking-widest">System Status: Nominal // Live Mesh Connected</p>
        </div>
        <div className="flex gap-6">
          <DataBite label="UNIVERSE" value={stocks.length.toLocaleString('en-IN')} />
          <DataBite label="HIGH CONVICTION" value={highConvictionCount.toLocaleString('en-IN')} highlight />
          <DataBite 
            label="INDIA VIX" 
            value={vix ? vix.price.toFixed(2) : '—'} 
            color={vix ? (vix.change >= 0 ? 'text-red-400' : 'text-green-400') : 'text-dim'} 
          />
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        

        {/* Quality Alerts */}
        <motion.div variants={itemVars} className="brutal-panel p-5 flex flex-col">
          <h2 className="text-sm font-bold flex items-center gap-2 mb-4 uppercase tracking-widest text-zinc-300 border-b border-white/10 pb-4">
            <ShieldAlert className="w-4 h-4 text-orange-400" /> 
            System ALERTS
          </h2>
          <div className="flex-1 overflow-auto space-y-3 pr-2">
            {liveAlerts.length === 0 && (
              <p className="text-dim text-xs font-mono py-4 text-center">No active alerts in the current universe.</p>
            )}
            {liveAlerts.map((alert, idx) => (
              <AlertItem 
                key={`${alert.ticker}-${idx}`}
                ticker={alert.ticker} 
                title={alert.title} 
                severity={alert.severity} 
                msg={alert.msg} 
                icon={alert.severity === 'low' ? <Zap className="w-3 h-3 text-brand" /> : undefined}
              />
            ))}
          </div>
        </motion.div>

      </div>

      {/* Top Nexus Alpha Stocks Grid */}
      <motion.div variants={itemVars} className="brutal-panel p-0 overflow-hidden">
        <div className="p-5 flex justify-between items-end border-b border-white/10 bg-white/5 backdrop-blur-md">
          <h2 className="text-sm font-bold tracking-widest text-zinc-300 flex items-center gap-2 uppercase">
            <Target className="w-4 h-4 text-brand" /> Nexus Alpha Leaders
          </h2>
          <span className="text-[10px] font-mono text-dim tracking-widest uppercase">Sorted by Conviction (v11.0)</span>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-black/20 text-[10px] font-mono text-dim uppercase tracking-wider border-b border-white/10">
                <th className="py-4 px-5 font-medium">Ticker</th>
                <th className="py-4 px-5 font-medium">Sector</th>
                <th className="py-4 px-5 font-medium text-right">Price</th>
                <th className="py-4 px-5 font-medium text-right">Momentum (1D)</th>
                <th className="py-4 px-5 font-medium text-center">Regime</th>
                <th className="py-4 px-5 font-medium text-center">Nexus Matrix</th>
                <th className="py-4 px-5 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {stocks.sort((a,b) => b.nexusScore - a.nexusScore).slice(0, 5).map((stock) => (
                <tr key={stock.ticker} className="hover:bg-white/5 transition-colors group cursor-pointer" onClick={() => navigate(`/stock/${stock.ticker}`)}>
                  <td className="py-4 px-5 font-mono font-bold text-zinc-200 group-hover:text-white transition-colors">{stock.ticker}</td>
                  <td className="py-4 px-5 text-dim text-xs">{stock.sector}</td>
                  <td className="py-4 px-5 text-right font-mono tabular-data text-sm">{formatCurrency(stock.price, stock.ticker)}</td>
                  <td className={`py-4 px-5 text-right font-mono tabular-data text-sm flex items-center justify-end gap-1 ${stock.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {stock.change >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {Math.abs(stock.change).toFixed(2)}%
                  </td>
                  <td className="py-4 px-5 text-center">
                    <span className="px-2 py-1 bg-white/5 border border-white/10 text-[10px] font-mono rounded text-zinc-300">{stock.regime}</span>
                  </td>
                  <td className="py-4 px-5">
                    <div className="flex items-center justify-center gap-3">
                      <div className="w-full max-w-[120px] h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }} 
                          animate={{ width: `${Math.min(100, Math.max(0, stock.nexusScore))}%` }} 
                          transition={{ duration: 1, delay: 0.2 }}
                          className="h-full bg-brand glow" 
                        ></motion.div>
                      </div>
                      <span className="font-mono text-brand font-bold text-xs tabular-data">{stock.nexusScore.toFixed(1)}</span>
                    </div>
                  </td>
                  <td className="py-4 px-5 text-right">
                    <button 
                      onClick={(e) => { e.stopPropagation(); navigate(`/stock/${stock.ticker}`); }}
                      className="px-3 py-1.5 bg-brand/10 border border-brand/30 text-brand font-mono text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-all uppercase rounded-sm hover:bg-brand hover:text-black"
                    >
                      Audit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Actionable Setups Multi-Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6">
        {/* Intraday Action */}
        <motion.div variants={itemVars} className="brutal-panel p-0 overflow-hidden">
          <div className="p-5 flex justify-between items-end border-b border-white/10 bg-white/5 backdrop-blur-md">
            <h2 className="text-sm font-bold tracking-widest text-zinc-300 flex items-center gap-2 uppercase">
              <Zap className="w-4 h-4 text-brand glow-text" /> Intraday Movers
            </h2>
            <span className="text-[10px] font-mono text-dim tracking-widest uppercase">High Volatility (1D)</span>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-black/20 text-[10px] font-mono text-dim uppercase tracking-wider border-b border-white/10">
                  <th className="py-3 px-5 font-medium">Ticker</th>
                  <th className="py-3 px-5 font-medium text-right">Price</th>
                  <th className="py-3 px-5 font-medium text-right">Momentum</th>
                  <th className="py-3 px-5 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {[...stocks].sort((a, b) => Math.abs(b.change) - Math.abs(a.change)).slice(0, 5).map((stock) => (
                  <tr key={stock.ticker} className="hover:bg-white/5 transition-colors group cursor-pointer" onClick={() => navigate(`/stock/${stock.ticker}`)}>
                    <td className="py-4 px-5 font-mono font-bold text-zinc-200 group-hover:text-white transition-colors">{stock.ticker}</td>
                    <td className="py-4 px-5 text-right font-mono tabular-data text-sm">{formatCurrency(stock.price, stock.ticker)}</td>
                    <td className={`py-4 px-5 text-right font-mono tabular-data text-sm flex items-center justify-end gap-1 ${stock.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {stock.change >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                      {Math.abs(stock.change).toFixed(2)}%
                    </td>
                    <td className="py-4 px-5 text-right">
                      <button 
                        onClick={(e) => { e.stopPropagation(); navigate(`/stock/${stock.ticker}`); }}
                        className="px-3 py-1.5 bg-brand/10 border border-brand/30 text-brand font-mono text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-all uppercase rounded-sm hover:bg-brand hover:text-black"
                      >
                        Trade
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Swing Setups */}
        <motion.div variants={itemVars} className="brutal-panel p-0 overflow-hidden">
          <div className="p-5 flex justify-between items-end border-b border-white/10 bg-white/5 backdrop-blur-md">
            <h2 className="text-sm font-bold tracking-widest text-zinc-300 flex items-center gap-2 uppercase">
              <Target className="w-4 h-4 text-purple-400 glow-text" /> Swing Setups
            </h2>
            <span className="text-[10px] font-mono text-dim tracking-widest uppercase">Multi-Day Breakouts</span>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-black/20 text-[10px] font-mono text-dim uppercase tracking-wider border-b border-white/10">
                  <th className="py-3 px-5 font-medium">Ticker</th>
                  <th className="py-3 px-5 font-medium text-center">Score</th>
                  <th className="py-3 px-5 font-medium text-center">Regime</th>
                  <th className="py-3 px-5 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {[...stocks].filter(s => s.regime === 'Bull' || s.nexusScore > 75).sort((a, b) => b.nexusScore - a.nexusScore).slice(0, 5).map((stock) => (
                  <tr key={stock.ticker} className="hover:bg-white/5 transition-colors group cursor-pointer" onClick={() => navigate(`/stock/${stock.ticker}`)}>
                    <td className="py-4 px-5 font-mono font-bold text-zinc-200 group-hover:text-white transition-colors">{stock.ticker}</td>
                    <td className="py-4 px-5 text-center font-mono tabular-data text-sm text-purple-400 font-bold">{stock.nexusScore.toFixed(1)}</td>
                    <td className="py-4 px-5 text-center">
                      <span className="px-2 py-1 bg-purple-500/10 border border-purple-500/30 text-purple-400 text-[10px] font-mono rounded-sm">{stock.regime.toUpperCase()}</span>
                    </td>
                    <td className="py-4 px-5 text-right">
                      <button 
                        onClick={(e) => { e.stopPropagation(); navigate(`/stock/${stock.ticker}`); }}
                        className="px-3 py-1.5 bg-purple-500/10 border border-purple-500/30 text-purple-400 font-mono text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-all uppercase rounded-sm hover:bg-purple-500 hover:text-white"
                      >
                        Plan
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>

    </motion.div>
  );
}

function DataBite({ label, value, highlight, color = "text-zinc-100" }: { label: string, value: string, highlight?: boolean, color?: string }) {
  return (
    <div className="flex flex-col items-end border-r border-white/10 pr-6 last:border-0 last:pr-0">
      <span className="text-[10px] font-mono text-dim tracking-widest">{label}</span>
      <span className={`text-2xl font-mono tabular-data font-bold tracking-tight ${highlight ? 'text-brand glow-text' : color}`}>{value}</span>
    </div>
  );
}

interface AlertItemProps {
  key?: React.Key;
  ticker: string;
  title: string;
  msg: string;
  severity: 'high' | 'medium' | 'low';
  icon?: React.ReactNode;
}

function AlertItem({ ticker, title, msg, severity, icon }: AlertItemProps) {
  const colors = {
    high: 'border-red-500/30 bg-red-500/10 text-red-400',
    medium: 'border-orange-500/30 bg-orange-500/10 text-orange-400',
    low: 'border-brand/30 bg-brand/10 text-brand'
  };
  
  return (
    <div className={`p-4 border ${colors[severity]} rounded-sm transition-all hover:bg-white/5`}>
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-mono text-xs font-bold tracking-wider">{ticker}</span>
        </div>
        <span className="text-[9px] uppercase tracking-widest bg-black/20 px-1.5 py-0.5 rounded">{severity}</span>
      </div>
      <div className="text-zinc-100 text-sm font-semibold mb-1">{title}</div>
      <div className="text-xs text-zinc-400 leading-relaxed">{msg}</div>
    </div>
  );
}
