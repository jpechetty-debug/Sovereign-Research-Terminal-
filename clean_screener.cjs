const fs = require('fs');
let code = fs.readFileSync('src/pages/Screener.tsx', 'utf8');

const regex = /const AUTOCOMPLETE_TOKENS[^]*?(?=export function Screener\(\))/g;
code = code.replace(regex, '');

fs.writeFileSync('src/pages/Screener.tsx', code);
