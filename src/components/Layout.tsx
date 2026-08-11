import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { Terminal, Activity, Crosshair, Box, Layers, Clock, Search, Zap, Bell, X, Briefcase } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAppEngine } from '../context/DataContext';
import { motion, AnimatePresence } from 'motion/react';
import { formatCurrency } from '../lib/formatters';

export function Layout() {
  const [time, setTime] = useState(new Date());
  const { isLiveEngineActive, toggleLiveEngine, isScanning, alerts, dismissTriggeredAlert, marketRegime, marketBreadthPct } = useAppEngine();
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const triggeredAlerts = alerts.filter(a => a.isTriggered);
  const activeAlertCount = triggeredAlerts.length;

  return (
    <div className="flex h-screen overflow-hidden text-sm bg-appbg relative">
      {/* Sidebar - Fixed Width */}
      <aside className="w-64 flex-shrink-0 flex flex-col bg-black/40 backdrop-blur-xl border-r border-white/10 z-20">
        {/* Header */}
        <div className="h-20 flex items-center px-6 border-b border-white/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-brand/10 blur-[50px] -translate-y-1/2 translate-x-1/2"></div>
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-8 h-8 rounded bg-brand/20 border border-brand/40 flex items-center justify-center">
              <Terminal className="text-brand w-5 h-5 drop-shadow-[0_0_8px_rgba(0,240,255,0.8)]" strokeWidth={1.5} />
            </div>
            <div className="flex flex-col">
              <span className="font-mono font-bold tracking-tight text-zinc-100 leading-tight">SOVEREIGN</span>
              <span className="text-[10px] text-brand font-mono leading-none tracking-widest mt-0.5 glow-text">v3.0.4-NEXUS</span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-6 px-4 flex flex-col gap-1.5 overflow-y-auto">
          <div className="text-[10px] text-dim uppercase tracking-[0.2em] font-mono mb-3 px-3">Core Modules</div>
          
          <NavItem to="/" icon={<Activity className="w-4 h-4" />} label="Dashboard" />
          <NavItem to="/screener" icon={<Crosshair className="w-4 h-4" />} label="Screener" />
          <NavItem to="/universe" icon={<Box className="w-4 h-4" />} label="Universe" />
          <NavItem to="/portfolio" icon={<Briefcase className="w-4 h-4" />} label="Portfolio" />
          <NavItem to="/backtest" icon={<Layers className="w-4 h-4" />} label="Backtest" />
        </nav>

        {/* Status Area */}
        <div className="p-5 border-t border-white/10 bg-black/20 font-mono text-[11px] space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-dim">STATUS</span>
            <span className="text-brand flex items-center gap-1.5 font-bold tracking-wider">
              <span className="w-1.5 h-1.5 bg-brand rounded-full shadow-[0_0_8px_rgba(0,240,255,1)] animate-pulse"></span> 
              {isScanning && !isLiveEngineActive ? 'SCANNING' : 'ONLINE'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-dim">ENGINE</span>
            <span className={`flex items-center gap-1.5 font-bold tracking-wider ${isLiveEngineActive ? 'text-green-500' : 'text-zinc-500'}`}>
              {isLiveEngineActive ? <Zap className="w-3 h-3 fill-green-500" /> : <div className="w-1.5 h-1.5 bg-zinc-600 rounded-full"></div>}
              {isLiveEngineActive ? 'LIVE MESH' : 'IDLE'}
            </span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-[300px] bg-brand/5 blur-[120px] pointer-events-none"></div>
        {/* Top Navbar */}
        <header className="h-20 flex-shrink-0 border-b border-white/10 flex items-center justify-between px-8 bg-black/20 backdrop-blur-md z-10 relative">
          
          {/* Global Search Interface */}
          <div className="flex items-center gap-6">
            <div className="flex items-center w-[400px] relative group">
              <Search className="w-4 h-4 text-dim absolute left-4 group-focus-within:text-brand transition-colors" />
              <input 
                type="text" 
                placeholder="Query Ticker or Sector [Cmd + K]" 
                className="w-full bg-black/40 border border-white/10 text-white font-mono text-xs px-12 py-2.5 rounded-sm focus:outline-none focus:border-brand/50 focus:bg-brand/5 transition-all placeholder:text-dim/50 shadow-inner"
              />
              <div className="absolute right-3 px-2 py-1 border border-white/10 text-dim text-[9px] font-mono rounded bg-white/5">
                NSE
              </div>
            </div>
            
            {/* Live Engine Toggle */}
            <button 
              onClick={toggleLiveEngine}
              className={`group flex items-center gap-2.5 px-4 py-2 border font-mono text-[10px] uppercase font-bold tracking-wider transition-all duration-300 rounded-sm ${
                isLiveEngineActive 
                  ? 'border-green-500/50 bg-green-500/10 text-green-400 shadow-[0_0_15px_rgba(34,197,94,0.15)]' 
                  : 'border-white/10 bg-black/40 text-dim hover:text-white hover:border-white/30'
              }`}
            >
              <div className="relative flex items-center justify-center">
                <div className={`w-2 h-2 rounded-full ${isLiveEngineActive ? 'bg-green-400' : 'bg-dim'}`}></div>
                {isLiveEngineActive && <div className="absolute w-4 h-4 rounded-full bg-green-400/50 animate-ping"></div>}
              </div>
              {isLiveEngineActive ? 'LIVE POLLING: ON' : 'LIVE POLLING: OFF'}
            </button>
          </div>

          {/* Right Metrics */}
          <div className="flex items-center gap-6 font-mono text-xs">
            
            {/* Alert Bell */}
            <div className="relative">
              <button 
                onClick={() => setIsAlertsOpen(!isAlertsOpen)}
                className={cn(
                  "p-2 rounded-sm border transition-colors flex items-center justify-center relative",
                  activeAlertCount > 0 
                    ? "bg-brand/10 border-brand/50 text-brand" 
                    : "bg-black/30 border-white/10 text-zinc-400 hover:text-white"
                )}
              >
                <Bell className="w-4 h-4" />
                {activeAlertCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-brand rounded-full shadow-[0_0_8px_rgba(0,240,255,1)]"></span>
                )}
              </button>
              
              {/* Alerts Dropdown */}
              <AnimatePresence>
                {isAlertsOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 top-full mt-2 w-80 bg-panel border border-white/10 shadow-2xl rounded-sm overflow-hidden z-50 backdrop-blur-xl"
                  >
                    <div className="p-3 border-b border-white/10 bg-black/40 flex justify-between items-center">
                      <span className="font-bold text-zinc-200 tracking-wider text-[10px] uppercase">Active Alerts</span>
                      <span className="text-[10px] text-brand">{activeAlertCount} Triggered</span>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {alerts.length === 0 ? (
                        <div className="p-6 text-center text-dim text-xs">No alerts configured.</div>
                      ) : (
                        <div className="divide-y divide-white/5">
                          {alerts.map(alert => (
                            <div key={alert.id} className={cn(
                              "p-3 flex items-start gap-3 transition-colors",
                              alert.isTriggered ? "bg-brand/5" : "hover:bg-white/5"
                            )}>
                              <div className={cn(
                                "w-2 h-2 mt-1 rounded-full shrink-0",
                                alert.isTriggered ? "bg-brand shadow-[0_0_8px_rgba(0,240,255,1)]" : "bg-dim"
                              )}></div>
                              <div className="flex-1">
                                <div className="flex justify-between">
                                  <span className="font-bold text-zinc-200">{alert.ticker}</span>
                                  <span className="text-zinc-400">{formatCurrency(alert.targetPrice, alert.ticker)}</span>
                                </div>
                                <div className="text-[10px] text-dim mt-0.5">
                                  {alert.isTriggered 
                                    ? <span className="text-brand">Target hit! Price crossed {alert.direction} target.</span>
                                    : `Waiting for price to cross ${alert.direction}`}
                                </div>
                              </div>
                              {alert.isTriggered && (
                                <button 
                                  onClick={() => dismissTriggeredAlert(alert.id)}
                                  className="text-dim hover:text-white"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="flex flex-col items-end">
              <span className="text-dim text-[9px] tracking-widest mb-0.5">MARKET REGIME</span>
              <span className="text-zinc-100 font-bold flex items-center gap-1.5 tracking-wider">
                {marketRegime === 'Unknown' ? 'AWAITING SCAN' : `${marketRegime.toUpperCase()} PHASE`}
                {marketRegime === 'Bull' && <span className="text-green-500 text-sm leading-none drop-shadow-[0_0_5px_rgba(34,197,94,0.8)]">▲</span>}
                {marketRegime === 'Bear' && <span className="text-red-500 text-sm leading-none drop-shadow-[0_0_5px_rgba(239,68,68,0.8)]">▼</span>}
                {marketRegime === 'Choppy' && <span className="text-yellow-500 text-sm leading-none">◆</span>}
              </span>
              {marketBreadthPct !== null && (
                <span className="text-dim text-[9px] tracking-widest mt-0.5">{marketBreadthPct}% ADVANCING</span>
              )}
            </div>
            
            <div className="w-px h-10 bg-white/10"></div>
            
            <div className="flex gap-2.5 text-zinc-400 items-center bg-black/30 px-3 py-1.5 rounded-sm border border-white/5">
              <Clock className="w-3.5 h-3.5" />
              <span className="tabular-data tracking-wider">
                {time.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })} {time.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false })} IST
              </span>
            </div>
          </div>
        </header>

        {/* Scrollable Router Outlet */}
        <main className="flex-1 overflow-auto p-8 scroll-smooth will-change-scroll">
          <div className="mb-6 p-4 bg-brand/10 border border-brand/30 rounded-sm flex items-start gap-3">
            <span className="text-brand text-sm mt-0.5"><Zap className="w-4 h-4" /></span>
            <div>
              <h3 className="text-brand font-mono text-xs font-bold uppercase tracking-wider mb-1">Live Engine — Partial Fundamentals</h3>
              <p className="text-zinc-400 text-xs">
                Prices, market cap, sales/EPS growth, ROE, and PE are fetched live via Yahoo Finance and cached (fundamentals refresh every ~12h). <strong>CFO/PAT and F-Score are still fixed placeholder values</strong>, not live data yet. Newly loaded tickers may show blank fundamentals for up to a minute while the background queue fetches them.
              </p>
            </div>
          </div>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function NavItem({ to, icon, label }: { to: string, icon: React.ReactNode, label: string }) {
  const location = useLocation();
  const isActive = location.pathname === to;
  
  return (
    <NavLink 
      to={to} 
      className={cn(
        "relative flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-all rounded-sm overflow-hidden group",
        isActive 
          ? "text-brand bg-brand/10" 
          : "text-zinc-400 hover:text-zinc-100 hover:bg-white/5"
      )}
    >
      {isActive && (
        <motion.div 
          layoutId="activeNavIndicator"
          className="absolute left-0 top-0 bottom-0 w-[3px] bg-brand shadow-[0_0_10px_rgba(0,240,255,0.8)]"
          initial={false}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        />
      )}
      <span className="relative z-10">{icon}</span>
      <span className="relative z-10 tracking-wide">{label}</span>
      <span className="ml-auto opacity-0 group-hover:opacity-100 font-mono text-[9px] text-dim transition-opacity">[/]</span>
    </NavLink>
  );
}
