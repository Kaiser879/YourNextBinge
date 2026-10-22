# Your Next Binge — Fire TV / Vega OS App

## 1. Product overview

**Working name:** Your Next Binge  
**Platform:** Fire TV devices running Vega OS  
**Application:** React Native for Vega, written in TypeScript  
**One-line pitch:** Find something worth watching in seconds, based on your mood, available time, and taste.

Your Next Binge is a remote-first movie and TV discovery app. Users choose a mood, optionally refine their preferences, and receive a short ranked list of titles that fit. The app should feel like a polished streaming discovery experience designed for a television—not a mobile app stretched onto a large screen.

The core product is the TV interface and the speed with which it helps a user choose something to watch. Voice input and Alexa integration are not part of the initial MVP.

## 2. Problem

Choosing something to watch often takes longer than expected. People scroll through large catalogs, give up, or rewatch something familiar. Many recommendation interfaces emphasize popularity or viewing history rather than what a person wants right now.

A user might simply want:
- Something funny, under 90 minutes.
- A cozy mystery for tonight.
- A thoughtful film that is not emotionally heavy.
- A mind-bending science-fiction film.
- A comfort show that does not require much attention.

Your Next Binge starts with the user's current mood and constraints, rather than requiring an account or a viewing-history profile.

## 3. Product principles

1. **Mood-first:** Mood is the main entry point; genre and runtime are optional refinements.
2. **Remote-first:** The entire primary flow must work using a Fire TV remote and its directional pad, select, and Back buttons.
3. **Fast:** A user should be able to get from launch to a useful shortlist in under a minute.
4. **Explainable:** Each recommendation should include a short reason it matches the request.
5. **No account required:** The MVP has no sign-in, profile, or viewing-history dependency.
6. **Voice is optional and out of scope:** Do not build a voice-first Alexa experience for this version.
7. **Reliable demo:** The app should have a bundled catalog or graceful offline behavior so the core demonstration does not depend on a live third-party catalog.
8. **TV-native:** Use readable typography, generous spacing, landscape-oriented title cards, clear focus states, and predictable remote navigation.

## 4. Core user experience

### Screen A — Home / mood selection

Show a clear title and short instruction, such as “What are you in the mood for?”

Display selectable mood tiles:
- Cozy
- Funny
- Mind-bending
- Thrilling
- Comfort Watch
- Romantic
- Thought-provoking

The user navigates between tiles using the directional pad and selects one with the remote's select button. A visible focus indicator must distinguish the currently focused tile from the selected mood.

Include an obvious way to continue and a way to reset the selection.

### Screen B — Refine preferences

Allow users to refine the request without requiring text entry.

Controls:
- Maximum runtime, with sensible presets such as 90, 120, and 180 minutes.
- Optional genre.
- Optional intensity or emotional heaviness, if it can be implemented without making the interface cluttered.

Keep defaults sensible. The user should be able to skip filters and see recommendations immediately.

### Screen C — Recommendations

Show three to six ranked results. Each result should include:
- Title
- Release year
- Runtime, when known
- Genres
- A small number of mood tags
- A short “Why this fits” explanation

Make the top match visually prominent, but keep the other results easy to browse. Use landscape cards or another layout appropriate for a TV screen. Do not depend on copyrighted posters or artwork for the MVP.

If no exact match exists, show the closest matches and explain that the filters were relaxed, or give the user a clear way to broaden the request. Never show a blank screen.

### Screen D — Title details

Selecting a title opens a focused detail screen or panel with:
- Title and release year
- Original synopsis written for this project
- Runtime
- Genres
- Mood tags
- A short explanation of why it was recommended
- A clear Back action returning to the previous results and preserving filters

Do not imply that a title is available on a particular streaming service. Live streaming availability is out of scope.

### Example interaction

1. User selects **Cozy**.
2. User sets maximum runtime to **120 minutes**.
3. The app shows three to six matching titles.
4. The top result includes the explanation: “A gentle mystery with a warm setting and low intensity.”
5. User opens the title to read its synopsis and metadata.
6. Pressing Back returns to the same recommendation list and filter state.

## 5. Visual direction

Aim for a polished, cinematic streaming interface.

- Dark background with high-contrast text.
- One restrained accent color for focus, selection, and key actions.
- Large, readable typography suitable for viewing from a couch.
- Landscape title cards with consistent dimensions.
- Generous spacing and clear visual hierarchy.
- Distinct focus, selected, disabled, loading, and error states.
- Subtle transitions only where they do not slow down navigation.
- No tiny mobile-style controls, dense forms, hover-dependent interactions, or mandatory keyboard input.

Use original gradients, shapes, typography, and text-based cards rather than unlicensed movie posters. The interface should have a consistent visual identity rather than looking like a generic catalog clone.

## 6. Platform and technical architecture

### Frontend

- React Native for Vega
- TypeScript
- React Native styling and reusable components
- Vega-compatible focus management and navigation
- A layout designed specifically for TV landscape displays

