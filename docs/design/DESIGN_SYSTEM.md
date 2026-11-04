# Delorc — Design System (Option A · Pine & Signal)

Chosen on 2026-10-21. This is the reference for redesigning the tenant app.
The original canvas was deleted on 2026-10-21. This folder is now the source of truth.
Local mockup sources: [`option-a-mockups/`](option-a-mockups/) (`.dc.html` files, readable as HTML).

---

## 1. Product

Delorc is a multi-tenant platform sold to pharmaceutical manufacturers (Inphamedis, Magpharm, Scipharma, Dermatech, Higeen, Innoskin…). Each lab is a tenant.

- **Users inside a lab:**
  - **Field reps (VM / VP):** plan their cycle, visit HCPs and HCOs, show e-ADV slides, hand out samples, take orders.
  - **Managers:** supervisors, KAMs, directors, product managers and management control. They set targets, validate work, coach reps, run campaigns and track competitors.
- **Central console:** the platform admin manages labs, features and translations. *Out of scope for now: do not redesign yet.*
- **KPIs and scorecards** come in a later phase.

## 2. Brand

- **Name:** `delorc` (lowercase wordmark). Arabic: `ديلورش`.
- **Origin of the name:** from *délégué médical*; Latin for "I send out".
- **Logo:** a "D" drawn as a round. The rep leaves from the dot, makes the tournée and comes back.
  - Files: [`logo/delorc-mark.svg`](logo/delorc-mark.svg) and [`logo/delorc-app-icon.svg`](logo/delorc-app-icon.svg).
  - Path: `M15 28 V13 H23 A11 11 0 0 1 23 35 H21`, with a dot at `(15,35) r3.2`, on a 48×48 tile with `rx 14`.
  - The stroke and dot are always Signal lime. The tile is Pine ink, or `#1B302C` when it sits on Pine.
- **Tagline:** "The field suite for pharmaceutical labs."

## 3. Color tokens

| Token | Light | Use |
|---|---|---|
| `ink` | `#0F1F1C` | Main text, left rail, dark cards, primary dark surfaces |
| `ink-2` | `#1B302C` | Raised surfaces on ink, logo tile, bar tracks |
| `signal` | `#C8F03C` | **Fills only**: main CTA, active nav item, live status. Text on it is always `ink`. Never use it as text on white. |
| `signal-soft` | `#F4FBE0` | Selected row, success callout background |
| `cobalt` | `#2F54EB` | Links, data, info chips, avatars |
| `mist` | `#F2F4F1` | Page background |
| `surface` | `#FFFFFF` | Cards and panels |
| `line` | `#DCE3DF` | Borders. Row dividers use `#EDF1EF`. |
| `muted` | `#5B6B66` | Secondary text (passes 4.5:1 on white) |
| `muted-2` | `#44544F` | Body text on white |
| `on-ink-muted` | `#A9BBB5` / `#C9D6D1` | Secondary text on ink |
| `amber` | `#B45309` | Pending / warning text |
| `brick` | `#C0362C` | Rejected / error |

**Dark mode (proposal, to validate):** background `#0B1513`, surface `#13221F`, line `#24372F`, text `#E8EEEA`, muted `#9DB0AA`. `signal` and `cobalt` stay the same; cobalt text lightens to `#7B93FF`.

## 4. Typography

- **Display:** *Bricolage Grotesque*, weights 600 and 800. Used for titles, big numbers and the wordmark. Tight letter-spacing (`-0.02em` to `-0.04em`).
- **UI and body:** *IBM Plex Sans Arabic*, weights 400, 500, 600 and 700. One family covers both Latin and Arabic.
- **Scale (px):** 12 · 13 · 14 · 15 · 16 · 18 · 24 · 28 · 44 · 64.
  - Body text is 14 to 15.
  - Page titles are 44 (28 on mobile).
  - Hero numbers are 64.

## 5. Shape and spacing

- **Radius:** 10 for small buttons and chips, 12 to 14 for inputs and buttons, 20 to 24 for cards, 28 for hero cards, 999 for pills.
- **Spacing:** a 4 px base. Common values are 6, 8, 10, 12, 14, 16, 20, 24 and 28. Page padding is 28 on desktop and 16 on mobile.
- **Touch targets:** at least 44 px everywhere. Field (mobile) actions are 48 to 56 px.
- **No gradients, no glassmorphism, no emoji.** Avoid shadows; use borders and surface contrast instead.

## 6. Layout

- **Left rail:** 84 px wide, ink background. Holds the logo, then 7 workspace icons with labels (52×56 each). The active item is a signal fill with ink text.
  - On a phone, the rail wraps into a horizontal bar.
- **Top bar:**
  - ⌘K search, up to 520 px wide;
  - **cycle pill**: `Cycle 4` badge plus "Day 12 of 22 · coverage 78%";
  - help button (e-tickets) and avatar.
- **Content:** fluid. Two-column pages use flex-wrap (main `flex 999 1 520px`, side `flex 1 1 340px`) so the side column drops below the main one on small screens.
- **Use logical CSS only** (`ms-`/`me-`/`ps-`/`pe-`/`start`/`end`), never `left`/`right`, so Arabic RTL works by construction.

