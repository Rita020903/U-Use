# U Use Architecture

This repository has two responsibilities:

1. Build and test the U Use MVP product.
2. Store ENT303TC course evidence and assessment materials.

To keep the project manageable, treat product files, course evidence, working drafts, and archive files as separate layers.

## Top-Level Map

```text
U-Use/
├── README.md                         # Product-facing overview for GitHub
├── ARCHITECTURE.md                   # This file
├── CLEANUP_PLAN.md                   # What can be archived or reorganized
├── PRD_V0.5_UUse物品使用平台版.md       # Product requirements and roadmap
├── xjtlu-market-app/                 # The actual MVP application
├── Evidence_Hub/                     # Formal course evidence and weekly outputs
├── 00_README_先看这个.md              # Course-facing navigation
├── 01_-29_*.md / *.csv               # Working drafts, planning files, templates
└── GITHUB_IMPORT_GUIDE.md            # One-time GitHub import note
```

## Product Layer

The product lives in `xjtlu-market-app/`.

```text
xjtlu-market-app/
├── app/
│   ├── page.tsx                      # Student app route
│   ├── admin/page.tsx                # Admin app route
│   ├── api/products/route.ts         # Item listing, publish, review status API
│   ├── api/bookings/route.ts         # Booking creation and status API
│   ├── api/reports/route.ts          # Report/dispute API
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── MarketClient.tsx              # Student-side product UI
│   └── AdminClient.tsx               # Admin-side operation UI
├── data/
│   ├── products.json                 # Current item data
│   ├── products.seed.json            # Reset seed for items
│   ├── bookings.json                 # Current booking records
│   ├── bookings.seed.json            # Reset seed for bookings
│   ├── reports.json                  # Current reports/disputes
│   └── reports.seed.json             # Reset seed for reports
├── lib/
│   ├── types.ts                      # Domain types
│   └── data.ts                       # Local JSON data access
├── scripts/reset-demo.mjs            # Restore demo data
└── supabase/schema.sql               # Future database schema draft
```

## Runtime Flow

Student flow:

```text
Discover item
  -> open item detail
  -> understand access mode / deposit / return rule
  -> send booking request
  -> booking is saved in data/bookings.json
```

Publisher flow:

```text
Publish item
  -> item is saved as 审核中
  -> admin reviews it
  -> approved item becomes 可用
  -> student side can browse it
```

Safety flow:

```text
Submit report
  -> report is saved in data/reports.json
  -> admin reviews and marks it 已处理
```

Admin flow:

```text
/admin
  -> load products, bookings, reports
  -> approve item listings
  -> advance booking status
  -> handle reports
```

## Domain Model

Current MVP objects:

| Object | File | Production equivalent |
|---|---|---|
| Product | `data/products.json` | `items` table |
| Booking | `data/bookings.json` | `bookings` table |
| Report | `data/reports.json` | `reports` table |
| ProductStatus | `lib/types.ts` | item lifecycle enum |
| BookingStatus | `lib/types.ts` | booking lifecycle enum |
| ReportStatus | `lib/types.ts` | report handling enum |

Important status flows:

```text
Product: 审核中 -> 可用 -> 已预约 / 使用中 / 已下架
Booking: 待确认 -> 已确认 -> 待归还 -> 已归还
Report: 待处理 -> 处理中 -> 已处理
```

## Course Evidence Layer

Formal course evidence belongs in `Evidence_Hub/`.

```text
Evidence_Hub/
├── 00_Team_Admin/                    # Team charter, roles, AI statement
├── 01_Weekly_Log/                    # Weekly log source text
├── Week_1/ ... Week_11-14/           # Weekly course outputs
├── Semester_2/                       # A3/A4 planning
└── Archive/                          # Old PRDs and legacy drafts
```

Rule of thumb:

- If a supervisor needs to inspect it, put it in `Evidence_Hub/`.
- If it is a draft or planning aid, keep it at root or move it to a future `docs/working/`.
- If it is historical and not the current product direction, keep it in `Evidence_Hub/Archive/`.

## Working Draft Layer

Root files named `01_` to `29_` are mostly working drafts, planning files, and course management notes.

They are useful, but they should not be treated as the single source of truth when a matching Evidence Hub file exists.

Examples:

| Working draft | Formal/current source |
|---|---|
| `18_TAM_SAM_SOM估算模板.md` | `Evidence_Hub/Week_3/W3_Market_Sizing_v1.md` and workbook |
| `06_竞品分析表.csv` | `Evidence_Hub/Week_3/W3_Competitor_Table_v1.*` |
| `19_研究设计与数据计划.md` | `Evidence_Hub/Week_4/W4_Research_Design_v1.md` |
| `04_用户访谈提纲.md` | `Evidence_Hub/Week_5/W05_访谈执行包_v1.md` |
| `05_问卷题目草稿.md` | `Evidence_Hub/Week_5/W05_问卷成品_v1.md` |

## Current Product State

The MVP is good enough for Week 4 pilot testing:

- Student-side browsing and booking works.
- Publishing creates an admin review item.
- Reports create an admin handling item.
- Admin can process product, booking, and report queues.
- `npm run reset` restores all demo data.
- `npm run build` passes.

It is not yet production-ready:

- Authentication is simulated.
- Data is local JSON, not cloud storage.
- No real payment or deposit escrow.
- No real image upload.
- No real messaging or notifications.
- No moderation or privacy policy has been implemented.

## Recommended Next Architecture Step

The next real architecture milestone is replacing local JSON with Supabase/Postgres while keeping the same domain model:

```text
products.json  -> items table
bookings.json  -> bookings table
reports.json   -> reports table
```

Do this only after Week 4/Week 5 validation confirms that students understand and want the borrow/rent/swap flow.
