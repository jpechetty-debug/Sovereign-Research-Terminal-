<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Sovereign Research Terminal v3

The Sovereign Research Terminal is an advanced, standalone local application designed for institutional-grade stock market screening, tracking, and quantitative analysis. 

Version 3 transforms the application from a conceptual mock into a true locally-hosted engine powered by an embedded SQLite database (`local_data.db`), real-time `yahoo-finance2` pipelines, and the proprietary **Nexus Alpha Engine**.

## Key Features

- **Live Market Scanning**: Fetches real-time price quotes, intraday volatility, and fundamental data (P/E, ROE, Growth, CFO/PAT).
- **Embedded SQLite Data Layer**: Uses `better-sqlite3` (`local_data.db`) to persist your custom universe, cache financial fundamentals locally (avoiding rate-limits), and store historical time-series data.
- **Nexus Alpha Engine**: A specialized evaluation framework that scores stocks on a 0-100 scale using rigorous `sigmoid` normalizations across growth, profitability, and momentum metrics. It is sector-aware and strictly null-safe for missing data.
- **Automated DCF & Reverse DCF Analysis**: Dynamically calculates implied growth rates and intrinsic values based on real-world Operating Cash Flow and Shares Outstanding.
- **AI Copilot Synthesis**: Connect your Gemini API Key in `.env.local` to generate automated investment memos (Thesis, Risks, Bull Case, Bear Case) directly in the terminal.
- **Backtesting Harness**: Run historical simulations of the Nexus Alpha Engine against stored price history to evaluate strategy performance over time.
- **Portfolio Analytics**: Track asset allocation, sector exposure, Portfolio Beta (benchmarked against `^NSEI`), and Max Drawdown metrics.
- **Dynamic Universe Management**: Natively add or remove stocks from your tracking universe straight from the UI.

## Run Locally

**Prerequisites:** Node.js (v18+)

1. Install dependencies:
   ```bash
   npm install
   ```
2. (Optional) Set the `GEMINI_API_KEY` in `.env.local` to your Gemini API key to enable AI features.
   ```bash
   cp .env.example .env.local
   # Edit .env.local and add your key
   ```
3. Run the application:
   ```bash
   npm run dev
   ```
4. Open your browser and navigate to `http://localhost:3000`.

## Recent v3 Improvements

- **Database Migration**: Replaced static mock arrays with a fully integrated `better-sqlite3` database (`local_data.db`).
- **Engine Hardening**: Fixed strict null-checks in the Alpha engine, implementing true Piotroski scoring and rigorous math formatting.
- **Data Integrity**: Wired up real `^NSEI` fetching for Portfolio Beta and corrected the AI Copilot data schemas to ensure 100% parity between the React frontend and Express backend.
- **UI/UX Resilience**: Addressed React UI crashes by implementing robust null-guards across all fundamental rendering components (`StockDetail.tsx`, `Screener.tsx`).
- **Semantic Code Graphing**: Repository is fully indexed via Graphify (see `graphify-out`) to support LLM context-awareness and structural mapping.

## Technologies Used

- **Frontend**: React, Vite, Tailwind CSS, Lucide Icons, Recharts, Framer Motion
- **Backend**: Express, Node.js, `better-sqlite3`
- **Data Integration**: `yahoo-finance2`
- **AI Integration**: `@google/genai`