### Workspaces (navigation)

| Workspace | Contains (existing modules) |
|---|---|
| **Today** | Role-based home page: rep's round, supervisor's validation inbox, director numbers later |
| **Plan** | Cycles, cycle targets, objectives, frequencies, activities, planning calendar |
| **Field** | Visits (first-class), orders, packs and discounts, samples and material, expenses, travel |
| **Customers** | HCPs, HCOs, consents, territories and zones, segmentation, priorities |
| **Engage** | Campaigns (email, SMS, Zoom), events, e-ADV library, mail templates, surveys |
| **Grow** | Coaching, competitor intel, KPIs and scorecards (later) |
| **Studio** | Catalog (brands, products), users and teams, roles and permissions, rules, all settings |

E-tickets live in the **help button** in the top bar, so a ticket can be opened from any screen.

## 7. UX principles

1. **Panels, not modals.** Records open in a side panel and the list stays visible. One shared `Sheet` component replaces the ~118 hand-made overlays.
2. **⌘K to go anywhere.** Find a doctor, start a visit, log an expense. Results respect permissions.
3. **The cycle is always visible** in the top bar.
4. **Status = word + shape + color:**
   - Completed: ● filled ink dot, ink pill.
   - In progress: ● signal dot with a soft halo, signal pill.
   - Planned: ○ outlined dot, outline pill.
   - Pending: amber.
   - Rejected: ✕ brick.
5. **RTL by construction** (see layout rules above).
6. **Thumb-first on mobile.** Main actions sit at the bottom of the screen and are 48 px or taller.

## 8. Component kit to build

Button (primary signal / dark ink / outline / ghost) · IconButton · Input / Search · Select · Checkbox / Radio / Switch · Badge / StatusPill · Tabs / Segmented · Card · StatCard · ProgressBar · DataList (table on desktop, cards on mobile) · Sheet (side panel) · Dialog (confirmations only) · Toast · EmptyState · Skeleton · Avatar · AppRail · TopBar · CyclePill · CommandPalette (⌘K).

## 9. Screens designed (Option A)

| File | Screen |
|---|---|
| `Main.dc.html` | Brand board |
| `Structure.dc.html` | Workspaces and principles |
| `Today.dc.html` | Rep home page (web): round, cycle coverage, quick actions, samples in bag |
| `Inbox.dc.html` | Supervisor validation inbox with a detail panel and bulk approve |
| `Hcp.dc.html` | HCP list and record panel with timeline |
| `Visit.dc.html` | Mobile: visit in progress (timer, e-ADV, interest score) |
| `Order.dc.html` | Mobile: order with pack tiers, free units and totals |
| `VisitAr.dc.html` | Mobile: Arabic RTL home page |

## 10. Working agreement

- **Design, then build, per module:** mockup on the canvas, your approval, then code. Backend calls stay unchanged.
- **Order:**
  1. design tokens and app shell;
  2. **tenant dashboard (Today)**;
  3. Field;
  4. Plan;
  5. Customers;
  6. Engage;
  7. Grow;
  8. Studio.
- The central console uses the same identity and kit, with its own shell and menu (Labs, Plans & features, Channels, Translations, Usage, Users & roles, Activity). Its mockups go in `central-mockups/`.
- The web app must be **mobile-responsive first**. The reps' native app comes later.
- **Tech base: decided.** We use our own Vue + Tailwind component kit, plus a headless library (e.g. Reka UI) for complex widgets.

## 11. Where it lives in the code

- **Styles:** `src/styles/main.css` is the single Tailwind 4 entry file (theme tokens in `@theme`, dark variant, base rules).
  - Token values for light and dark are in `src/styles/delorc.css`. Use classes like `bg-dl-paper`, `text-dl-muted`, `bg-dl-signal`.
- **Component kit:** `src/components/delorc/`, exported from `index.ts`.
  - Avatar, Badge, Button, Card, ConfirmHost, DataList, EmptyState, Icon, IconButton, Input, Logo, PageHeader, Pagination, Progress, RecordPanel, Segmented, Select, Sheet, Skeleton, StatCard, Tabs.
  - **Lists:** `DlDataList` (table on desktop, cards on phones, click a row to open it) + `DlPagination` + `DlRecordPanel` (panel beside the list on desktop, bottom sheet on phones). Example: the geography pages in Studio.
  - Interactive pieces are built on **Reka UI**.
- **Shell:** `src/layouts/delorc/`.
  - `DelorcLayout` contains AppRail (desktop), AppBottomNav (phone), AppTopBar, AppSubnav, AppUserMenu and AppCommandPalette (⌘K / Ctrl+K).
- **Theme:** `useAppTheme()` holds light/dark/system, saved per browser and applied to Tailwind.
- **Navigation map:** `src/navigation/workspaces.ts`. `useWorkspaces()` filters it by permission.
- **Confirm dialogs:** `useConfirm()` (`confirm`, `confirmChoice`, `alert`), rendered by `DlConfirmHost`.
