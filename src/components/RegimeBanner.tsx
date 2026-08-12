import React from 'react';
import { motion } from 'motion/react';
import { TrendingUp, TrendingDown, Activity, AlertCircle } from 'lucide-react';
import { useAppEngine } from '../context/DataContext';

export function RegimeBanner() {
  const { marketRegime, marketBreadthPct } = useAppEngine();

  const getRegimeStyles = () => {
    switch (marketRegime) {
      case 'Bull':
        return {
          border: 'border-green-500/30',
          bg: 'bg-green-500/10',
          text: 'text-green-400',
          icon: <TrendingUp className="w-5 h-5 text-green-400" />,
          label: 'BULL REGIME DETECTED'
        };
      case 'Bear':
        return {
          border: 'border-red-500/30',
          bg: 'bg-red-500/10',
          text: 'text-red-400',
          icon: <TrendingDown className="w-5 h-5 text-red-400" />,
          label: 'BEAR REGIME DETECTED'
        };
      case 'Choppy':
        return {
          border: 'border-orange-500/30',
          bg: 'bg-orange-500/10',
          text: 'text-orange-400',
          icon: <Activity className="w-5 h-5 text-orange-400" />,
          label: 'CHOPPY MARKET DETECTED'
        };
      default:
        return {
          border: 'border-zinc-500/30',
          bg: 'bg-zinc-500/10',
          text: 'text-zinc-400',
          icon: <AlertCircle className="w-5 h-5 text-zinc-400" />,
          label: 'REGIME: UNKNOWN'
        };
    }
  };

  const styles = getRegimeStyles();

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`mb-6 p-4 border ${styles.border} ${styles.bg} rounded-sm shadow-[0_0_20px_rgba(0,0,0,0.2)]`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {styles.icon}
          <div>
            <h3 className={`font-mono font-bold tracking-widest text-sm ${styles.text}`}>
              {styles.label}
            </h3>
            <p className="text-zinc-400 text-xs mt-0.5 max-w-xl">
              {marketRegime === 'Unknown'
                ? "Insufficient data to determine market regime. The engine is waiting for the next live data cycle."
                : `Market Breadth is at ${marketBreadthPct}%. The engine dynamically adjusts factor weights (e.g. Valuation is prioritized in Bear markets, Growth in Bull markets).`}
            </p>
          </div>
        </div>
        
        {marketBreadthPct !== null && (
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Breadth</span>
            <span className={`text-xl font-mono font-bold tabular-data ${styles.text}`}>
              {marketBreadthPct}%
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
