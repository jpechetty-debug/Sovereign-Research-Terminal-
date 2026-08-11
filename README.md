<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Sovereign Research Terminal v3

The Sovereign Research Terminal is an advanced, standalone local application for stock market screening and tracking. 
This version introduces a true local backend with an embedded SQLite database, a Universe management UI, and persistent caching for optimal performance.

## Key Features

- **Live Market Scanning**: Fetches real-time price and fundamental data via `yahoo-finance2`.
- **Local Embedded Database**: Uses `better-sqlite3` to store stock tickers and locally cache financial fundamentals to avoid rate limiting.
- **Dynamic Universe Management**: Natively add or remove stocks from your tracking universe straight from the UI. The engine automatically synchronizes with your custom universe.
- **Nexus Alpha Engine**: A specialized evaluation framework that scores stocks based on growth, profitability, and momentum metrics.
- **AI Integration Ready**: Connect your Gemini API Key in `.env.local` to leverage AI-driven insights directly in the terminal.

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

## Recent Improvements

- **Database Engine**: Replaced static mock arrays with an embedded SQLite database (`terminal.db`).
- **Data Integrity & AI Wiring**: Fixed strict null-checks in Alpha engine, resolved dead-code in AI Copilot caching (`getLatestAiMemo`), and synchronized UI components (`StockDetail.tsx`) to exactly match backend AI Memo data schema.
- **Advanced DCF & Risk Metrics**: Fully wired Portfolio Beta, Portfolio Max Drawdown, Operating Cash Flow, and Shares Outstanding directly into the embedded SQLite data layer (`price_history` and `fundamentals_history`).
- **Graphify Integration**: Repository is now fully indexed as a queryable knowledge graph (see `graphify-out`).
- **Universe Management UI**: Added a dedicated `/universe` route to seamlessly manage tracked assets.
- **Persistent Caching**: The engine caches fetched fundamentals for 24 hours, dramatically improving performance for subsequent scans.

## Technologies Used

- **Frontend**: React, Vite, Tailwind CSS, Lucide Icons, Recharts, Framer Motion
- **Backend**: Express, Node.js, better-sqlite3
- **Data Integration**: yahoo-finance2
- **AI**: @google/genai