Do not assume a standard Android React Native or Expo application can be installed on Vega OS unchanged. Use the current official Vega SDK, project template, supported packages, and packaging process. Verify APIs and package compatibility against the installed SDK version.

### Backend

No backend server in the MVP.

- All filtering, ranking, and title data are served from the bundled catalog, locally in the app.
- Deterministic recommendation and filtering logic lives in a TypeScript module with unit tests.
- No network dependency for any core feature.

### Data

Start with a curated JSON catalog containing approximately 30–50 titles. Each entry should have, where available:
- Stable internal ID
- Title
- Release year
- Runtime in minutes
- Genres
- Mood tags
- Intensity or emotional-heaviness tags
- Original synopsis written for this project
- Optional rating and its source, if legally and reliably sourced

Do not bundle copyrighted artwork or posters. Do not scrape or redistribute data without confirming the relevant terms. If TMDB data is used, verify the current licensing and attribution requirements before including it in the project. Do not assume that non-commercial use automatically permits every form of redistribution.

### Architecture diagram

```text
Fire TV device running Vega OS
└── React Native for Vega app
    ├── Home / mood selection
    ├── Filter controls
    ├── Recommendation results
    ├── Title details
    ├── Focus and remote-navigation logic
    └── Catalog / recommendation engine
        └── Bundled JSON catalog + local filtering and ranking
```

### Local-first behavior

The app must remain fully functional when the network is unavailable. The curated catalog is bundled with the app and the core filtering and ranking logic runs locally for the MVP. There is no backend service and no network dependency for any essential feature.

The app may be described as fully offline because no core feature requires the network.

## 7. Recommendation logic

A machine-learning model is unnecessary for the MVP. Use deterministic tag scoring that is easy to test and explain.

Inputs:
- Selected mood
- Optional genre
- Maximum runtime
- Optional intensity constraint

Suggested behavior:
1. Filter out titles that exceed the selected maximum runtime, where runtime is known.
2. Apply the selected genre if one is specified.
3. Apply intensity constraints if selected.
4. Score remaining titles according to mood-tag match, genre match, and any additional preference match.
5. Sort by score, then use a deterministic tie-breaker.
6. Return the requested number of results, capped at a safe maximum.
7. Include a concise explanation based on the matching tags.

For missing metadata, do not silently invent values. Decide and document whether a title with unknown runtime is excluded when a strict runtime filter is active.

A possible scoring model:

```text
score =
    mood_match_points
  + genre_match_points
  + secondary_preference_points
```

Keep scoring weights centralized and covered by tests. The exact weights can be tuned after trying realistic example queries.

## 8. Data access (no API)

The MVP has no HTTP API and no backend service. The Go/REST backend previously scoped here has been cut.

- The curated catalog ships as a bundled JSON asset inside the app.
- A typed accessor module reads the catalog and exposes functions such as `getMoods()`, `getRecommendations(filters)`, and `getTitle(id)`.
- Recommendation and filtering logic is deterministic, synchronous, and unit-tested.
- Errors are local and typed (e.g. unknown title ID, empty result set) — there is no network failure state to handle.
- Because there is no network dependency, there are no base-URL, authentication, or reachability concerns.

For a future server-backed version, these module functions define the contract a backend would need to satisfy; no such backend is built now.

## 9. Remote navigation and accessibility

This is a core engineering requirement, not a final polish task.

- Every actionable control must be reachable by directional-pad navigation.
- The focused element must always be visually obvious.
- Focus order must follow the visual layout and remain predictable.
- Selection must not be confused with focus.
- The Back button must return to the correct previous screen.
- Returning from details must preserve the selected mood, filters, and result position where practical.
- Avoid focus traps and controls that can only be reached by touch or pointer.
- Ensure text contrast and readable type sizes.
- Provide visible loading, empty, and error states.
- Test edge cases such as a single result, many results, unknown metadata, and no exact matches.

Investigate the current Vega documentation for supported focus-management APIs and components, including any available equivalents of `TVFocusGuideView` or `FocusManager`. Do not assume an API exists in the installed SDK without checking.

## 10. Scope

### In scope

- React Native for Vega TV app
- Mood selection
- Runtime and optional genre filters
- Curated catalog of approximately 30–50 titles
- Deterministic recommendation ranking
- Results screen
- Title detail screen
- Remote-only navigation
- Bundled catalog only (no backend server)
- Deterministic local recommendation ranking
- Results screen
- Title detail screen
- Remote-only navigation
- Bundled catalog, fully offline
- Basic automated tests
- A polished 60-second demo

### Out of scope

- Alexa voice integration
- Voice-first user flows
- Live streaming-catalog integration
- User accounts
- Viewing history and long-term personalization
- Real movie posters or copyrighted artwork
- Streaming-service account linking
- Playback of movies or episodes
- A machine-learning recommendation model
- A database server for the initial catalog
- A backend or REST API of any kind
- MCP server, unless explicitly required by the hackathon criteria

