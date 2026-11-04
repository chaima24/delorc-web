# Tenant dashboard: content spec (v1 proposal)

KPIs follow the business rules written below (agreed with the product owner on 2026-10-21).
Mockups: [`dashboard-mockups/`](dashboard-mockups/), with the web page in `Main.dc.html` and the phone version in `Mobile.dc.html`.

## Scope and roles

- **One dashboard page.** Data is **scoped by hierarchy**: a rep sees themself, a supervisor their team, national/directors their subtree, admin and SFE everything.
- **Management control:** gets the Orders tab by default. In the old app it had an empty page.
- **Central console:** not concerned.

## Filters (one row above everything)

- **Period:** Today | This week | Current cycle | Custom range.
- **Team** (business line), **Region**, **Wilaya**, **Rep**.
- **Customer type:** All | Doctors | Pharmacies.
- The scope chip shows what the user can see, e.g. "your team, Centre region (9 reps)".

## Tabs

Overview (v1) · Field activity · Coverage · Orders · Sync · Coaching · SFE scores.

## Overview: KPI tiles

| Tile | Formula | Old source |
|---|---|---|
| Visits done | valid visits in the period; trend vs previous working day (Fri/Sat skipped); split doctors / pharmacies | `getStatVisite` |
| Call rate | valid visits / active reps / working days; compared with the objective (territory obj. doctors + pharmacies) | `getStatVisite`, `getScoreCard` |
| Realised / objective | valid visits / planned (or daily objective) × 100 | `getDashboardRO` |
| Cycle coverage | distinct visited cycle targets / distinct cycle targets (current cycle); goal 90% | `getKpiCouvertureBrick`, `getCouvertureFieldForce` |
| Orders | order count and Σ total excl. VAT (DZD); units = Σ quantities; trend vs previous working day | `getStatVisite` (orders part) |
| e-ADV used | visits with e-ADV / valid visits; average slide time | SFE stats, `IADVFLSM` |

## Overview: charts and lists

1. **Visits per rep per day**, last 5 working days, with the objective line (`getDashboardRO`, "Daily Call Evolution"). Single series: cobalt bars, today's bar darker.
2. **Coverage by wilaya**, a ranked bar list with a 90% goal tick, plus a "Map view" link (old jqvmap). Source `getKpiCouvertureBrick`.
3. **Performance by rep**, table: Rep (+ role and sector), Planned, Done, Realised/objective (bar), Coverage, Sync status. Default sort is the weakest R/O first (proposal). Source `getDashboardCall`.
4. **Coverage by segment** (A/B/C/D): visited targets in the segment / targets in the segment (`cycle_target` segment).
5. **Mobile sync today:** synced 2+ times / once / never (`getDashboardSynchronisation`). Status is always shown as icon + word + color.

## Later tabs (from the old app)

- **Field activity:** visit history charts and list (status, specialty, segment, sector filters), Excel export.
- **Coverage:** by region/FLSM, rep, specialty, sector, segment, brick.
- **Orders:** objective vs done, completion rate, orders by rep/region/brick/specialty, quantity by product.
- **Coaching:** coach days vs target, coaching by status, by supervisor, by rep.
- **SFE scores:** time in field, call rate %, call performance, productive calls (over/under/missed), share of voice, contribution by specialty.

## API (to build in delorc-api)

`GET /api/v1/dashboard/overview?period=today|week|cycle|custom&from=&to=&team=&region=&wilaya=&user=&customer_type=all|doctors|pharmacies`. It needs the permission `dashboard.show` (managers) or the role admin.

It returns raw counts, and the page computes the percentages: `period`, `scope`, `filter_options`, `kpis` (visits, call_rate, ro, coverage, orders, eadv), `daily_calls`, `daily_objective`, `coverage_by_wilaya`, `coverage_by_segment`, `reps[]` and `sync`.

Rules, agreed with the product owner on 2026-10-21:

- **Scope:** you see yourself plus your subtree in `manager_user` (dates respected). admin and coordinator see everyone. product_manager also sees every member of their active teams.
- **Rep:** a visible user with a cycle overlapping the period.
- **Visits:** done = `completed`. Planned = completed, planned, pending, in progress or no-show.
  - Doctors include HCOs and untyped HCPs; pharmacies are HCPs of type `pharmacie`.
  - Geography filters apply to the visited customer's commune.
- **Weekend:** set per lab in `tenants.weekend_days` (default Friday + Saturday). It is used for trends, the call rate and cycle objectives.
- **Call rate:** done / reps / working days. The objective is `objectives.doctor + business` from the rep's cycle.
- **Coverage:** targets of the latest cycle in the period that have a completed visit in that cycle. The goal is 90%.
- **Orders:** `orders.user_id`, the rep who took the order, set on create. Orders taken before that column existed show only to users who see everyone.
- **Sync:** the mobile app posts `POST /api/v1/device-syncs` after each sync. Reps with 2 or more syncs that day are ok, 1 is "once", 0 is "none".
- **Trend:** today is compared with the previous working day, the week with the previous week, a custom range with the same length just before it. The current cycle has no trend.

## Colors for charts (validated)

- **Single series:** cobalt `#2F54EB` (lighter steps `#6A83EE`).
- **Doctors vs pharmacies:** cobalt `#2F54EB` / teal `#0F9D8A`. This pair passes the colour-blindness and contrast checks.
- **Status colors:** ink (ok), amber `#B45309` (warning), brick `#C0362C` (critical). Always paired with an icon and a word.
- **Signal lime is never used for data,** only for actions and active state.
