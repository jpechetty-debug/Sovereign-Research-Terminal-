const fs = require('fs');
let code = fs.readFileSync('src/data/mockData.ts', 'utf8');

const regex = /\{ ticker: "(MSFT|GOOGL|META|NFLX|NVDA)"[^\}]+\},/g;
code = code.replace(regex, '');

fs.writeFileSync('src/data/mockData.ts', code);
