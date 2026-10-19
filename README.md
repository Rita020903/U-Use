# U Use

U Use is a campus item-access application for XJTLU students across SIP and XEC (Taicang). Students can buy, borrow, rent, or permanently swap items. The application implements student-email verification, private accounts and bilateral transactions; deploying the actual database and email service remains a separate operational step.

## 组员先看这里

| 要做什么 | 唯一当前入口 |
| --- | --- |
| 找自己的分工、每周任务、模板和个人 ZIP | [七人任务包](Team_Work_Packs_20261007/README.md) |
| 看最新版 A1 六页 PPT、PDF、测算和待补清单 | [A1 当前交付（10 月 19 日视觉升级版）](A1_Current/README.md) |
| 修改 A2 脚本、A3 草稿和 A4 支持 | [后续作业资料](Final_Submission_20261006/START_HERE.md) |
| 看 15 份访谈的中文归纳 | [访谈润色稿](A1_Current/Research_Summaries.md) |
| 开发产品、运行检查或看部署配置 | [产品代码](xjtlu-market-app/README.md) |
| 看代码能否封版、实际验收范围和剩余上线条件 | [工程验收结论](xjtlu-market-app/RELEASE_ACCEPTANCE.md) |
| 学习访谈与统计记录方法 | [AI 合成练习](Team_Examples_SYNTHETIC_20261007/README.md)，不能当真实研究 |

更详细的交接说明见 [组员入口](00_README_先看这个.md)。旧分工、旧周计划和旧 PRD 已集中到 [历史归档](Evidence_Hub/Archive/README_Archive.md)，不再作为当前规范。独立分发包保留必要资料副本，不是无用途的重复文件。

## Current Coursework Package

[Seven individual work packs / 七人任务包](Team_Work_Packs_20261007/README.md) contains the roles confirmed on 7 October, calendar-aligned weekly task cards, independent personal folders and the assessment/submission tracker. It distinguishes plans, real evidence and synthetic training examples; none of its checklists claim that a portal submission has happened.

[Current A1 / 19 October 2026](A1_Current/README.md) contains the latest exact six-slide deck, matching PDF, editable pilot and concept model, claim-evidence map, interview summaries and remaining-input checklist. The deck reflects the scoped engineering acceptance of code `cbb28a6` and a feature freeze for real user validation. Rita reports approximately 430 students across the eight DTS classes. This cohort estimate is separate from the 80 planned invitations and two planned completions over four weeks. Recruitment permission and actual participation remain unconfirmed. The interview summaries remain unchanged from 18 October. This edition supersedes the A1 in the 6 October package and personal ZIP copies. The current teaching week is Week 6 (19–25 October).

The market context now uses **4,000+ XEC students**, as reported in a [May 2026 Xinhua Daily article hosted by XJTLU](https://www.xjtlu.edu.cn/zh/news/2026/05/xinhuaribao20zhounianxinwen). It is dated campus population context, not an October register or measured demand. The university-wide population is excluded from this XEC-first pilot denominator.

[6 October supporting package](Final_Submission_20261006/START_HERE.md) remains the preparation entry for the twelve-slide A3 draft, A2 recording script, venture dossier and seven individual A4 writing guides. It is reconciled with the supplied handbook, not proof of completed research or portal submission. The recorded video, personal reflections and submission receipts remain team responsibilities.

The project is not a generic second-hand marketplace. Its core idea is that students often need temporary access to an item without wanting to own it permanently. U Use turns that temporary use case into a structured product flow: verified identity, available time window, deposit rule, public handoff point, booking confirmation, return confirmation, and admin review.

## Product Vision

Our working hypothesis is that students using friends, WeChat groups or second-hand platforms may face coordination friction around dates, return responsibility and meeting places. The team has supplied fifteen interview summaries and reconfirmed their basis in team interviews. The [edited summaries](A1_Current/Research_Summaries.md) preserve conditional and negative responses. Underlying dates, consent and source records remain to be linked privately; the summaries do not establish representative demand or measured usability results.

U Use focuses on one sharper job:

> Help XJTLU students safely access a specific item for a specific time window, without forcing every need to become a purchase.

Typical use cases include calculators for exams, formal clothes for presentations, luggage for short trips, bicycles for campus travel, projectors for events, adapters, cameras, and activity equipment.

## Current Product

The current version implements the full transaction workflow, not a shared anonymous demonstration. Timetable imports are personal and format-tolerant, with mandatory review rather than a preset major, year or sample schedule. Engineering scope is not limited to a small pilot; marketing still must not claim proven demand, user numbers or high growth without evidence.

Student side:

- Find items available across the requested dates and post a time-bounded need with private matching offers, without GPS or timetable requirements.
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
- Export personal records, clear the timetable, and close an account using a dedicated email code after resolving active transactions; read the visible privacy and transaction rules.

Admin side:

- Review newly published items before they appear to students.
- Track transactions and arbitrate disputes; real handoffs are confirmed by participants, not the admin.
- Handle reports and disputes.
- Review actual item photos, status, transactions and reports from the configured database.
- Inspect scheduled-maintenance freshness and failed notification delivery, manually retry failed emails with an audit trail, and enforce durable failed-login limits.

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
├── A1_Current/                 # Latest six-slide A1 and supporting model
├── Team_Work_Packs_20261007/
├── Final_Submission_20261006/
├── Team_Examples_SYNTHETIC_20261007/
├── Evidence_Hub/                # Current team records and labelled historical archive
├── xjtlu-market-app/
└── .github/workflows/verify.yml
```

Important folders:

- `xjtlu-market-app/`: the actual Next.js application; deployment details are in its README and DEPLOYMENT.md.
- `ARCHITECTURE.md`: current application layers, ownership, storage, privacy and verification boundaries.
- `Team_Work_Packs_20261007/`: seven personal work packs and downloadable ZIPs, weekly tasks and submission tracking.
- `A1_Current/`: latest A1 PPT, PDF, model, interview paraphrases and progress checklist.
- `Final_Submission_20261006/`: A2/A3/A4 preparation and earlier supporting materials; its old A1 is superseded.
- `Team_Examples_SYNTHETIC_20261007/`: historical interview draft and labelled synthetic test exercises. Current interview paraphrases are separate from the 100-person fictional task data.
- `.github/workflows/verify.yml`: automated checks using an isolated PostgreSQL service, not the production database.
- `Evidence_Hub/`: current record templates and instructions for private evidence; historical planning documents are isolated under `Archive/`, not presented as completed research.
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

Formal evidence uses dated, versioned filenames and a private shared location when it contains personal information or submission receipts. Safe templates and status instructions live in `Evidence_Hub/`. Superseded working drafts, old week plans and old PRDs are explicitly labelled under `Evidence_Hub/Archive/`; the root no longer mixes them with current instructions.
