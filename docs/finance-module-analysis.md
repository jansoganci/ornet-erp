# Finance Module Analysis - Ornet ERP

## Document Purpose
This document analyzes the current financial tracking system used by the client (a Turkish security/alarm company) and outlines requirements for integrating a finance module into the Mornet ERP system.

---

## 1. Current System - Excel-Based Manual Tracking

### Overview
The client currently uses a manual Excel-based system to track all financial operations. This is a primitive but functional method that has been used for years.

### What is Being Tracked

**Income/Revenue:**
- Sales transactions (equipment, installation)
- Monthly subscription fees (recurring revenue)
- Service charges

**Expenses/Costs:**
- Cost of Goods Sold (COGS) - materials, equipment purchased
- Labor costs for installations
- Operational expenses

**Tax Tracking:**
- Input VAT (Purchase VAT) - 20%
- Output VAT (Sales VAT) - 20%
- Net VAT payable calculation

**Purchase VAT (Input VAT) - OPTIONAL:**
- Can be 20% (official purchase with invoice)
- Can be 0% (unofficial purchase, no invoice, cash, gray market)
- Many expenses in current Excel show Input VAT = 0
- Common in Turkish SMB reality (gayrıresmi muhasebe)

**Payment Methods:**
- Cash (nakit/elden)
- Bank transfer (havale)
- Credit card

### Excel Structure

Current monthly tracking format:

```
MONTHLY PROFIT STATUS - SECURITY
DECEMBER 2025
ROW | DATE | CUSTOMER | PAYMENT | JOB TYPE | COST | INPUT VAT | SALES | SALES VAT | TOTAL | PROFIT | VAT
9 | 12/12/25 | OMER YONDER | SERVICE | BATTERY REPL. | 500 | 0.00 | 1500 | 300 | 1800 | 1000 | 300
```

**Calculation Logic:**
- Cost (COGS): 500 TL
- Sales: 1500 TL
- Sales VAT (20%): 300 TL
- Total Collection: 1800 TL
- Profit: 1500 - 500 = 1000 TL
- VAT Payable: 300 TL (no input VAT to deduct)

### Current Workflow

1. **Revenue Recording:**
   - Manual entry of each sale/service in Excel
   - Tracks customer name, job type, amounts
   - Calculates VAT and profit per transaction

2. **Expense Tracking:**
   - Records material purchases and costs
   - Tracks input VAT (often zero for unofficial purchases)
   - Manual categorization

3. **Credit Card Reconciliation:**
   - Downloads PDF bank statements monthly
   - Reads line-by-line from screen
   - Manually verifies customer payments
   - Checks if correct amounts were received
   - Re-enters data into Excel

4. **Bank Account Monitoring:**
   - Manual tracking of incoming payments
   - Verification against invoices
   - Primitive reconciliation

5. **VAT Calculation:**
   - Monthly sum of sales VAT
   - Monthly sum of input VAT
   - Net VAT payable = Sales VAT - Input VAT
   - Estimation of monthly net profit after taxes

### Current Pain Points

**Critical Issues:**

1. **Data Duplication:**
   - Information entered multiple times (bank statement → Excel)
   - Same expense recorded twice (first in credit card check, then in Excel)

2. **Manual Reconciliation:**
   - Every customer payment verified manually
   - Credit card statements checked line-by-line
   - High risk of human error

3. **No System Integration:**
   - Paraşüt (e-invoice platform) used separately
   - No connection between Excel and Paraşüt
   - Double data entry

4. **Lack of Automation:**
   - No automatic calculations
   - No automatic bank reconciliation
   - No automatic VAT computation

5. **No Historical Analysis:**
   - Difficult to compare months/years
   - No trend analysis
   - No customer profitability tracking

6. **Currency Management:**
   - Pricing in USD
   - Manual conversion to TRY at invoice time
   - No systematic exchange rate tracking
   - **No currency system in current ERP**

### Accounting System Context

**Turkish Dual Accounting Reality:**

The client operates in a mixed accounting environment common in Turkish SMBs:

- **Official Accounting (Resmi Muhasebe):**
  - Sales are invoiced through Paraşüt
  - e-Fatura (B2B electronic invoices)
  - e-Arşiv (B2C electronic invoices)
  - VAT is collected and reported

- **Unofficial Accounting (Gayrıresmi Muhasebe):**
  - Some expenses have no input VAT (Input VAT = 0)
  - Cash purchases without receipts
  - Tracking for internal management only
  - Not reported to tax authorities

**Current Tax Process:**
- Excel is for **internal tracking only**
- Not sent to accountant
- Paraşüt invoices sent to accountant
- Accountant prepares VAT returns
- Client doesn't know how VAT returns are prepared

---

## 2. Requirements - What Needs to Be Built

### Core Financial Module Requirements

**1. Income/Revenue Management**

- Track all revenue sources:
  - Sales (one-time)
  - Monthly subscriptions (recurring)
  - Service charges
  
