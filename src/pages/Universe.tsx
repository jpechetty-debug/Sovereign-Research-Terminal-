import React, { useState } from 'react';
import { useAppEngine } from '../context/DataContext';
import { Plus, Trash2, Box } from 'lucide-react';
import { cn } from '../lib/utils';

export function Universe() {
  const { stocks, refreshUniverse } = useAppEngine();
  const [newTicker, setNewTicker] = useState('');
  const [newName, setNewName] = useState('');
  const [newSector, setNewSector] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState('');

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!newTicker || !newName || !newSector) {
      setError('All fields are required');
      return;
    }

    setIsAdding(true);
    try {
      const res = await fetch('/api/ticker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: newTicker, name: newName, sector: newSector }),
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to add ticker');
      }

      setNewTicker('');
      setNewName('');
      setNewSector('');
      await refreshUniverse();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsAdding(false);
    }
  };

  const handleDelete = async (ticker: string) => {
    if (!confirm(`Are you sure you want to remove ${ticker} from the universe?`)) return;
    
    try {
      const res = await fetch(`/api/ticker?ticker=${encodeURIComponent(ticker)}`, {
        method: 'DELETE',
      });
      
      if (!res.ok) {
        throw new Error('Failed to delete ticker');
      }
      
      await refreshUniverse();
    } catch (err) {
      console.error(err);
      alert("Failed to delete ticker.");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-mono tracking-tight text-white mb-2 flex items-center gap-3">
          <Box className="w-6 h-6 text-brand" />
          UNIVERSE MANAGEMENT
        </h1>
        <p className="text-zinc-400 max-w-2xl text-sm">
          Add or remove stocks from the tracking universe. The engine will scan and evaluate all tickers listed here.
        </p>
      </div>

      <div className="bg-panel border border-white/5 rounded-md p-6">
        <h2 className="text-lg font-mono text-zinc-100 mb-4">Add New Ticker</h2>
        <form onSubmit={handleAdd} className="flex gap-4 items-end">
          <div className="space-y-1">
            <label className="text-xs text-dim font-mono uppercase">Ticker Symbol</label>
            <input 
              type="text" 
              value={newTicker}
              onChange={e => setNewTicker(e.target.value.toUpperCase())}
              placeholder="e.g. INFY.NS"
              className="bg-black/40 border border-white/10 text-white font-mono text-sm px-4 py-2 rounded focus:outline-none focus:border-brand/50 w-48"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-dim font-mono uppercase">Company Name</label>
            <input 
              type="text" 
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="e.g. Infosys"
              className="bg-black/40 border border-white/10 text-white font-mono text-sm px-4 py-2 rounded focus:outline-none focus:border-brand/50 w-64"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-dim font-mono uppercase">Sector</label>
            <input 
              type="text" 
              value={newSector}
              onChange={e => setNewSector(e.target.value)}
              placeholder="e.g. IT"
              className="bg-black/40 border border-white/10 text-white font-mono text-sm px-4 py-2 rounded focus:outline-none focus:border-brand/50 w-48"
            />
          </div>
          <button 
            type="submit" 
            disabled={isAdding}
            className="bg-brand/20 border border-brand/50 text-brand px-6 py-2 rounded hover:bg-brand/30 transition-colors flex items-center gap-2 h-10 font-bold tracking-wider text-sm disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            {isAdding ? 'ADDING...' : 'ADD'}
          </button>
        </form>
        {error && <p className="text-red-400 mt-3 text-sm">{error}</p>}
      </div>

      <div className="bg-panel border border-white/5 rounded-md overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-white/5 bg-black/20 font-mono text-[10px] uppercase tracking-wider text-dim">
              <th className="px-6 py-4">Ticker</th>
              <th className="px-6 py-4">Company Name</th>
              <th className="px-6 py-4">Sector</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-sm">
            {stocks.map(stock => (
              <tr key={stock.ticker} className="hover:bg-white/[0.02] transition-colors">
                <td className="px-6 py-4 font-bold text-zinc-100">{stock.ticker}</td>
                <td className="px-6 py-4 text-zinc-300">{stock.name}</td>
                <td className="px-6 py-4 text-zinc-400">{stock.sector}</td>
                <td className="px-6 py-4 text-right">
                  <button 
                    onClick={() => handleDelete(stock.ticker)}
                    className="text-dim hover:text-red-400 transition-colors p-2"
                    title="Remove from universe"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {stocks.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-dim font-mono">
                  No stocks in universe. Add one above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
