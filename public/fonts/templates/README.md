# Magnet template fonts

Self-hosted so the guest phone, the Print Station and the print all draw the
same glyphs. Loaded on demand by `src/lib/polaroid/fonts.js` (FontFace API,
registered under `tpl-*` names), never by the UI.

Files are the Google Fonts `latin` / `hebrew` subsets (woff2). All are licensed
under the SIL Open Font License 1.1 (https://openfontlicense.org), which allows
bundling and redistribution.

| Family | Weight | Subsets | Used by |
|---|---|---|---|
| Bellefair | 400 | latin, hebrew | A names |
| Bona Nova | 400 | latin, hebrew | B, D names |
| Great Vibes | 400 | latin | B "&", G Latin names |
| Karantina | 700 | latin, hebrew | C names |
| Gveret Levin | 400 | latin, hebrew | F names, G Hebrew names |
| Heebo | 300 | latin | dates, A's vertical URL |