- Features needed:
  - Revenue by customer
  - Revenue by period (daily, monthly, yearly)
  - Revenue by category (sales, subscriptions, services)
  - Payment method tracking
  - Currency support (USD/TRY)

**2. Expense/Cost Management**

- Track all business expenses:
  - Material costs (COGS)
  - Operational expenses
  - Labor costs
  - Fixed costs
  
- Features needed:
  - Expense categorization
  - Supplier tracking
  - Input VAT tracking
  - Official vs unofficial expense tagging
  - Bulk expense recording

**3. VAT Management System**

**Requirements:**
- Automatic VAT calculation
- Input VAT vs Output VAT tracking
- Net VAT payable computation
- VAT rate: 20% (standard, fixed)
- Separate tracking for:
  - Purchases with VAT (official)
  - Purchases without VAT (unofficial)
  - Sales with VAT (always official)

**Input VAT Handling:**
- Input VAT is OPTIONAL (can be 0 or 20%)
- User must specify: "Official invoice exists?"
  - YES → Input VAT = 20%
  - NO → Input VAT = 0%
- System tracks both scenarios
- Net VAT calculation adjusts automatically

**Calculation Examples:**

With Input VAT (Official):
- Cost: 1000 TL + Input VAT 200 TL = 1200 TL total
- Sales: 2000 TL + Output VAT 400 TL = 2400 TL total
- Net VAT Payable: 400 - 200 = 200 TL

Without Input VAT (Unofficial):
- Cost: 1000 TL + Input VAT 0 TL = 1000 TL total
- Sales: 2000 TL + Output VAT 400 TL = 2400 TL total
- Net VAT Payable: 400 - 0 = 400 TL (full amount)

**Calculation:**
```
Net VAT Payable = Sales VAT - Input VAT
```

**4. Currency System (CRITICAL - Currently Missing)**

**Default Currency: USD**
- All pricing in USD by default
- Exception: Subscriptions in TRY
- User can switch to TRY when needed

**Exchange Rate System:**
- Daily TCMB (Central Bank of Turkey) rates
- New table: `exchange_rates`
- Fields: currency, buy_rate, sell_rate, rate_date
- Automatic daily updates via TCMB API
- Historical rate storage

**Invoice Currency Conversion:**
- Price set in USD
- At invoice time: convert to TRY using previous day's closing SELL rate
- If invoice date: February 8 (Saturday, markets closed)
- Use: February 7 closing sell rate
- Add VAT in TRY
- Send to Paraşüt

**Example:**
```
Sale Price: $500
TCMB Rate (Feb 7, 2026): 45.50 TRY (sell)
Base Amount: 22,750 TRY
VAT (20%): 4,550 TRY
Invoice Total: 27,300 TRY
```

**5. Paraşüt Integration (Planned)**

**Goal: Automatic invoice generation**

Flow:
```
ERP Sale/Subscription
→ Calculate in USD
→ Convert to TRY (TCMB rate)
→ Add VAT (20%)
→ Send to Paraşüt API
→ Paraşüt generates e-Fatura/e-Arşiv
→ Paraşüt sends to customer
→ Record in ERP
```

**Scope:**
- Phase 1: Subscription invoices (monthly recurring)
- Phase 2: Sales invoices (one-time sales)

**6. Bank/Credit Card Integration**

**Phase 1: Manual (MVP)**
- PDF upload feature
- User views transactions
- Manual selection:
  - "This is business expense" → System
  - "This is personal" → Skip
- System records selected expenses

**Phase 2: Semi-Automated (Iteration)**
- PDF parsing (OCR or pattern recognition)
- Identify bank statement format standard
- Auto-categorize based on merchant
- Mapping system:
```
"TURKCELL" → Communication expense
"SHELL" → Fuel expense
"MIGROS" → Personal (skip)
```
- User approval → System records

**Goal: Minimize manual intervention**

**7. Profit/Loss Analysis**

**Monthly P&L Statement:**
```
Revenue
Sales: XXX TRY
Subscriptions: XXX TRY
Services: XXX TRY
Total Revenue: XXX TRY
Cost of Goods Sold (COGS): XXX TRY
Gross Profit: XXX TRY
Operating Expenses: XXX TRY
EBITDA: XXX TRY
Taxes (VAT): XXX TRY
Net Profit: XXX TRY
```

**Features:**
- Monthly comparison (this month vs last month)
- Yearly comparison
- Customer profitability analysis
- Visual charts/graphs
- Export to Excel

**8. Cash Flow Tracking**

- Bank account balances
- Cash on hand
- Accounts receivable (unpaid invoices)
- Accounts payable (unpaid expenses)
- Real-time cash flow visualization

**9. Reporting & Analytics**

- Revenue trends (monthly, yearly)
- Expense breakdown by category
- Customer profitability ranking
- VAT summary reports
- Cash flow projections
- Export all reports to Excel

---

## 3. Additional Context & Learnings

### TCMB Exchange Rate API

