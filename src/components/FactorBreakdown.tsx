import React from 'react';
import { FactorContribution } from '../lib/decisionEngine';

export function FactorBreakdown({ contributions }: { contributions: FactorContribution[] }) {
  if (!contributions || contributions.length === 0) {
    return <div className="text-zinc-500 text-xs font-mono">No factor data available.</div>;
  }

  // Find max magnitude for scaling bars
  const maxPoints = Math.max(...contributions.map(c => Math.abs(c.points)));
  
  return (
    <div className="space-y-2">
      {contributions.map((c, i) => {
        const isPositive = c.points > 0;
        const widthPct = maxPoints > 0 ? (Math.abs(c.points) / maxPoints) * 100 : 0;
        
        return (
          <div key={i} className="flex items-center gap-3 text-xs font-mono">
            <div className="w-24 text-zinc-400 truncate" title={c.factor}>{c.factor}</div>
            
            <div className="flex-1 grid grid-cols-2 gap-1 items-center">
              {/* Negative side */}
              <div className="flex justify-end">
                {!isPositive && (
                  <div 
                    className="h-1.5 bg-red-500/80 rounded-l-sm" 
                    style={{ width: `${widthPct}%` }}
                  ></div>
                )}
              </div>
              
              {/* Positive side */}
              <div className="flex justify-start">
                {isPositive && (
                  <div 
                    className="h-1.5 bg-green-500/80 rounded-r-sm" 
                    style={{ width: `${widthPct}%` }}
                  ></div>
                )}
              </div>
            </div>
            
            <div className={`w-12 text-right ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
              {isPositive ? '+' : ''}{c.points.toFixed(1)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
