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
