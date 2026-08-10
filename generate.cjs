const fs = require('fs');
const raw = fs.readFileSync('raw.txt', 'utf8').trim().split('\n');

const formatMcap = (mcap) => {
    let m = parseFloat(mcap.replace(/,/g, ''));
    if (m >= 100000) return (m / 100000).toFixed(2) + 'L Cr';
    if (m >= 1000) return (m / 1000).toFixed(2) + 'k Cr';
    return m.toFixed(2) + ' Cr';
};

const getRegime = (score) => {
    return 'Unknown';
};

const excludeUS = ['MSFT', 'GOOGL', 'META', 'NFLX', 'NVDA', 'AAPL'];

const out = raw.map(line => {
    const parts = line.split('\t');
    if (parts.length < 7) return null;
    const [ticker, score, sector, industry, mcapStr, peStr, fscoreStr] = parts;
    if (excludeUS.includes(ticker)) return null;
    
    const mcapNum = parseFloat(mcapStr.replace(/,/g, ''));
    
    return `  { ticker: "${ticker}", name: "${industry}", sector: "${sector}", nexusScore: 0, price: 0, change: 0, marketCap: "${formatMcap(mcapStr)}", regime: "Unknown", metrics: { mcapCr: ${mcapNum}, pledge: 0, salesGrowth: 0, epsGrowth: 0, roe: 0, cfoPat: 0, fScore: 0, debtEquity: 0, peRatio: 0 }, scores: { sales: 0, roe_roce: 0, cfo_pat: 0, valuation: 0, eps: 0, f_score: 0, debt_equity: 0, momentum: 0, sentiment: 0 } }`;
}).filter(Boolean);

const fileContent = `export const MOCK_STOCKS = [\n${out.join(',\n')}\n];\n`;
fs.writeFileSync('src/data/mockData.ts', fileContent);
