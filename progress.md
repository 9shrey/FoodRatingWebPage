# Progress log

## Session 1 — 2026-11-11
- Inspected project (empty). Wrote plan.
- Built domain, storage, state, UI. Unit tests: 16 passing (rating maths, summaries,
  overview unique-vs-occasions, filters, insights thresholds, import validation, CSV,
  repository CRUD/restore/sample removal/export-import).
- Browser-verified (desktop 1280 + mobile 375): create food, repeat occasion with
  autocomplete + restaurant prefill, rating input (keys + tap halves), avg recalculation,
  meal edit/delete + undo, food delete + undo, inline cell edit + undo, favourites,
  search across ingredients/restaurants/notes, multi-filter, sort + multi-sort with
  unrated last, unsaved-changes guard, photo upload, JSON/CSV export, delete-all,
  invalid import rejected, import restores data + photo, persistence after reload,
  sample load/remove, want-to-try, case-insensitive duplicate prevention, no horizontal
  overflow on any page at 375px.

## Session 2 — 2026-11-11: Map
- Added optional lat/lng on meals, /map page (Leaflet + OSM tiles), pin picker in the meal form
  (geolocation + Nominatim search, draggable mini map, auto-reuse of a restaurant's last pin),
  Near me (distance sort + radius), place detail, deep links from meal rows. Sample places pinned.
- CARTO tiles now need an API key; switched to tile.openstreetmap.org.
- Tests: 21 passing (5 new in tests/places.test.ts). Browser-verified desktop + 375px.

## Session 3 — 2026-11-11: Reassessment
- Reassessed: build was sound (22 tests, clean type-check) but there was no diary of meals, no help
  choosing what to eat, no backup safety net, and README had drifted (10-point ratings, tags).
- Added Journal home (diary by day with search, "An idea for <meal>", Log again), moved the table to
  /foods, folded Favourites into Discover (/favourites redirects), backup tracking + reminder +
  navigator.storage.persist(), README rewrite.
- Tests: 34 passing (12 new in tests/journal.test.ts). Browser-verified at 1280 and 375: Journal,
  idea cycling, log-again prefill, data menu, Discover shelves, /foods?cuisine deep link, no horizontal
  overflow. Not seen in the browser: the backup reminder banner (needs 5 non-sample meals); its rule
  is unit-tested.

## Session 4 — 2026-11-11: Supabase sync, GitHub, Vercel
- Pushed to github.com/9shrey/FoodRatingWebPage (public). Vercel connector create_git_project → 403.
- Added SupabaseJournalRepository (jsonb rows, PK (user_id,id), RLS, private photos bucket, realtime +
  focus refetch), magic-link AuthGate, sign out in data menu, LocalCopyBanner, supabase/schema.sql,
  .env.example. Without env vars the app stays local-only (Dexie), so tests are unchanged.
- Checks: tsc clean, 34 tests pass, build OK. Browser: sign-in screen at 1280 and 375 with a placeholder
  project (validation, no overflow, no console errors). Not yet exercised against a real Supabase project.

## Session 5 — 2026-11-11: UI/UX refresh
- Reference sites: Mobbin, Refero and Screenlane need a sign-in (no account made); took patterns from the open pages
  of Mobbin, Refero, Behance and Collect UI (see findings.md).
- Changed: design tokens (type scale, radii, control height, shadows), buttons/fields/chips/menus/dialogs/toasts,
  top bar and tab bar, food cards, table, analytics insights, map list, sign-in card. Journal page rebuilt: date as
  headline, WeekStrip (jumps to a day), composer button, Day with a date rail, first-run welcome with a large plate.
  New `dayParts` in domain/dates.ts. Map rows no longer repeat the rating. Compact rating star is yolk-coloured.
- Added `dev-local` launch config (port 5175, Supabase env blanked) so the app can be previewed without signing in.
- Checks: tsc clean, 34 tests pass, build OK, no console errors. Browser at 1280 and 375: Journal, Foods, Discover,
  Analytics, Map, food detail panel, log dialog, confirm dialog, first-run welcome, sign-in screen; week strip jump
  and composer verified; no horizontal overflow at 375 on Journal. Not exercised: signed-in cloud mode, photo thumbnails.
