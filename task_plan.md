# Task plan — Personal Food Journal ("Palate")

## Goal
Polished, responsive, local-first food journal that is useful day to day: a diary of what
was eaten, fast logging, help deciding what to eat, a searchable food catalogue, map, analytics,
and data that is hard to lose.

## Current Phase
Phase 7: Supabase sync + Vercel deploy (session 4)

## Next Step
Implement SupabaseJournalRepository, auth gate, local-to-cloud copy; then user creates Supabase project and Vercel import.

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
- [ ] supabase/schema.sql: foods, occasions (jsonb `data`, PK (user_id,id)), RLS, photos bucket + policies, realtime
- [ ] SupabaseJournalRepository (in-memory cache, paged fetch, refetch on focus + realtime)
- [ ] Magic-link sign-in gate; sign out in data menu
- [ ] Banner to copy this browser's local (Dexie) journal into the account
- [ ] Falls back to local Dexie when VITE_SUPABASE_* env vars are missing (tests, local dev)
- [ ] Vercel deploy (connector create_git_project returned 403)

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
| PK (user_id, id) | Sample data uses fixed ids like `sample-occ-1`; every user loads the same ones |
| Photos in a private Storage bucket at `<uid>/<photoId>` | 1280px JPEGs are 200–400 KB; DB free tier is smaller than storage |
| No offline queue | One person, two devices; online writes keep it simple. Local mode still exists without env vars |
| Keep hand-rolled Dialog/Popover/Combobox (session 3) | Native dialog, focus handling and keyboard support already work; a component library would mean a restyle for no user-visible gain |

## Errors Encountered
| Error | Attempt | Resolution |
|---|---|---|
| Vercel connector create_git_project 403 forbidden | 1 | Not retried; user imports via dashboard or CLI |
| Insight "more than anything else" on 2 foods | 1 | Require ≥5 tried foods |
| React autoFocus fires before showModal | 1 | Dialog focuses [data-autofocus] after opening |
| Sample data duplicated a real food | 1 | Skip sample foods whose name exists |
| Category insight based on one dish | 1 | Require ≥2 dishes per category |
| HMR "must be used inside Provider" | 1 | Dev-only artefact; full reload |
| Journal side column overflowed at 375px | 1 | minmax(0,1fr) on the side grid |
| Log-again chips had no label on mobile (grid track resolved to 0) | 2 | Label is display:block with a max-width |
