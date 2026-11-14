# Task plan — Personal Food Journal ("Palate")

## Goal
Polished, responsive, local-first food journal that is useful day to day: a diary of what
was eaten, fast logging, help deciding what to eat, a searchable food catalogue, map, analytics,
and data that is hard to lose.

## Current Phase
Phase 8 complete (session 5). Phase 7 (Vercel deploy) still waiting on the user.

## Next Step
Refresh is merged into main locally (not pushed, so not deployed). Phase 7 still needs the Vercel identity check.

### Phase 1–5: Initial build, map
**Status:** complete (see progress.md sessions 1–2)

### Phase 6: Reassessment and usefulness pass (session 3)
**Status:** complete
- [x] Journal page as the new home: diary grouped by day, "log again" shortcuts, a suggestion
- [x] Navigation: Journal, Foods (/foods), Map, Analytics, Discover; Favourites folded into Discover
- [x] Backup safety: remember last backup, show it in the data menu, nudge when overdue,
      ask the browser for persistent storage
- [x] README brought back in line with the code (5-star ratings, current fields, pages)
- [x] Unit tests for new domain logic; browser check desktop + 375px

### Phase 7: Supabase sync + Vercel deploy (session 4)
**Status:** in_progress
- [x] supabase/schema.sql: foods, occasions (jsonb `data`, PK (user_id,id)), RLS, photos bucket + policies, realtime
- [x] SupabaseJournalRepository (in-memory cache, paged fetch, refetch on focus + realtime)
- [x] Magic-link sign-in gate; sign out in data menu
- [x] Banner to copy this browser's local (Dexie) journal into the account
- [x] Falls back to local Dexie when VITE_SUPABASE_* env vars are missing (tests, local dev)
- [ ] Vercel deploy (connector create_git_project returned 403)

### Phase 8: UI/UX refresh (session 5)
**Status:** complete
- [x] Tokens: larger type, 40px controls, pill buttons, softer surfaces, fewer borders
- [x] Shell: pill nav, calmer top bar, mobile tab bar with pill behind the active icon
- [x] Journal home: date-rail diary, 7-day strip of plates, on-page "What did you eat" composer, date as the headline
- [x] Cards image-first; table, dialogs, banners, first-run welcome, sign-in screen restyled
- [x] tsc + 34 tests + build; browser check at 1280 and 375

### Phase 9: Password sign-in (session 6)
**Status:** complete
- [x] Email → password (or choose one if new); email link only for old accounts and "forgot it"
- [x] account_status() / has_password() RPCs, keyed on user metadata `password_set` (applied to the palate project)
- [x] Allowlisted sign-ups are auto-confirmed by the enforce_allowlist trigger

## Decisions Made
| Decision | Why |
|---|---|
| Vite + React 19 + TypeScript | Empty project; fast, standard, static deploy |
| Dexie (IndexedDB) | Photos too big for localStorage; transactional; behind Repository interface |
| TanStack Table v8 (pinned) | v9 was just released; v8 API is stable |
| Recharts (lazy-loaded) | Declarative charts; split out of main bundle |
| zod | Import validation |
| Plain CSS with tokens | Full control over a restrained design system |
| Restaurant = string on occasion | Autocomplete from distinct values; no extra entity |
| Food with 0 occasions = "want to try" | Answers "what should I try next" without a new model |
| Photos in own table | Keeps occasion rows small |
| Sample data flagged `isSample`, skips names you already have | Clear, removable, no duplicates |
| Single-series teal charts, no dual axes | dataviz skill guidance |
| Home is a diary, not the table (session 3) | A journal's daily question is "what did I eat / what next"; the table answers neither |
| Favourites folded into Discover (session 3) | Both pages were shelves of cards with a duplicated "Highest rated"; frees a mobile tab |
| Supabase rows store the domain object as jsonb `data` (session 4) | Mapping stays trivial; domain types unchanged; personal-scale data |
| `password_set` metadata, not encrypted_password (session 6) | Supabase gives link-created accounts a random password, so the column can't tell who chose one |
| PK (user_id, id) | Sample data uses fixed ids like `sample-occ-1`; every user loads the same ones |
| Photos in a private Storage bucket at `<uid>/<photoId>` | 1280px JPEGs are 200–400 KB; DB free tier is smaller than storage |
| No offline queue | One person, two devices; online writes keep it simple. Local mode still exists without env vars |
| Supabase project `palate` (edfsrymqjrowlijwxqwc, ap-south-1); publishable key committed in .env.production | Key is public by design; avoids typing keys into Vercel; RLS protects data |
| Keep the porcelain identity, change scale and structure (session 5) | Cobalt, Young Serif and the plate motif were already distinctive; the weak points were density, boxes and a home page without its own log action |
| No backdrop blur on dialogs (session 5) | Costly on phones and added nothing over a slightly darker scrim |
| Keep hand-rolled Dialog/Popover/Combobox (session 3) | Native dialog, focus handling and keyboard support already work; a component library would mean a restyle for no user-visible gain |

## Errors Encountered
| Error | Attempt | Resolution |
|---|---|---|
| Vercel connector create_git_project 403 forbidden | 1 | Not retried; user imports via dashboard or CLI |
| Vercel connector create_project 403; get_project 404 for dashboard-made project | 2 | Connector seems scoped elsewhere; used dashboard in Chrome |
| Adding Supabase redirect URLs (wildcard) blocked by auto-mode classifier | 1 | Skipped; Site URL alone covers production |
| Insight "more than anything else" on 2 foods | 1 | Require ≥5 tried foods |
| React autoFocus fires before showModal | 1 | Dialog focuses [data-autofocus] after opening |
| Sample data duplicated a real food | 1 | Skip sample foods whose name exists |
| Category insight based on one dish | 1 | Require ≥2 dishes per category |
| HMR "must be used inside Provider" | 1 | Dev-only artefact; full reload |
| Short dialogs filled the whole phone screen (height:auto on a fixed dialog stretches) | 1 | height: fit-content |
| Screenshots showed dialogs half-transparent | 1 | Browser pane was hidden, so CSS animations sat at frame 0; call getAnimations().finish() before a screenshot |
| Journal side column overflowed at 375px | 1 | minmax(0,1fr) on the side grid |
| Log-again chips had no label on mobile (grid track resolved to 0) | 2 | Label is display:block with a max-width |
