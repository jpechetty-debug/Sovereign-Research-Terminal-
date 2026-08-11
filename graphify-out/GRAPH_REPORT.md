# Graph Report - sovereign-research-terminal-v3  (2026-08-11)

## Corpus Check
- 25 files · ~21,213 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 117 nodes · 215 edges · 16 communities (15 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ff2829b5`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]

## God Nodes (most connected - your core abstractions)
1. `useAppEngine()` - 13 edges
2. `formatCurrency()` - 9 edges
3. `cn()` - 8 edges
4. `processFundamentalQueue()` - 5 edges
5. `backfill()` - 5 edges
6. `initDB()` - 5 edges
7. `saveFundamentalsHistory()` - 5 edges
8. `StockDetail()` - 5 edges
9. `Sovereign Research Terminal v3` - 5 edges
10. `getUniverse()` - 4 edges

## Surprising Connections (you probably didn't know these)
- `processFundamentalQueue()` --calls--> `saveFundamentalsHistory()`  [EXTRACTED]
  server.ts → src/db.ts
- `startServer()` --calls--> `initDB()`  [EXTRACTED]
  server.ts → src/db.ts
- `processFundamentalQueue()` --calls--> `getFundamentalsCache()`  [EXTRACTED]
  server.ts → src/db.ts
- `processFundamentalQueue()` --calls--> `calculatePiotroskiFScore()`  [EXTRACTED]
  server.ts → src/lib/piotroski.ts
- `processFundamentalQueue()` --calls--> `saveFundamentalsCache()`  [EXTRACTED]
  server.ts → src/db.ts

## Communities (16 total, 1 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.16
Nodes (20): fundamentalQueue, QUOTE_CACHE, yahooFinance, addHolding(), addNote(), addTicker(), db, dbPath (+12 more)

### Community 1 - "Community 1"
Cohesion: 0.24
Nodes (8): DataContext, DataContextType, PriceAlert, StockData, VixData, MOCK_STOCKS, calculateNexusMatrix(), sigmoid()

### Community 2 - "Community 2"
Cohesion: 0.44
Nodes (6): Layout(), NavItem(), useAppEngine(), cn(), StockDetail(), Universe()

### Community 3 - "Community 3"
Cohesion: 0.22
Nodes (8): code:bash (npm install), code:bash (cp .env.example .env.local), code:bash (npm run dev), Key Features, Recent Improvements, Run Locally, Sovereign Research Terminal v3, Technologies Used

### Community 4 - "Community 4"
Cohesion: 0.39
Nodes (7): backfill(), yahooFinance, startServer(), getUniverse(), initDB(), saveFundamentalsHistory(), savePriceHistory()

### Community 5 - "Community 5"
Cohesion: 0.33
Nodes (4): AlertItemProps, Dashboard(), generateAlerts(), GeneratedAlert

### Community 6 - "Community 6"
Cohesion: 0.33
Nodes (3): DataProvider(), Backtest(), BacktestSnapshot

### Community 7 - "Community 7"
Cohesion: 0.47
Nodes (5): computeCAGR(), computeMarginTrends(), computeTrailingPEBand(), computeTrendsAndCAGR(), FundamentalRow

### Community 8 - "Community 8"
Cohesion: 0.33
Nodes (3): AnnualFundamentalPeriod, PiotroskiCriterion, PiotroskiResult

### Community 9 - "Community 9"
Cohesion: 0.47
Nodes (4): formatCurrency(), COLORS, Holding, Portfolio()

### Community 10 - "Community 10"
Cohesion: 0.47
Nodes (3): calculateDCF(), calculateReverseDCF(), FinancialsView()

### Community 11 - "Community 11"
Cohesion: 0.4
Nodes (4): ai, CopilotInputs, CopilotMemo, generateAiMemo()

### Community 12 - "Community 12"
Cohesion: 0.6
Nodes (3): evaluateCondition(), evaluateFormula(), Screener()

### Community 13 - "Community 13"
Cohesion: 0.5
Nodes (4): calculatePiotroskiFScore(), processFundamentalQueue(), getFundamentalsCache(), saveFundamentalsCache()

### Community 14 - "Community 14"
Cohesion: 0.5
Nodes (3): HoldingData, OptimizationMethod, optimizePortfolio()

## Knowledge Gaps
- **30 isolated node(s):** `yahooFinance`, `QUOTE_CACHE`, `fundamentalQueue`, `env`, `yahooFinance` (+25 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `MOCK_STOCKS` connect `Community 1` to `Community 0`?**
  _High betweenness centrality (0.202) - this node is a cross-community bridge._
- **Why does `useAppEngine()` connect `Community 2` to `Community 1`, `Community 5`, `Community 9`, `Community 10`, `Community 12`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **Why does `computeTrendsAndCAGR()` connect `Community 7` to `Community 0`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **What connects `yahooFinance`, `QUOTE_CACHE`, `fundamentalQueue` to the rest of the system?**
  _30 weakly-connected nodes found - possible documentation gaps or missing edges._