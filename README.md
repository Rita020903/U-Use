# U Use

U Use is a campus item-access application for XJTLU students across SIP and XEC (Taicang). Students can buy, borrow, rent, or permanently swap items. The application implements student-email verification, private accounts and bilateral transactions; deploying the actual database and email service remains a separate operational step.

## Current Coursework Package

[Seven individual work packs / 七人任务包](Team_Work_Packs_20261007/README.md) contains the roles confirmed on 7 October, calendar-aligned weekly task cards, independent personal folders and the assessment/submission tracker. It distinguishes plans, real evidence and synthetic training examples; none of its checklists claim that a portal submission has happened.

[Start here: 6 October 2026 package](Final_Submission_20261006/START_HERE.md) is the current course-facing entry point, reconciled with the supplied ENT303TC 2026/27 handbook. It contains the exact six-slide A1, twelve-slide A3, A2 recording script, venture dossier, editable cost model and seven individual A4 writing guides. Earlier pitches and numbered drafts remain historical; they are not the current submission specification. Real research, the recorded video, personal reflections and submission receipts remain team responsibilities.

The project is not a generic second-hand marketplace. Its core idea is that students often need temporary access to an item without wanting to own it permanently. U Use turns that temporary use case into a structured product flow: verified identity, available time window, deposit rule, public handoff point, booking confirmation, return confirmation, and admin review.

## Product Vision

Our working hypothesis is that students using friends, WeChat groups or second-hand platforms may face coordination friction around dates, return responsibility and meeting places. The existence and importance of that friction require authentic incident interviews and task tests; no completed participant study is claimed by the current package.

U Use focuses on one sharper job:

> Help XJTLU students safely access a specific item for a specific time window, without forcing every need to become a purchase.

Typical use cases include calculators for exams, formal clothes for presentations, luggage for short trips, bicycles for campus travel, projectors for events, adapters, cameras, and activity equipment.

## Current Product

The current version implements the full transaction workflow, not a shared anonymous demonstration. Timetable imports are personal and format-tolerant, with mandatory review rather than a preset major, year or sample schedule. Engineering scope is not limited to a small pilot; marketing still must not claim proven demand, user numbers or high growth without evidence.

Student side:

- Browse available items by campus, category, access mode, and keyword.
- Switch between SIP and XEC campus contexts.
- See their current browser location, opt in to approximate location sharing, and view nearby opt-in users on an interactive map.
- Switch to official campus diagrams and navigate to structured public handoff points.
- Import timetable screenshots or PDFs locally, review teaching weeks and room codes, and obtain date-specific handoff suggestions.
- Save and remove favorites in the current browser.
- View item details, deposit, availability, return rule, and handoff point.
- Publish an item for review.
- Send a booking request with handoff and return information.
- Submit a safety report.
- Sign in with a student-email code, manage personal listings and fees, and exchange transaction-only messages.
- Accept, reject or cancel requests; independently confirm physical handoff and return, and open a dispute.
- Review each imported class and set individual term dates, odd/even weeks, cancelled dates and makeup dates.

Admin side:

- Review newly published items before they appear to students.
- Track transactions and arbitrate disputes; real handoffs are confirmed by participants, not the admin.
- Handle reports and disputes.
- Review actual item photos, status, transactions and reports from the configured database.

Data model:

- Runtime: transactional SQLite on persistent local disk, or PostgreSQL for multiple instances.
- Private records: accounts, hashed sessions, personal timetables, photos, bookings, messages and notifications.
- Approximate opt-in location: server-side range filtering and independent page leases, expires within two minutes.
- JSON fixtures: explicit one-time legacy/demo imports only; no automatic availability-date changes.

## Repository Structure

```text
ENT303TC/
├── README.md
├── ARCHITECTURE.md
├── TEAM_ROSTER_AND_DATA_POLICY.md
├── 00_README_先看这个.md
├── PRD_V0.5_UUse物品使用平台版.md
├── Team_Work_Packs_20261007/
├── Final_Submission_20261006/
├── Team_Examples_SYNTHETIC_20261007/
├── Evidence_Hub/
├── xjtlu-market-app/
├── .github/workflows/verify.yml
└── 01_-29_*.md / *.csv
```

Important folders:

- `xjtlu-market-app/`: the actual Next.js application; deployment details are in its README and DEPLOYMENT.md.
- `ARCHITECTURE.md`: current application layers, ownership, storage, privacy and verification boundaries.
- `Team_Work_Packs_20261007/`: seven personal work packs and downloadable ZIPs, weekly tasks and submission tracking.
- `Final_Submission_20261006/`: current assessment drafts and supporting materials; not proof of submission.
- `Team_Examples_SYNTHETIC_20261007/`: labelled fictional interview and test examples for practice, never real research evidence.
- `.github/workflows/verify.yml`: automated checks using an isolated PostgreSQL service, not the production database.
- `Evidence_Hub/`: formal course evidence, weekly outputs, logs, and validation records.
- `PRD_V0.5_UUse物品使用平台版.md`: product requirements and MVP roadmap.
- `TEAM_ROSTER_AND_DATA_POLICY.md`: team roster, naming convention, and rules for demo data vs. real evidence.
- `00_README_先看这个.md`: course-facing navigation and submission guide.

