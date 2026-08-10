import React, { useMemo, useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { ArrowLeft, CheckCircle, AlertTriangle, ExternalLink, Activity, ThumbsUp, ThumbsDown, Target, Zap, Bell, X } from 'lucide-react';
import { useAppEngine } from '../context/DataContext';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { formatCurrency } from '../lib/formatters';

export function StockDetail() {
  const { ticker } = useParams();
  const navigate = useNavigate();
  const { stocks, addAlert } = useAppEngine();
  
  const [isAlertMode, setIsAlertMode] = useState(false);
  const [alertTarget, setAlertTarget] = useState('');
  const [alertDirection, setAlertDirection] = useState<'above'|'below'>('above');
  
  const [priceHistory, setPriceHistory] = useState<{ day: string; price: number }[]>([]);
  const [historyStatus, setHistoryStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  const stock = stocks.find(s => s.ticker === ticker);

  const radarData = useMemo(() => {
    if (!stock) return [];
    
    // Explicit 9-factor model mapping 
    const factorLabels: Record<string, string> = {
      sales: "SALES GR",
      roe_roce: "ROE/ROCE",
      cfo_pat: "CFO/PAT",
      valuation: "VALUATION",
      eps: "EPS GR",
      f_score: "F",
      debt_equity: "DEBT",
      momentum: "MOMO",
      sentiment: "SENTI"
    };

    const keys = Object.keys(stock.scores) as Array<keyof typeof stock.scores>;
    return keys.map(k => ({
      subject: factorLabels[k as string] || (k as string).toUpperCase(),
      A: stock.scores[k],
      fullMark: 100,
    }));
  }, [stock]);

  useEffect(() => {
    if (!ticker) return;
    let cancelled = false;
    setHistoryStatus('loading');
    setPriceHistory([]);

    fetch(`/api/history/${encodeURIComponent(ticker)}`)
      .then(res => {
        if (!res.ok) throw new Error('History fetch failed');
        return res.json();
      })
      .then(({ data }: { data: { date: string; price: number }[] }) => {
        if (cancelled) return;
        setPriceHistory(data.map(d => ({ day: d.date.slice(5), price: d.price })));
        setHistoryStatus('ready');
      })
      .catch(() => {
        if (cancelled) return;
        setHistoryStatus('error');
      });

    return () => { cancelled = true; };
  }, [ticker]);

  if (!stock) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-dim font-mono">
        <AlertTriangle className="w-12 h-12 mb-4 text-red-500" />
        <p>404_TICKER_NOT_FOUND_IN_LOCALS</p>
        <button onClick={() => navigate(-1)} className="mt-4 border border-white/10 bg-white/5 hover:bg-white/10 px-6 py-2 transition-colors rounded-sm uppercase tracking-widest text-[10px] font-bold">Return</button>
      </div>
    );
  }

  const isUp = stock.change >= 0;

  const handleSetAlert = () => {
    const val = parseFloat(alertTarget);
    if (!isNaN(val) && val > 0 && stock) {
      addAlert(stock.ticker, val, alertDirection);
      setIsAlertMode(false);
      setAlertTarget('');
    }
  };

  // Investment Checklist Generation (Tickertape style)
  const checks = [
    { label: "Intrinsic Value", pass: stock.metrics.peRatio > 0 && stock.metrics.peRatio < 30, desc: stock.metrics.peRatio > 30 ? "Expensive valuation vs peers" : "Trading below assumed intrinsic bounds" },
    { label: "ROE vs FD Rates", pass: stock.metrics.roe > 15, desc: stock.metrics.roe > 15 ? "Generates higher return than bank FDs" : "Poor capital efficiency" },
    { label: "Financial Health", pass: stock.metrics.debtEquity < 0.6, desc: stock.metrics.debtEquity < 0.6 ? "Comfortable leverage capacity" : "High debt burden on balance sheet" },
    { label: "Red Flags", pass: stock.metrics.fScore >= 5, desc: stock.metrics.fScore >= 5 ? "Strong financial strength (F-Score)" : "Weak financial strength (F-Score)" },
  ];

  const containerVars = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };
  const itemVars = {
    hidden: { opacity: 0, scale: 0.98, y: 15 },
    show: { opacity: 1, scale: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 25 } }
  };

  return (
    <motion.div variants={containerVars} initial="hidden" animate="show" className="space-y-6">
      {/* Header */}
      <motion.div variants={itemVars} className="flex items-start justify-between border-b border-white/10 pb-6 bg-black/20 p-6 rounded-sm shadow-inner backdrop-blur-md relative">
        <div className="flex items-start gap-5">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 border border-white/10 bg-white/5 hover:bg-white/20 transition-all rounded-sm flex items-center justify-center group shrink-0"
          >
            <ArrowLeft className="w-5 h-5 text-zinc-400 group-hover:text-white transition-colors" />
          </button>
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-white flex items-center gap-3">
              {stock.ticker}
              <span className="px-2.5 py-1 bg-white/10 border border-white/20 text-zinc-300 text-[10px] font-mono rounded-sm uppercase tracking-widest leading-none">NSE</span>
              <span className="px-2.5 py-1 bg-brand/10 border border-brand/30 text-brand text-[10px] font-mono rounded-sm uppercase tracking-widest leading-none glow-text">{stock.sector}</span>
            </h1>
            <h2 className="text-lg text-zinc-400 mt-2 font-medium">{stock.name}</h2>
          </div>
        </div>
        
        <div className="flex flex-col items-end pt-1 relative">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsAlertMode(!isAlertMode)}
              className={cn(
                "p-2 rounded-sm border transition-colors",
                isAlertMode ? "bg-brand/10 border-brand/50 text-brand" : "bg-black/40 border-white/10 text-zinc-400 hover:bg-white/10 hover:text-white"
              )}
            >
              <Bell className="w-4 h-4" />
            </button>
            <span className="text-4xl font-mono tabular-data font-bold text-white drop-shadow-md">{formatCurrency(stock.price, stock.ticker)}</span>
          </div>
          
          <AnimatePresence>
            {isAlertMode && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute top-full right-0 mt-4 p-4 bg-panel border border-white/10 rounded-sm shadow-2xl z-20 w-80 backdrop-blur-xl"
              >
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-300">Set Price Target</h3>
                  <button onClick={() => setIsAlertMode(false)} className="text-zinc-500 hover:text-white">
                    <X className="w-3 h-3" />
                  </button>
                </div>
                
                <div className="flex gap-2 mb-4">
                  <button 
                    onClick={() => setAlertDirection('above')}
                    className={cn("flex-1 py-1.5 text-xs font-mono uppercase tracking-widest border rounded-sm transition-colors", alertDirection === 'above' ? "bg-green-500/20 border-green-500/50 text-green-400" : "bg-black/40 border-white/10 text-dim")}
                  >
                    Target &gt;
                  </button>
                  <button 
                    onClick={() => setAlertDirection('below')}
                    className={cn("flex-1 py-1.5 text-xs font-mono uppercase tracking-widest border rounded-sm transition-colors", alertDirection === 'below' ? "bg-red-500/20 border-red-500/50 text-red-400" : "bg-black/40 border-white/10 text-dim")}
                  >
                    Target &lt;
                  </button>
                </div>

                <div className="flex items-center gap-2 mb-4">
                  <span className="font-mono text-zinc-400">₹</span>
                  <input 
                    type="number"
                    value={alertTarget}
                    onChange={(e) => setAlertTarget(e.target.value)}
                    placeholder={stock.price.toString()}
                    className="flex-1 bg-black/40 border border-white/10 rounded-sm px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-brand/50"
                  />
                </div>

                <button 
                  onClick={handleSetAlert}
                  disabled={!alertTarget}
                  className="w-full py-2 bg-brand/10 border border-brand/30 text-brand text-xs font-bold font-mono tracking-widest uppercase rounded-sm hover:bg-brand hover:text-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Deploy Alert
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <span className={`text-sm font-mono tabular-data font-bold mt-1.5 flex items-center gap-1 ${isUp ? 'text-green-400' : 'text-red-400'}`}>
            {isUp ? '+' : ''}{stock.change.toFixed(2)}% (1D)
          </span>
          <span className="text-[10px] font-mono tabular-data text-dim tracking-widest uppercase mt-3 py-1 px-2 bg-black/40 rounded-sm border border-white/5 shadow-inner">
            MKTCAP: {stock.marketCap}
          </span>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 relative">
        
        {/* Main Content Area (8 Cols) */}
        <div className="xl:col-span-8 flex flex-col gap-6">

          {/* Deep Fundamentals Grid */}
          <motion.div variants={itemVars} className="brutal-panel p-6">
             <div className="flex justify-between items-center mb-8 border-b border-white/10 pb-4">
                <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-200 flex items-center gap-2">
                  <Target className="w-4 h-4 text-brand glow-text" /> Fundamentals & Core Ratios
                </h3>
                <span className="text-[10px] font-mono text-dim uppercase tracking-widest" title="Price/Market Cap are live via Yahoo Finance. Growth, ROE, F-Score, and Debt/Equity are from the static seed dataset — no live fundamentals feed is wired in yet.">
                  Price: Live · Fundamentals: Seed Data
                </span>
             </div>
             
             <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                <FundamentalBox label="Market Cap" value={stock.marketCap} sub="" />
                <FundamentalBox label="PE Ratio (TTM)" value={`${stock.metrics.peRatio.toFixed(2)}x`} sub="Current" />
                <FundamentalBox label="P/B Ratio" value="N/A" sub="No book-value feed" />
                <FundamentalBox label="Debt to Equity" value={`${stock.metrics.debtEquity.toFixed(2)}`} sub={`${stock.metrics.debtEquity > 0.5 ? 'High' : 'Optimal'}`} />
                <FundamentalBox label="ROE" value={`${stock.metrics.roe.toFixed(2)}%`} sub="Return on Eq" isPercent />
                <FundamentalBox label="ROCE" value="N/A" sub="No capital-employed feed" />
                <FundamentalBox label="Piotroski Score" value={`${stock.metrics.fScore} / 9`} sub="Financial Health" highlight={stock.metrics.fScore >= 7} />
                <FundamentalBox label="CFO / PAT" value={`${stock.metrics.cfoPat.toFixed(2)}x`} sub="Cash Conversion" highlight={stock.metrics.cfoPat > 1} />
                <FundamentalBox label="Sales Growth" value={`${stock.metrics.salesGrowth.toFixed(2)}%`} sub="5Y CAGR" isPercent />
                <FundamentalBox label="EPS Growth" value={`${stock.metrics.epsGrowth.toFixed(2)}%`} sub="5Y CAGR" isPercent />
                <FundamentalBox label="Promoter Pvg" value={`${stock.metrics.pledge}%`} sub="Pledged holdings" />
                <FundamentalBox label="Enterprise Val" value="Pending" sub="Simulated Data" />
             </div>
          </motion.div>

          {/* Price Action / Visualization */}
          <motion.div variants={itemVars} className="brutal-panel p-6 shadow-2xl h-[400px] flex flex-col">
             <div className="flex justify-between items-center mb-6">
                <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-200">30D Price Momentum</h3>
                <div className="font-mono text-[10px] text-zinc-300 tracking-widest bg-white/5 py-1.5 px-3 border border-white/10 rounded-sm uppercase">
                  {stock.regime.toUpperCase()} REGIME DETECTED
                </div>
             </div>
             <div className="w-full flex-1 -ml-4">
               {historyStatus === 'loading' && (
                 <div className="h-full flex items-center justify-center text-dim font-mono text-xs">Fetching live 30D history…</div>
               )}
               {historyStatus === 'error' && (
                 <div className="h-full flex flex-col items-center justify-center text-dim font-mono text-xs gap-2">
                   <AlertTriangle className="w-6 h-6 text-orange-400" />
                   Historical data unavailable for {stock.ticker}
                 </div>
               )}
               {historyStatus === 'ready' && (
                 <ResponsiveContainer width="100%" height="100%">
                   <AreaChart data={priceHistory} margin={{ top: 10, right: 0, left: -10, bottom: 0 }}>
                     <defs>
                       <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                         <stop offset="5%" stopColor={isUp ? "#4ade80" : "#f87171"} stopOpacity={0.4}/>
                         <stop offset="95%" stopColor={isUp ? "#4ade80" : "#f87171"} stopOpacity={0}/>
                       </linearGradient>
                     </defs>
                     <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                     <XAxis dataKey="day" stroke="var(--color-dim)" fontSize={10} tickLine={false} axisLine={false} fontFamily="var(--font-mono)" />
                     <YAxis domain={['auto', 'auto']} stroke="var(--color-dim)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => v.toFixed(0)} />
                     <Tooltip 
                       contentStyle={{ backgroundColor: 'rgba(24, 24, 27, 0.95)', backdropFilter: 'blur(8px)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: 4, color: 'white', fontFamily: 'var(--font-mono)', fontSize: '12px' }}
                       itemStyle={{ color: isUp ? '#4ade80' : '#f87171' }}
                     />
                     <Area type="monotone" dataKey="price" stroke={isUp ? "#4ade80" : "#f87171"} strokeWidth={3} fillOpacity={1} fill="url(#colorPrice)" />
                   </AreaChart>
                 </ResponsiveContainer>
               )}
             </div>
          </motion.div>
          
        </div>

        {/* Right Sidebar (4 Cols) */}
        <div className="xl:col-span-4 space-y-6">

          {/* Nexus Engine Badge & Radar */}
          <motion.div variants={itemVars} className="brutal-panel p-6 shadow-[0_10px_30px_rgba(0,240,255,0.1)] flex flex-col border border-brand/30 bg-black/60 relative overflow-hidden backdrop-blur-xl">
            <div className="absolute top-0 right-0 w-32 h-32 bg-brand/20 blur-[50px]"></div>
            <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-200 mb-4 flex justify-between relative z-10">
               Nexus Alpha Score
            </h3>
            <div className="flex items-end gap-2 mb-6 relative z-10 border-b border-white/10 pb-4">
               <span className="text-6xl font-mono font-bold text-white leading-none tracking-tighter glow-text drop-shadow-[0_0_15px_rgba(0,240,255,0.5)] tabular-data">{stock.nexusScore.toFixed(1)}</span>
               <span className="text-brand/50 text-xl leading-none font-mono mb-1 tracking-wider">/100</span>
            </div>
            
            <div className="h-[280px] w-full mt-2 -ml-2 relative z-10">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="65%" data={radarData}>
                  <PolarGrid stroke="rgba(255,255,255,0.1)" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--color-dim)', fontSize: 10, fontFamily: 'var(--font-mono)' }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                  <Tooltip 
                     contentStyle={{ backgroundColor: 'rgba(24, 24, 27, 0.9)', backdropFilter: 'blur(8px)', borderColor: 'rgba(0,240,255,0.3)', borderRadius: 4, color: 'white', fontFamily: 'var(--font-mono)', fontSize: '12px' }}
                     itemStyle={{ color: 'var(--color-brand)' }}
                  />
                  <Radar name={stock.ticker} dataKey="A" stroke="var(--color-brand)" fill="var(--color-brand)" fillOpacity={0.6} strokeWidth={2} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Investment Checklist */}
          <motion.div variants={itemVars} className="brutal-panel p-6 bg-black/40">
            <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-200 mb-6 border-b border-white/10 pb-4">Investment Checklist</h3>
            <div className="space-y-5">
              {checks.map((check, idx) => (
                <div key={idx} className="flex gap-4 items-start group">
                  <div className={`mt-0.5 p-1.5 rounded bg-black/50 border shadow-inner transition-colors ${check.pass ? 'border-green-500/30 text-green-400 group-hover:bg-green-500/10 group-hover:border-green-500/50' : 'border-red-500/30 text-red-500 group-hover:bg-red-500/10 group-hover:border-red-500/50'}`}>
                    {check.pass ? <ThumbsUp className="w-4 h-4" /> : <ThumbsDown className="w-4 h-4" />}
                  </div>
                  <div>
                     <h4 className="text-sm font-bold text-zinc-100 tracking-wide">{check.label}</h4>
                     <p className="text-[11px] text-zinc-400 leading-relaxed mt-1">{check.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

        </div>
      </div>
      
      {/* Engine Trace Log (Bottom Width) */}
      <motion.div variants={itemVars} className="brutal-panel p-6 mt-2 border border-brand/30 bg-black/80 overflow-hidden relative font-mono shadow-[0_0_20px_rgba(0,240,255,0.05)] rounded-sm">
        <div className="absolute top-0 right-0 bg-brand text-black font-mono text-[9px] px-3 py-1 font-bold uppercase tracking-widest">Trace Log: Online</div>
        <h3 className="text-sm font-bold uppercase tracking-widest mb-6 flex items-center gap-2 text-zinc-300 border-b border-white/10 pb-4">
          <Activity className="w-4 h-4 text-brand glow-text" /> ENGINE TRACE: COMPUTATION LOGIC
        </h3>
        <div className="text-[11px] text-zinc-400 space-y-2 leading-relaxed whitespace-pre-wrap selection:bg-brand selection:text-black">
          {`[SYS] Sigmoid Normalization Engine Bootstrap \u2014 \u001b[36mv11.0.4\u001b[0m`} <br/>
          {`[SYS] Sec-Rel Parity: Loaded Sector "${stock.sector}" Medians... OK.`} <br/>
          {`[\u001b[32mOK\u001b[0m]  Growth Vector (Sales: ${stock.metrics.salesGrowth}%, EPS: ${stock.metrics.epsGrowth}%) \u2192 Sigmoid mapping complete.`} <br/>
          {`[\u001b[${stock.metrics.roe > 100 ? '33mWARN' : '32mOK'}\u001b[0m] Quality Vector (ROE: ${stock.metrics.roe}%) \u2192 `}
          {stock.metrics.roe > 100 
            ? `Cap applied via ROE Decay Spline.` 
            : `Efficiency mapped to structural flooring bounds.`} <br/>
          {`[\u001b[${stock.metrics.cfoPat < 1.0 ? '33mWARN' : '32mOK'}\u001b[0m] Cash Flow Vector (CFO/PAT: ${stock.metrics.cfoPat}x) \u2192 `}
          {stock.metrics.cfoPat < 1.0
            ? `Failed >1.0 threshold. Recursive Penalty applied.`
            : `Cash flow conversion mapping nominal.`} <br/>
          {`[SYS] Dynamic Regime Weighting applied: [\u001b[36m${stock.regime.toUpperCase()}\u001b[0m] constraints active.`} <br/>
          
          <div className="mt-6 pt-4 border-t border-white/10 text-brand font-bold bg-white/5 px-4 py-3 flex justify-between max-w-lg rounded-sm items-center glow">
            <span className="tracking-widest">{`>`} COMPOSITE DETERMINISTIC HASH:</span>
            <span className="text-xl tabular-data tracking-tight">{stock.nexusScore.toFixed(2)}</span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function FundamentalBox({ label, value, sub, highlight, isPercent }: { label: string, value: string, sub: string, highlight?: boolean, isPercent?: boolean }) {
  const isPositivePercent = isPercent && !value.startsWith('-');
  const isNegativePercent = isPercent && value.startsWith('-');
  
  return (
    <div className="flex flex-col relative group">
      <div className="absolute left-0 top-0 bottom-6 w-0.5 bg-brand/0 group-hover:bg-brand/50 transition-colors"></div>
      <div className="pl-3 flex flex-col h-full border-b border-white/5 pb-2 group-hover:border-white/20 transition-colors">
        <span className="text-[10px] text-zinc-500 uppercase font-mono mb-1.5 tracking-widest">{label}</span>
        <span className={`text-xl font-mono tabular-data font-medium tracking-tight ${highlight ? 'text-brand glow-text' : isPositivePercent ? 'text-green-400' : isNegativePercent ? 'text-red-400' : 'text-zinc-100'}`}>{value}</span>
        {sub && <span className="text-[9px] text-zinc-500 font-mono mt-1 tracking-wider">{sub}</span>}
      </div>
    </div>
  );
}
