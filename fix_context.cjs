const fs = require('fs');
let code = fs.readFileSync('src/context/DataContext.tsx', 'utf8');

const regex = /const liveRegime = deriveRegime\(live\.change \|\| 0, stock\.metrics\);\n\s*const matrix = calculateNexusMatrix\(stock\.metrics, live\.change \|\| 0, liveRegime, stock\.sector\);\n\n\s*return \{\n\s*\.\.\.stock,\n\s*price/g;

const replace = `const metrics = live.fundamentals ? { ...stock.metrics, ...live.fundamentals } : stock.metrics;
          const liveRegime = deriveRegime(live.change || 0, metrics);
          const matrix = calculateNexusMatrix(metrics, live.change || 0, liveRegime, stock.sector);

          return {
            ...stock,
            metrics,
            price`;

code = code.replace(regex, replace);
fs.writeFileSync('src/context/DataContext.tsx', code);
