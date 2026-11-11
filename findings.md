# Findings

- Project folder was empty at start (2026-11-11). No existing config to preserve.
- Node v22.23.1, npm 10.9.8, Linux, fish shell.

## Design plan (v2, 2026-11-11): blue-and-white porcelain
- Palette: porcelain #F4F6FA (page), glaze #FFFFFF (surfaces), cobalt #1D4AA6 (the only action colour,
  token --accent), navy ink #121A2E, yolk #F0AE1A (stars), chili #D1433A (favourite heart only).
- Type: Young Serif for names of things (page titles, food/place names, big scores, dialog titles);
  Instrument Sans for UI, labels and numbers. Section headings stay sans.
- Signature element: photo-less foods render as a plate seen from above (glazed rims + monogram),
  in 6 glazes picked from the name; a single rim below 52px. The brand mark uses the same drawing.
- Avoid: " · " meta strings (use commas/sentences), side-stripe accents, all-caps labels.
- Layout unchanged: top bar with cobalt underline on the active page; bottom tab bar + FAB on mobile.

## Session 3 notes
- Journal page layout: diary left (max 1fr), sticky 320px side column (idea card, log again); under 960px
  the side column stacks above the diary and log-again becomes a swipeable chip row.
- Diary entry names use Young Serif (names of things); day headings stay sans.
- Backup state lives in localStorage `fj:backup`, outside the journal export.

## Session 5 (2026-11-11): UI/UX refresh research
- User asked to use design-reference sites (Mobbin, Refero, Awwwards, Behance, Collect UI, ...). Mobbin, Refero and
  Screenlane/Page Flows galleries need a sign-in; no account was created. Looked at open pages on Mobbin, Refero,
  Behance search, Collect UI.
- Patterns taken: near-white canvas instead of cards-on-grey; large confident headings; pill buttons and pill nav
  (active = soft filled pill); image-first cards with the text sitting on the canvas below, no box; few borders,
  more space; one obvious primary action on the page itself.
- Current app weaknesses seen in the browser: 13px UI text and 34px controls read as an admin tool; every list is a
  bordered box; home page's main action lives only in the top bar; loud yellow sample banner; small empty state.
- Direction: keep the porcelain identity (cobalt, Young Serif, plate motif) and make it calmer and bigger.
  Journal becomes a diary with a date rail (big day number), a 7-day strip of plates, and a composer row.
