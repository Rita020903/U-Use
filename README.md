# U Use

U Use is a campus item-access platform for XJTLU students. It helps students buy, borrow, rent, or swap items inside a verified student community across the SIP and Taicang campuses.

The project is not a generic second-hand marketplace. Its core idea is that students often need temporary access to an item without wanting to own it permanently. U Use turns that temporary use case into a structured product flow: verified identity, available time window, deposit rule, public handoff point, booking confirmation, return confirmation, and admin review.

## Product Vision

Students currently solve short-term item needs through WeChat groups, friends, or second-hand platforms. These channels are fast but messy: posts disappear, trust is unclear, deposits are informal, return responsibility is vague, and cross-campus handoff is hard to coordinate.

U Use focuses on one sharper job:

> Help XJTLU students safely access a specific item for a specific time window, without forcing every need to become a purchase.

Typical use cases include calculators for exams, formal clothes for presentations, luggage for short trips, bicycles for campus travel, projectors for events, adapters, cameras, and activity equipment.

## Current MVP

The current version is a testable MVP built for ENT303TC validation and product iteration. It is still a local prototype, but it now models the key operational flows of a real product. The commercial story is intentionally conservative: U Use should first be tested as a small campus pilot, not presented as a proven high-growth marketplace.

Student side:

- Browse available items by campus, category, access mode, and keyword.
- Switch between SIP and Taicang campus contexts.
- View item details, deposit, availability, return rule, and handoff point.
- Publish an item for review.
- Send a booking request with handoff and return information.
- Submit a safety report.

Admin side:

- Review newly published items before they appear to students.
- Track active bookings and update booking status.
- Handle reports and disputes.
- See item status, booking records, and report queues from local data.

Data model:

- `products.json`: item listings and review status.
- `bookings.json`: booking records and use/return status.
- `reports.json`: safety reports and dispute handling status.

## Repository Structure

```text
ENT303TC/
├── README.md
├── TEAM_ROSTER_AND_DATA_POLICY.md
├── 00_README_先看这个.md
├── PRD_V0.5_UUse物品使用平台版.md
├── Evidence_Hub/
├── xjtlu-market-app/
└── 01_-29_*.md / *.csv
```

Important folders:

- `xjtlu-market-app/`: Next.js MVP app.
- `Evidence_Hub/`: formal course evidence, weekly outputs, logs, and validation records.
- `PRD_V0.5_UUse物品使用平台版.md`: product requirements and MVP roadmap.
- `TEAM_ROSTER_AND_DATA_POLICY.md`: team roster, naming convention, and rules for demo data vs. real evidence.
- `00_README_先看这个.md`: course-facing navigation and submission guide.

## Run Locally

```bash
cd xjtlu-market-app
npm install
npm run reset
npm run dev
```

Open:

```text
Student app: http://localhost:3000
Admin app:   http://localhost:3000/admin
```

Build check:

```bash
npm run build
```

Reset demo data:

```bash
npm run reset
```

This restores seed data for products, bookings, and reports.

## Tech Stack

- Next.js 14 App Router
- React
- TypeScript
- CSS
- lucide-react icons
- Local JSON files as a mock database

The MVP intentionally avoids adding a heavy backend too early. The current goal is to validate user behavior, trust concerns, and item-access demand before committing to a production architecture.

## Product Logic

U Use has four access modes:

- Buy: transfer ownership.
- Borrow: use temporarily without daily rent.
- Rent: short-term paid access.
- Swap: exchange access to another item.

The product is built around five operational objects:

- Student identity: currently simulated as verified XJTLU email.
- Item: availability, campus, handoff point, deposit, return rule.
- Booking: requester, owner, time, return time, status.
- Report: target, reason, note, handling status.
- Admin queue: review and dispute handling.

## Validation Focus

The next validation step is not to ask users whether the app is "good." The goal is to observe whether students can complete realistic tasks.

Pilot tasks:

1. Find an item they might need.
2. Understand deposit, availability, handoff point, and return rule.
3. Send a booking request.
4. Publish an item and understand why it needs review.
5. Look at the admin side and explain what the platform is managing.

Success signals:

- A user can find and request an item within 1 minute.
- A user notices the deposit and return rule without being prompted.
- A user can explain how U Use differs from Xianyu or WeChat groups.
- A user understands that public handoff points reduce trust and safety problems.

Marketing and rollout should stay small until these signals are observed. The recommended first audience is 20-30 survey respondents, 3-5 prototype testers, and a small seed inventory of low-risk items such as calculators, formal wear, luggage, adapters, and activity tools.

## Roadmap To A Real Product

Near term:

- Replace local JSON with Supabase/Postgres.
- Add XJTLU email verification or SSO.
- Add image upload for item photos and handoff evidence.
- Add booking status notifications.
- Add clearer owner/requester profiles and rating signals.

Before real operation:

- Define deposit and dispute rules.
- Decide whether deposits are platform-held or handled offline first.
- Add moderation rules for prohibited items.
- Add privacy and data retention policy.
- Test with a small campus group before wider launch.

## Data Policy

The app contains demo products, bookings, and reports for testing flows. These records are synthetic and can be edited freely. Course evidence is different: interviews, survey results, competitor screenshots, and user testing notes must be collected from real activity or clearly labelled as assumptions.

## Current Limitations

This is not yet a production service:

- No real authentication.
- No cloud database.
- No real payment or deposit escrow.
- No real messaging service.
- No image upload.
- No legal/compliance review.

For the ENT303TC project, the current positioning is:

> testable MVP + product evidence hub + validation workflow.

## Course Context

This repository also contains ENT303TC course materials, including weekly planning, evidence logs, market sizing, competitor analysis, research design, and assessment preparation.

Formal course evidence should be stored in `Evidence_Hub/` with versioned filenames. Working drafts and internal planning files live at the repository root.
