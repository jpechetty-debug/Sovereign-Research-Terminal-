<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Sovereign Research Terminal v3

**Find compounders faster. Score them objectively. Validate before you buy.**

The Sovereign Research Terminal is a locally-hosted equity research workstation that replaces gut-feel screening with an explainable, rule-based scoring engine — the **Nexus Alpha Engine**. Every score is decomposable into factor contributions, every decision comes with a confidence level tied to data completeness, and the backtest harness lets you prove (or disprove) the edge before risking capital.

## What You Get

| Capability | What It Does |
|---|---|
| **Explainable Alpha Scoring** | Scores 0–100 with a full factor breakdown (growth, profitability, momentum). No black boxes. |
| **Deterministic Decision Engine** | BUY / HOLD / AVOID verdicts driven by score thresholds and data completeness — not LLM guesses. |
| **Market Regime Awareness** | Breadth-driven regime detection (Bull, Bear, Choppy) surfaced in the UI. |
| **Top-10 Backtest Harness** | Reconstructs a Top-10 equal-weight portfolio vs Nifty 50 with CAGR, Sharpe, Max Drawdown, and Win Rate. Honest about its data window. |
| **AI Investment Memos** | Gemini 2.5 synthesizes thesis, moat, management quality, bull/bear cases, and risks — qualitative only, no fabricated price targets. |
| **DCF & Reverse DCF** | Automated intrinsic value estimates from real Operating Cash Flow, with implied growth rate calculations. |
| **Portfolio Analytics** | Sector exposure, Beta (vs `^NSEI`), Max Drawdown, and position-level P&L. |
| **Research Notes with Target Prices** | Attach thesis, catalysts, risks, and target prices to any stock. Export AI memos as PDF. |

## Run Locally

**Prerequisites:** Node.js (v18+)

```bash
npm install
cp .env.example .env.local   # add your GEMINI_API_KEY for AI features
npm run dev
```

Open `http://localhost:3000`.

## Architecture

- **Frontend**: React + Vite + Tailwind CSS v4 + Recharts + Framer Motion
- **Backend**: Express + `better-sqlite3` (embedded `local_data.db`)
- **Data**: `yahoo-finance2` for live quotes and fundamentals
- **AI**: `@google/genai` (Gemini 2.5 Flash)
- **Graph**: Repository indexed via [Graphify](https://github.com/nicobailey/graphify) (`graphify-out/`)

