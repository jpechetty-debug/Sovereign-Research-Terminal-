# Graph Report - sovereign-research-terminal-v3  (2026-08-12)

## Corpus Check
- 28 files · ~23,978 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 129 nodes · 235 edges · 13 communities (12 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `76d3d6db`
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

## God Nodes (most connected - your core abstractions)
1. `useAppEngine()` - 15 edges
2. `formatCurrency()` - 9 edges
3. `cn()` - 8 edges
4. `Sovereign Research Terminal v3` - 7 edges
5. `processFundamentalQueue()` - 5 edges
6. `backfill()` - 5 edges
7. `initDB()` - 5 edges
8. `saveFundamentalsHistory()` - 5 edges
9. `StockDetail()` - 5 edges
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

## Communities (13 total, 1 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.14
Nodes (18): Layout(), NavItem(), RegimeBanner(), useAppEngine(), formatCurrency(), evaluateCondition(), evaluateFormula(), cn() (+10 more)

### Community 1 - "Community 1"
Cohesion: 0.16
Nodes (20): fundamentalQueue, QUOTE_CACHE, yahooFinance, addHolding(), addNote(), addTicker(), db, dbPath (+12 more)

### Community 2 - "Community 2"
Cohesion: 0.21
Nodes (9): DataContext, DataContextType, DataProvider(), PriceAlert, StockData, VixData, MOCK_STOCKS, calculateNexusMatrix() (+1 more)

### Community 3 - "Community 3"
Cohesion: 0.26
Nodes (7): FactorBreakdown(), calculateDCF(), calculateReverseDCF(), DecisionVerdict, FactorContribution, generateVerdict(), FinancialsView()

### Community 4 - "Community 4"
Cohesion: 0.18
Nodes (10): Architecture, code:bash (npm install), code:bash (cp .env.example .env.local), code:bash (npm run dev), Key Features, Recent Improvements, Run Locally, Sovereign Research Terminal v3 (+2 more)

### Community 5 - "Community 5"
Cohesion: 0.39
Nodes (7): backfill(), yahooFinance, startServer(), getUniverse(), initDB(), saveFundamentalsHistory(), savePriceHistory()

### Community 6 - "Community 6"
Cohesion: 0.47
Nodes (5): computeCAGR(), computeMarginTrends(), computeTrailingPEBand(), computeTrendsAndCAGR(), FundamentalRow

### Community 7 - "Community 7"
Cohesion: 0.33
Nodes (3): AnnualFundamentalPeriod, PiotroskiCriterion, PiotroskiResult

### Community 8 - "Community 8"
Cohesion: 0.4
Nodes (4): ai, CopilotInputs, CopilotMemo, generateAiMemo()

### Community 9 - "Community 9"
Cohesion: 0.4
Nodes (3): Backtest(), BacktestSnapshot, TopNMetrics

### Community 10 - "Community 10"
Cohesion: 0.5
Nodes (4): calculatePiotroskiFScore(), processFundamentalQueue(), getFundamentalsCache(), saveFundamentalsCache()

### Community 11 - "Community 11"
Cohesion: 0.5
Nodes (3): HoldingData, OptimizationMethod, optimizePortfolio()

## Knowledge Gaps
- **34 isolated node(s):** `yahooFinance`, `QUOTE_CACHE`, `fundamentalQueue`, `env`, `yahooFinance` (+29 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `MOCK_STOCKS` connect `Community 2` to `Community 1`?**
  _High betweenness centrality (0.200) - this node is a cross-community bridge._
- **Why does `useAppEngine()` connect `Community 0` to `Community 2`, `Community 3`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **Why does `computeTrendsAndCAGR()` connect `Community 6` to `Community 1`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **What connects `yahooFinance`, `QUOTE_CACHE`, `fundamentalQueue` to the rest of the system?**
  _34 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.14 - nodes in this community are weakly interconnected._