# Palate — a personal food journal

Letterboxd for food: keep a diary of what you eat, rate every meal out of 5 stars,
and get ideas for what to eat next. Local-first — everything lives in your
browser (IndexedDB). No account, no server.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (domain logic + storage)
npm run build      # type-check and production build into dist/
```

## Using it

- **Journal** (home): your meals as a diary, newest day first, searchable by food, place or notes.
  Beside it, one idea for the next meal (step through with *Another idea*) and **Log again**
  shortcuts for the foods you eat most around this time of day.
- **Log food** (button, or press <kbd>N</kbd>): search your foods, pick one or create a new one,
  choose where, rate it, save (<kbd>Ctrl/⌘</kbd>+<kbd>Enter</kbd>). Notes, photo and location are
  under *Notes, photo and location*.
- **Want to try**: when creating a new food, tick "I haven't eaten it yet".
- **Foods**: every dish as a table or gallery. Press <kbd>/</kbd> to search. Click a header to sort,
  shift-click for a secondary sort. Click a cuisine cell to edit it in place; use the pencil to
  rename. Select rows for bulk favourite/delete. *Columns* shows, hides and reorders columns.
- **Map**: every meal with a pin shows up as a bubble (its latest photo or average rating). Tap a place to
  see what you've had there, get directions or log another meal there. **Near me** sorts places by distance
  and filters to 500 m – 5 km. When logging, pin a meal under *Where* with **I'm here now** (GPS) or
  **Find on map** (OpenStreetMap search); later meals at the same restaurant reuse the pin.
- **Analytics**: totals, plain-language observations, rankings and charts.
- **Discover**: worth revisiting, your favourites, want to try, tried only once, not eaten recently.
- **Backup & data** (database icon, top right): save a backup file (JSON), CSV export, JSON import
  (merge or replace), load/remove sample data, delete everything. The menu shows when you last
  backed up; the Journal reminds you once five or more meals exist that no backup has seen and the
  last backup is over 30 days old (or there has never been one).

Sample data is labelled "Sample" everywhere and can be removed in one click; meals you log
yourself against a sample food are kept.

## Data model

- **Food** — a dish you can eat many times: name, cuisine, description, favourite flag.
- **Occasion** — one time you ate it: restaurant, date, rating (0.5–5 stars in half steps, or
  unrated), notes, photo, price tier, meal type, location, optional map pin (lat/lng).

A food's rating, times eaten, first tried and last eaten are always **derived** from its
occasions, never stored. Unrated meals are ignored in averages. A food with no occasions is on
your want-to-try list. "Restaurants visited" excludes home cooking (`Home`).

## Code layout

```
src/
  domain/      Pure logic, no React: types, rating maths, summaries, filters, diary and
               meal suggestions, analytics, insights (with minimum-data thresholds),
               backup reminder rules, zod schemas, CSV
  storage/     JournalRepository interface + Dexie/IndexedDB implementation, sample data
  state/       React providers/hooks: journal data, toasts, dialogs/confirm, photos, prefs
  components/  ui/ (dialog, popover, combobox, rating, ...), food/ (log dialog, detail
               panel, cards), database/ (table columns, table, filters)
  pages/       Journal, Foods, Map, Analytics, Discover
  layout/      App shell, navigation, data menu
tests/         Vitest: domain calculations and repository (fake-indexeddb)
```

**Adding cloud sync later:** implement `JournalRepository` (`src/storage/repository.ts`) against
a backend and swap the instance in `src/storage/index.ts`. The UI only talks to that interface.
Records already carry UUIDs and `createdAt`/`updatedAt` timestamps for merging.
