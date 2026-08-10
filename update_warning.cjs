const fs = require('fs');
let code = fs.readFileSync('src/components/Layout.tsx', 'utf8');

code = code.replace(
  /<div className="mb-6 p-4 bg-orange-500\/10 border border-orange-500\/30 rounded-sm flex items-start gap-3">[\s\S]*?<\/div>/g,
  `<div className="mb-6 p-4 bg-brand/10 border border-brand/30 rounded-sm flex items-start gap-3">
            <span className="text-brand text-sm mt-0.5"><Zap className="w-4 h-4" /></span>
            <div>
              <h3 className="text-brand font-mono text-xs font-bold uppercase tracking-wider mb-1">Live Institutional Engine Online</h3>
              <p className="text-zinc-400 text-xs">
                Prices, market capitalizations, and fundamental inputs (sales growth, EPS growth, ROE, etc.) are <strong>streamed in real-time</strong> via Yahoo Finance. Scores update dynamically as data propagates.
              </p>
            </div>
          </div>`
);

fs.writeFileSync('src/components/Layout.tsx', code);