## Run Locally

```bash
cd xjtlu-market-app
npm ci
cp .env.example .env.local
# Set ADMIN_PASSWORD in .env.local before opening the admin page.
npm run dev
```

Open:

```text
Student app: http://localhost:3000
Admin app:   http://localhost:3000/admin
```

Build check:

```bash
npm test
npm run build
npm run lint
```

Release checks on 7 October 2026 passed all five business regression groups, TypeScript checking, an isolated production build, production-mode API tests with temporary SQLite and simulated local SMTP, and the original npm lockfile audit (zero known vulnerabilities). [GitHub verification for product commit 232abe0](https://github.com/Rita020903/U-Use/actions/runs/37595952467) also passed a clean install and PostgreSQL integration tests. The seven work packs passed link, archive-content, calendar and submission-coverage checks. Real mail delivery, production database operation and deployed-device acceptance still require separate verification; these results do not establish zero defects or completed course submissions.

Optional isolated demo reset:

```bash
SQLITE_PATH=/private/path/demo.sqlite RESET_DEMO_CONFIRM=RESET_DEMO_ONLY npm run reset
```

This is disabled in production, with PostgreSQL, or when verified accounts are present. Never reset the working application to prepare a presentation.

## Tech Stack

- Next.js 15 App Router
- React
- TypeScript
- CSS
- lucide-react icons
- PostgreSQL / SQLite with transactional domain operations
- Student-email OTP, Nodemailer, Sharp photo processing and a durable notification outbox
- Leaflet / OpenStreetMap for interactive maps
- Tesseract.js / PDF.js for browser-local timetable imports

The backend now implements identity, ownership, persistent storage and transaction consistency. Product validation and adoption remain open research questions, independent of whether these features exist.

The admin username is `admin`; its password comes from `ADMIN_PASSWORD`. Guests can prepare private timetables, but only verified student accounts can transact. `AUTH_DELIVERY=local` is explicitly developer-only and is ignored in production. Real mail delivery requires SMTP credentials; production requires PostgreSQL or explicitly opted-in persistent single-machine SQLite. Payments and deposit escrow are not connected: all monetary confirmations record offline agreements. See the app README for privacy, maps and timetable boundaries.

## Product Logic

U Use has four access modes:

- Buy: transfer ownership.
- Borrow: use temporarily without daily rent.
- Rent: short-term paid access.
- Swap: permanently exchange ownership of two approved items.

The product is built around five operational objects:

- Student identity: a student-email verified account; anonymous visitors cannot transact.
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

Marketing claims must remain cautious until these signals are observed. Do not infer audience size, demand, conversion or revenue from synthetic inventory or working code. This does not restrict the application's functionality to a small test group.

## Roadmap To A Real Product

Near term:

- Configure and externally verify the PostgreSQL deployment and student-email SMTP delivery.
- Consider school-approved SSO if available; the current login uses verified student email.
- Test real-device map access and GPS in both campuses.
- Monitor photo storage, email retry health and transaction response times.
- Add clearer owner/requester profiles and rating signals.

Before real operation:

- Define deposit and dispute rules.
- Decide whether deposits are platform-held or handled offline first.
- Add moderation rules for prohibited items.
- Add privacy and data retention policy.
- Complete independent security, usability and real-device acceptance testing before opening to users.

## Data Policy

The app contains demo products, bookings, and reports for testing flows. These records are synthetic and can be edited freely. Course evidence is different: interviews, survey results, competitor screenshots, and user testing notes must be collected from real activity or clearly labelled as assumptions.

## Current Limitations

This is not yet a production service:

- Cloud database and SMTP credentials still need to be provisioned and validated.
- No real payment or deposit escrow.
- Messages and notifications currently poll; no external push-notification provider or video chat.
- Timetable OCR requires review and cannot promise perfect recognition of every layout.
- No legal/compliance review.

For the ENT303TC project, the current positioning is:

> implemented campus product + product evidence hub + validation workflow, with explicit deployment and operational prerequisites.

## Course Context

This repository also contains ENT303TC course materials, including weekly planning, evidence logs, market sizing, competitor analysis, research design, and assessment preparation.

Formal course evidence should be stored in `Evidence_Hub/` with versioned filenames. Working drafts and internal planning files live at the repository root.
