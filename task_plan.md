# Task plan — Personal Food Journal ("Palate")

## Goal
Polished, responsive, local-first food journal that is useful day to day: a diary of what
was eaten, fast logging, help deciding what to eat, a searchable food catalogue, map, analytics,
and data that is hard to lose.

## Current Phase
Complete

## Next Step
None — awaiting user feedback. Ideas not built: phone install/hosting, places list for unpinned restaurants.

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
| Keep hand-rolled Dialog/Popover/Combobox (session 3) | Native dialog, focus handling and keyboard support already work; a component library would mean a restyle for no user-visible gain |

## Errors Encountered
| Error | Attempt | Resolution |
|---|---|---|
| Insight "more than anything else" on 2 foods | 1 | Require ≥5 tried foods |
| React autoFocus fires before showModal | 1 | Dialog focuses [data-autofocus] after opening |
| Sample data duplicated a real food | 1 | Skip sample foods whose name exists |
| Category insight based on one dish | 1 | Require ≥2 dishes per category |
| HMR "must be used inside Provider" | 1 | Dev-only artefact; full reload |
| Journal side column overflowed at 375px | 1 | minmax(0,1fr) on the side grid |
| Log-again chips had no label on mobile (grid track resolved to 0) | 2 | Label is display:block with a max-width |
