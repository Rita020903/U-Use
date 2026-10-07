# U Use Architecture

The repository contains the application in `xjtlu-market-app/` and course evidence in `Evidence_Hub/`. Course documents, working drafts and archives are not runtime product data. Synthetic application fixtures must never be treated as real interviews or usage evidence.

## Application Layers

```text
xjtlu-market-app/
  app/page.tsx                     Student application
  app/admin/page.tsx               Review and arbitration
  app/api/auth/                    Student-email OTP and logout
  app/api/session/                 Private identity/timetable
  app/api/products/                Browse, publish, review, own edits
  app/api/needs/                   Requests, own-item responses, moderation
  app/api/photos/                  Bounded EXIF-free uploads and access
  app/api/bookings/                Participant actions and fee snapshots
  app/api/messages/                Transaction-participant-only messages
  app/api/notifications/           Private inbox and outbox trigger
  app/api/recommendations/         Joint timetable/booking proposals
  app/api/presence/                Approximate range-limited page leases
  app/api/reports/                 Reports and admin handling
  app/api/maintenance/             Authenticated expiry, retry, cleanup
  components/                      Responsive workflows and maps
  lib/database.ts                  SQLite/PostgreSQL transactions, migration
  lib/people.ts                    Hashed sessions and account requirements
  lib/data.ts                      Transactional domain operations
  lib/booking-rules.ts              Occupancy, travel conflicts, role actions
  lib/product-input.ts             Publish contract validation
  lib/availability.ts              Date search with live occupancy
  lib/needs.ts                     Shared need eligibility and private offers
  lib/submissions.ts               Transactional account-scoped retry deduplication
  lib/booking-times.ts             Strict calendar/timezone parsing
  lib/messages.ts                  Participant checks, cursor history, retry-safe send
  lib/message-order.ts             Stable message ordering and client merging
  lib/client-poll.ts               Completion-based serial polling
  lib/client-session.ts            Single-flight identity and cross-tab invalidation
  lib/client-fetch.ts              Request/body deadline without automatic retries
  lib/client-drafts.ts             Validated local draft recovery and submission keys
  lib/timetable*.ts                Generic local extraction and date model
  lib/matching.ts                  Joint handoff and return suggestions
  lib/notifications.ts             Durable inbox/outbox
  lib/notification-history.ts      Owner-scoped stable history and unread counts
  lib/notification-order.ts        Client deduplication and sticky read state
  lib/places.ts                    Confirmable campus/public points
  middleware.ts                    Admin boundary and cross-origin writes
  scripts/                         Tests, local assets, safe backup/reset
  data/*.json                      Explicit legacy import fixtures only
  data/private/                    Ignored local SQLite/legacy private files
```

## Storage

Runtime uses `uuse_records(kind,id,payload)` with a composite primary key. The application maintains ownership and business invariants inside transactions, not an unused future schema or claimed RLS policy. SQLite uses WAL, full synchronous durability, a shared per-process queue and database locks across processes. PostgreSQL uses one connection per transaction and an advisory transaction lock across application instances. This conservative shared lock prioritises correctness; narrowing it requires concurrent load tests, not removing it casually.

Record kinds include people, email account indices, hashed sessions, OTP challenges, products, photos, bookings, needs, need-offers, submissions, messages, notifications, outbox, reports, audit and ephemeral limits/presence. Submission records map an account-scoped request key and normalized input hash to the original listing/request, inside the same transaction as creation. Photos are transformed WebP records. OTPs are HMAC-hashed; raw session tokens live only in HttpOnly cookies. Private data is never committed.

`MIGRATE_LEGACY=true` imports existing JSON and private timetables exactly once. `SEED_DEMO=true` imports labelled fictional fixtures. Otherwise an empty database is used. Existing availability dates do not move. `supabase/schema.sql` is a historical, disconnected draft and is not the current migration.

## Workflows

