# Your Next Binge

A "what should I watch tonight" picker for Amazon Fire TV, built with **React Native for Vega**. Pick a mood, optionally refine by genre, runtime, intensity, and era, and get a small, explainable ranked list — all offline.

No backend, no streaming APIs, no accounts: the catalog is bundled and the recommender is a deterministic scoring function you can read in one sitting.

## How it works

```
Home (pick a mood, or jump to a curated shortcut)
  └─> Refine (optional: genre • runtime cap • intensity cap • era)
        └─> Results (ranked shortlist, top match highlighted)
              └─> Detail (synopsis, why-it-fits, related titles)
```

- **`app/src/data/catalog.ts`** — 83 hand-curated titles with factual metadata (title, year, runtime, genres) and **original synopses written for this project**. Ratings are `null` everywhere: no third-party ratings are bundled or implied, and no artwork or posters are included. Four curated collection presets live here too.
- **`app/src/services/recommender.ts`** — deterministic scoring: mood-tag match (30) > genre match (20) > intensity (10) > era (8), with a small tie-breaker and a penalty for unknown runtimes. Same input always yields the same ranked list — no randomness, no ML.
- **Strict filters with a relaxation ladder.** Genre, runtime, intensity, and era choices are real filters, but the app never shows an empty screen: if nothing matches everything, it relaxes constraints one at a time in a fixed order (intensity → genre → era → runtime → mood) and *says so* in plain language on the results screen.
- **Unknown runtimes are kept, not dropped.** Titles without a verified runtime stay visible (ranked slightly lower) and the detail screen says "runtime not logged" honestly rather than guessing. This was a deliberate call: an occasional surprise beats silently hiding a third of the catalog.

## Cursor & focus

This is a 10-foot UI: every row is wired with an explicit D-pad focus map (edge rows included) instead of relying on geometric focus, which drifts at row boundaries on TV. Focus indication is a border + background change; text is never transform-scaled (it rasterizes blurrily on the platform).

## Build, run, test

```bash
cd app
npm install

npm test                 # jest
npm run lint             # eslint
npx tsc --noEmit         # types
npm run build:debug      # kepler build (Debug)

# with the Vega SDK on PATH and a device (VVD or Fire TV) connected:
vega device install-app --directory . --buildType Debug
vega device launch-app --directory .
```

Requires the [Vega SDK](https://developer.amazon.com/docs/vega/latest/). `vega virtual-device start` launches the Virtual Device for local testing.

## What was tested — and what wasn't

- **Tested:** all flows (mood → refine → results → detail, back navigation, relaxation banner, curated shortcuts, related-title jumps) on the **Vega Virtual Device**; 24 Jest unit/UI tests covering the recommender, relaxation order, catalog coverage, and screen navigation.
- **Not tested:** real Fire TV hardware with Vega. Physical-device focus behavior, performance on low-end sticks, and app-store submission are unverified. Treat the VVD result as promising, not final.