**Discovery:** Official Turkish Central Bank API exists and is FREE [web:32][web:38]

**API Endpoint:**
```
https://evds2.tcmb.gov.tr/service/evds/
series=TP.DK.USD.S.YTL
&startDate=01-01-2026
&endDate=08-02-2026
&type=json
&key=YOUR_API_KEY
```

**Features:**
- Daily USD, EUR, GBP, CHF rates
- Buy/Sell rates separately
- Historical data query
- JSON response
- Free (requires API key registration)

**Alternative:** İş Bankası API (uses TCMB data) [web:31]

### Turkish SMB Financial Tracking Research

**Common pain points found in forums/blogs:** [web:41][web:43][web:45][web:48]

1. Manual Excel tracking (extremely common)
2. Scattered data (multiple banks, POS reports, checks)
3. Delayed collections → cash flow problems
4. Duplication (ERP invoices + Excel tracking)
5. Manual credit card reconciliation (exactly this client's issue)

**SMB Needs:** [web:42][web:45]

1. Income/expense tracking (single dashboard)
2. Profit/loss analysis (monthly, yearly)
3. Automatic VAT calculation
4. Cash flow monitoring (bank, cash, receivables/payables)
5. Automatic reporting (Excel export)
6. Customer profitability analysis

**Best Practices:** [web:43][web:46]

- Cloud-based (access from anywhere)
- Automatic e-invoice integration (Paraşüt, etc.)
- One-click reports (P&L, cash flow)
- Visual charts (trend analysis)
- Period comparison (this month vs last month)

### Sales Module (Phase 2 - Not Yet Built)

**Planned workflow:**
```
Create Quote (USD-based pricing)
Quote Approval
Installation/Setup (work order)
Invoice Generation:
Previous day's TCMB sell rate
Convert USD → TRY
Add VAT (20%)
Send to Paraşüt
Paraşüt generates e-invoice
Send to customer
```

**Status:** Foundation modules first, sales module later

### Development Philosophy

**"Think Fast, Iterate Faster" + Steve Jobs Perfection**

Core principles:
1. ✅ Build MVP quickly
2. ✅ Test with real users
3. ✅ Iterate based on feedback
4. ✅ Don't over-engineer
5. ✅ But maintain quality standards
6. ✅ Simple, elegant solutions
7. ✅ Minimal manual intervention

**Example: Credit Card Integration**
- Phase 1: Manual PDF upload + selection (simple, works)
- Phase 2: Auto-parsing + mapping (iterate after learning patterns)
- NOT: Complex ML-based OCR from day 1 (over-engineering)

---

## 4. Executive Summary

### Current State

The client uses a **primitive Excel-based system** for financial tracking with severe limitations:

- ❌ 100% manual data entry
- ❌ No system integration (ERP, Paraşüt, banks separate)
- ❌ High risk of human error
- ❌ Time-consuming reconciliation
- ❌ No historical analysis or trends
- ❌ No currency management system
- ❌ Data duplication across systems

### Key Requirements

**Finance Module Must Include:**

1. **Revenue/Expense Tracking** - Single source of truth for all financial data
2. **VAT Management** - Automatic calculation, official/unofficial separation
3. **Currency System** - USD default, TCMB API integration, historical rates
4. **Paraşüt Integration** - Automatic invoice generation and sync
5. **Bank Integration** - Start manual, iterate to semi-automatic
6. **P&L Analysis** - Monthly reports, trends, customer profitability
7. **Cash Flow Monitoring** - Real-time visibility into liquidity

### Critical Technical Needs

**1. Exchange Rate System (NEW)**
- Table: `exchange_rates`
- Daily TCMB API sync
- Previous day's closing rate for invoicing
- Historical rate storage

**2. Currency Field (ALL financial tables)**
- Default: USD
- User-selectable: USD/TRY
- Subscriptions: TRY default
- Sales/Quotes: USD default

**3. Paraşüt API Integration**
- Automatic invoice push
- e-Fatura/e-Arşiv generation
- Status sync back to ERP

### Development Approach

**Phase 1 (MVP):**
- Income/expense manual recording
- VAT calculation
- Basic P&L reports
- Currency support + TCMB API
- Manual bank reconciliation

**Phase 2 (Iteration 1):**
- Paraşüt API integration
- Semi-automatic bank parsing
- Advanced analytics
- Customer profitability

**Phase 3 (Future):**
- Sales module with quote generation
- Predictive analytics
- Full automation

**Philosophy:** Simple, working solution first. Add complexity through iterations based on real usage patterns.

### Success Criteria

✅ Replace Excel completely  
✅ Eliminate manual data entry  
✅ Accurate VAT calculations  
✅ Automatic currency conversion  
✅ Paraşüt integration working  
✅ 80% reduction in reconciliation time  
✅ Real-time financial visibility  

---

**Document Version:** 1.0  
**Date:** February 8, 2026  
**Status:** Requirements Analysis Complete - Ready for Design Phase