1. A guest can browse or prepare a private timetable; student email verification upgrades or creates their own account and rotates the session token.
2. An owner uploads photos and selects a public handoff place (map pin optional), submits a listing, then an administrator reviews it.
3. A buyer confirms a server-computed fee quote and requests a handoff and, where needed, return. The transaction checks identity, dates, product occupancy, both participants' schedules and other meetings, plus an offered item for swaps.
4. The owner accepts or rejects; pending requests expire by the earlier of 24 hours and handoff time. Both parties separately confirm physical handoff. Buy/swap closes and withdraws both relevant listings; borrow/rent proceeds to mutual return confirmation.
5. Messages and notifications are restricted to the participants. SMTP delivery uses a durable outbox and retries without discarding the in-app notice. Payments are offline agreement records, not escrow.
6. Disputes lock the transaction for arbitration. Admin decisions produce an audit record; administrators do not simulate students' physical confirmations.
7. Date search and the needs board work without GPS or timetables. A request specifies dates, mode and optional budget. Responses must use the responder's own approved matching item; offer visibility is restricted to the requester and responder. Availability is checked again from current bookings, and a recommendation does not reserve stock.

## Client Recovery

Account changes invalidate pending identity results, unmount private workflows and notify other tabs through BroadcastChannel; focus revalidation covers missed changes. Favorites and drafts are account-scoped. Local storage failure cannot prevent a successful server logout or turn a successful publish/timetable save into a misleading submission failure.

Business requests have a 30-second deadline covering the response body and never automatically retry mutations. Listing/request submission keys survive a saved draft and remain stable for identical input. Booking uncertainty directs the student to verify their transaction history. Pagination uses raw page offsets and preserves loaded items after an append failure. A shared native HTML dialog handles confirmation, cancellation, keyboard focus and account-change cancellation. Error and not-found pages provide recovery navigation.

Private requests pin the rendered account through `X-UUse-Account`; the server compares it with the authenticated cookie and rejects stale-tab actions with `409 ACCOUNT_CHANGED`. This header is an identity consistency check, not authentication. Booking and message creation share account-scoped transactional deduplication. Replayed bookings return current status after expiry processing; message retries generate no extra notification. Messages use timestamp-and-ID cursors, merge by ID, retain reading position and preserve local per-account/per-booking drafts. Sending success is not invalidated by a failed follow-up refresh. Polling waits for completion and skips active manual refreshes; booking refreshes retain mounted conversations. Notification reads return the exact IDs marked by the transaction. Timetable load failure exposes retry without enabling empty edits.

## Timetables And Location

Notification history uses a timestamp-and-ID cursor, with `X-Has-More`, `X-Oldest-Notification` and `X-Unread-Count` response metadata. The unread count covers the complete account inbox, not just the first page. Read mutations return exact affected IDs and the transactional unread count; the client guards against a pre-mutation poll overwriting that newer count. Invalid week-view dates yield a prompt instead of a date conversion exception.

The importer has no prescribed major, year, course count or semester date. It extracts screenshot/PDF/text courses locally, exposes uncertain fields and requires individual review. Every account owns its term start/end, weekly rules, odd/even weeks, cancellation and makeup dates. Recommendations check both handoff and return; missing timetable coverage is not treated as free time.

Precise GPS is not sent to the U Use backend. Maps default to collapsed/unmounted; GPS and sharing are separate opt-ins. Opening a map contacts the external tile provider, whose requests can reveal the viewed area. Approximate opt-in locations use independently revocable page leases, a 2-minute TTL and server-side campus/5-km range filters. Public item map pins are explicitly chosen handoff points, not fabricated GPS readings. Room codes are retained as source codes and not silently converted into invented building entrances.

## Verification And Operations

`npm test` covers pure/domain behavior and multi-process SQLite locking; `test:api` uses three private accounts, production mode and local SMTP transport. `test:postgres` requires a dedicated empty database; GitHub Actions provides a separate PostgreSQL service. The local sandbox prevents PostgreSQL shared-memory startup, so external PostgreSQL acceptance remains explicitly unverified until that workflow runs.

Recovery tests include stale identities, cross-tab invalidation without rebroadcast loops, body timeout, cancellation, corrupted drafts, scoped cleanup, concurrent publish deduplication, live need eligibility and flexible buy delivery windows. Isolated browser QA uses `127.0.0.1`, not `localhost`, to protect the user's cookie; 360/390-pixel layouts, draft recovery, publishing, keyboard cancellation and two-tab logout have been exercised. These checks do not prove permanent absence of bugs or actual campus adoption.

Production requires HTTPS, real SMTP, dedicated database credentials, backup/restore drills, scheduled maintenance and independent security/operational review. See `xjtlu-market-app/DEPLOYMENT.md`. Course evidence remains in `Evidence_Hub/`; working drafts and historical materials retain their existing ownership and locations.
