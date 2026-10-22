# Your Next Binge

A TV-first "what should I watch?" app for Amazon Vega / Fire TV. Pick a mood,
optionally narrow it down, and get a short, explained shortlist — no accounts,
no network calls, no endless scrolling.

Built with React Native and the Amazon Kepler runtime, and designed for a
960×540 dp canvas driven entirely by a D-pad remote.

## How it works

1. **Home** — choose one of 7 moods, or jump straight into a curator's
   shortlist.
2. **Refine** — optionally cap runtime, pick a genre, cap intensity, or choose
   a decade. Every filter can be skipped.
3. **Results** — up to 5 ranked titles (hard cap 6), each with a one-line
   "why this fits" explanation.
4. **Detail** — synopsis, metadata, and related titles that re-anchor the
   recommendation on a fresh mood.

If the chosen filters match nothing, the recommender relaxes constraints in a
fixed order instead of showing a blank screen, and the results screen explains
what was widened.

## Stack

| Piece | Version |
| --- | --- |
| React | 19.2 |
| React Native | 0.83 |
| `@amazon-devices/react-native-kepler` | 4.0 |
| TypeScript | 5.8 |
| Jest + Testing Library | 29 / 13 |

Target: Vega OS 1.2, `tv` project type.

## Getting started

Requires **Node.js 20+** and the Amazon Vega SDK (for running on a device or
emulator). Unit tests and linting work without the SDK.

```bash
cd app

npm install        # install dependencies
npm test           # run the Jest suite
npm run lint       # ESLint over src/ and test/
npm start          # start Metro for a connected device

npm run build:debug    # Vega debug build (requires SDK)
npm run build:release  # Vega release build (requires SDK)
npm run release        # lint + test + release build
```

> `npm ci` requires a lockfile that is in sync with `package.json`. The
> committed lockfile is kept in sync; if you change dependencies, run
> `npm install` and commit the updated lock.

## Project layout

```
app/
  manifest.toml            Vega package manifest
  app.json                 Kepler app registration
  src/
    App.tsx                screen state, navigation, back handling
    theme.ts               colors, spacing, type scale, 960×540 layout tokens
    types.ts               domain types and era matching
    data/catalog.ts        83-title catalog, moods, genres, collections
    services/
      recommender.ts       filtering, scoring, ranking, explanations
      focus.ts             guarded FocusManager / setNextFocus helpers
    hooks/
      useInitialFocus.ts   focus a default control on screen mount
    components/            FocusTile, RankCard, ScreenHeader
    screens/               Home, Refine, Results, Detail
  test/
    recommender.spec.ts    scoring and relaxation rules
    App.spec.tsx           navigation and rendering smoke tests
```

## Recommendation model

The recommender is deliberately deterministic: no ML, no randomness, no async
data. The same filters always produce the same ordered list.

**Strict filters**

- `mood` — titles must carry the selected mood. This is the anchor of the whole
  query and the last thing the recommender gives up.
- `maxRuntimeMinutes` — titles over the cap are excluded; titles with an unknown
  runtime are kept but penalized (permissive-unknown).
- `genre` — title must include the genre.
- `maxIntensity` — acts as a ceiling (`low` < `medium` < `high`).
- `era` — decade bucket from `types.ts` (`2020s`, `2010s`, `2000s`, `1990s`,
  `earlier`).

**Scoring** (`WEIGHTS` in `services/recommender.ts`)

| Signal | Points |
| --- | --- |
| Mood tag match | +30 |
| Genre match | +20 |
| Intensity within cap | +10 |
| Era match | +8 |
| Rating | +2 per rating point |
| Unknown runtime | −5 |

Ties break by rating (known before unknown), then newer year, then title id.

**Relaxation ladder**

If nothing passes, constraints are dropped one at a time —
intensity → genre → era → runtime — and the search is re-run. The final safety
net falls back to titles matching the mood, then the whole catalog, so the UI
never renders an empty list for a non-empty catalog.

## Catalog

`src/data/catalog.ts` is the single source of truth: 83 titles, 7 moods,
8 genres, and 4 curated collections. Every title carries an original synopsis,
a 0–10 rating (or `null` when not reliably known), and a runtime (or `null`
rather than a guess).

To add a title, append a `Title` object with a unique `id`; the UI and tests
pick it up automatically. Keep mood coverage intact — every mood, genre, and
decade bucket is expected to have at least one match (enforced by tests).

## Testing

The suite covers:

- deterministic ranking and tie-breaking
- strict filtering plus the permissive-unknown runtime rule
- relaxation order and the never-empty guarantee
- limit clamping, explanation text, and catalog coverage
- screen navigation and back behavior

Run `npm test` from `app/`.
