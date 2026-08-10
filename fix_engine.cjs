const fs = require('fs');
let code = fs.readFileSync('src/lib/nexusAlphaEngine.ts', 'utf8');

const regex = /const f_score = sigmoid\(metrics.fScore, 5, 0.8\);\n  const momentum = sigmoid\(liveChange, 0, 0.5\); \/\/ Sensitive to daily momentum\n  const sentiment = Math.round\(\(sales \+ momentum \+ eps\) \/ 3\);\n  const scores = \{ sales, roe_roce, cfo_pat, valuation, eps, f_score, debt_equity, momentum, sentiment \};\n\n  \/\/ Dynamic Regime Weigting\n  let weights = \{\n    sales: 0.15, roe_roce: 0.15, cfo_pat: 0.10, \n    valuation: 0.15, eps: 0.10, f_score: 0.10, \n    debt_equity: 0.10, momentum: 0.10, sentiment: 0.05\n  \};\n\n  if \(regime === 'Bull' || regime === 'Breakout'\) \{\n    weights = \{ \.\.\.weights, momentum: 0.20, sales: 0.20, valuation: 0.05, debt_equity: 0.05 \};\n  \} else if \(regime === 'Bear'\) \{\n    weights = \{ \.\.\.weights, valuation: 0.25, cfo_pat: 0.20, roe_roce: 0.20, momentum: 0.0, sales: 0.05 \};\n  \}/g;

const replacement = `  const f_score = sigmoid(metrics.fScore, 5, 0.8);
  const momentum = sigmoid(liveChange, 0, 0.5); // Sensitive to daily momentum
  const sentiment = 50; 
  const scores = { sales, roe_roce, cfo_pat, valuation, eps, f_score, debt_equity, momentum, sentiment };

  // Dynamic Regime Weigting
  let weights = {
    sales: 0.15, roe_roce: 0.15, cfo_pat: 0.10, 
    valuation: 0.15, eps: 0.10, f_score: 0.10, 
    debt_equity: 0.10, momentum: 0.15, sentiment: 0.00
  };

  if (regime === 'Bull' || regime === 'Breakout') {
    weights = { ...weights, momentum: 0.25, sales: 0.20, valuation: 0.05, debt_equity: 0.05 };
  } else if (regime === 'Bear') {
    weights = { ...weights, valuation: 0.25, cfo_pat: 0.20, roe_roce: 0.20, momentum: 0.0, sales: 0.05, sentiment: 0.00 };
  }`;

code = code.replace(regex, replacement);
fs.writeFileSync('src/lib/nexusAlphaEngine.ts', code);