## 11. One-day implementation plan

### Hour 1 — Scaffold and launch

- Read the current official Vega developer setup instructions.
- Install and verify the Vega Developer Tools and required SDK.
- Create a React Native for Vega project using the supported template.
- Launch the starter application in the Vega Virtual Device.
- Confirm how to package and run the app on target hardware.

**Exit condition:** The starter app runs successfully in the intended Vega development environment.

### Hours 2–3 — Build the TV interface

- Create the home and mood-selection screen.
- Create filter controls.
- Create the results layout and title-detail screen.
- Implement focus indicators and directional-pad navigation from the beginning.
- Add Back behavior and preserve navigation state.

**Exit condition:** A user can navigate the full flow with a remote using mock data.

### Hours 4–5 — Catalog and recommendations

- Define the JSON catalog schema.
- Add 30–50 curated titles with metadata and original synopses.
- Add mood and intensity tags.
- Implement filtering, ranking, tie-breaking, and explanations.
- Write unit tests for the ranking and filtering logic.

**Exit condition:** Representative mood and runtime requests produce sensible, repeatable results.

### Hour 6 — Catalog depth and recommendation polish

- Expand the catalog to 30–50 curated titles with original synopses.
- Tune scoring weights against realistic example queries.
- Expand unit tests to cover tie-breaking, unknown runtime, and empty results.

**Exit condition:** Representative mood and runtime requests produce sensible, repeatable results across the full catalog.

### Hour 7 — Test and polish

- Test every screen using directional-pad input.
- Check focus order, Back behavior, and filter persistence.
- Test empty results, unknown runtime, and single-result cases.
- Improve text sizing, spacing, and visual hierarchy.

**Exit condition:** The main flow works reliably without touch input.

### Hour 8 — Demo and submission

- Produce a release/package build using the supported Vega process.
- Test on actual Vega-compatible Fire TV hardware if available.
- Record a concise 60-second demo.
- Keep a fallback demo path ready if device access or network connectivity fails.
- Submit early enough to resolve packaging problems.

**Exit condition:** A reproducible demo shows mood selection, filtering, recommendations, and title details.

## 12. Demo script — 60 seconds

1. **0–10 seconds:** Open Your Next Binge and show the mood-selection screen.
2. **10–20 seconds:** Select “Cozy” and set the runtime limit to 120 minutes.
3. **20–35 seconds:** Show the ranked recommendations and the “Why this fits” explanation.
4. **35–45 seconds:** Open one title and show its synopsis, runtime, genres, and mood tags.
5. **45–55 seconds:** Press Back and show that the previous results and filters are preserved.
6. **55–60 seconds:** Close with the core message: choose by mood, not by endless scrolling.

## 13. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Vega SDK or package incompatibility | Start with the official template and verify dependencies early. |
| Remote focus bugs | Treat focus management as a first-class feature and test it throughout development. |
| Device or developer access delays | Build and test in the virtual device first; confirm hardware availability early. |
| Small catalog feels repetitive | Choose diverse, high-quality titles and write specific mood tags. |
| Inconsistent recommendations | Use deterministic scoring and unit tests. |
| Licensing or attribution problems | Avoid artwork; verify current data licensing and attribution requirements. |
| Scope creep | Prioritize the complete remote-driven experience over extra features. |

## 14. Success criteria

The MVP is complete when:

- The app launches in the intended Vega environment.
- The full main flow works using only the remote.
- A user can select a mood and optional filters without typing.
- The app displays three to six ranked recommendations when matches exist.
- Each recommendation has a useful explanation.
- The detail screen shows the synopsis and available metadata.
- Back navigation preserves the user's context.
- Empty results are handled cleanly.
- The core experience runs entirely from the bundled catalog with no network dependency.
- A 60-second demo can be recorded reliably.

## 15. Instructions for the coding agent

Implement this project as a working, testable application—not merely a design mockup.

1. Inspect the repository and current development environment before making changes.
2. Verify the current official React Native for Vega requirements and APIs. Use documentation that matches the installed SDK version.
3. Establish the smallest working app and run it before building more features.
4. Build the interface with reusable, typed components.
5. Implement remote focus and Back behavior early.
6. Create a small, valid catalog and recommendation logic with unit tests.
7. Keep the core app functional without a network connection.
8. Avoid unsupported packages, unnecessary dependencies, placeholder-only functionality, invented platform APIs, and unlicensed artwork.
9. Run available checks and tests. Clearly report what was tested, what works, and what remains blocked by hardware, SDK, credentials, or network access.
10. Do not claim the app works on a real Fire TV device unless it has actually been tested there.
11. Prioritize a complete, polished, remote-navigable MVP over extra features.

**Implementation priority:** working Vega project → remote navigation → mood-selection UI → catalog and recommendation logic → details and Back behavior → tests → demo polish.
