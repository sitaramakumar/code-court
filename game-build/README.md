# Code Court

**By Sitarama Kumar Mokkapati**

Code Court is a real-time courtroom bluffing game for 2–8 players. Players join with a six-character room code, no account required. Developer and General question modes, private fake suggestions, host-controlled or timed phases, scoring, host handoff, leaving, ending, and replay are included.

## Netlify project

- The frontend is in `public/` and is built to `dist/`.
- The standard Netlify Function is `netlify/functions/game.ts` and is available at `/.netlify/functions/game`.
- Room state is stored in the site-wide `code-court-rooms` Netlify Blobs store. The function opts into strong consistency and uses ETag conditional writes for updates and room-code creation.
- `lib/game-core.js` and `questions.js` are shared helpers outside the functions directory.
- `netlify.toml` contains the build, publish, and function directory settings. No separate database, API key, or application environment variable is needed.

## Netlify publishing note

`npm run package` produces `netlify-ready-game.zip` (complete source, lockfile and `netlify.toml`). Uploading that zip via Netlify Drop built the project and activated the `game` Function. Verified on the live site: room creation (HTTP 201), joining from a second player (HTTP 200), and the host's state showing both players across separate function calls (Netlify Blobs persistence).

## Verification

The project test runs a complete three-round, two-player game against an in-memory Blobs-compatible store. It checks room creation and joining, private suggestions, host advances, truth and speed scoring, a correct Judge prediction, reveal reasons, and the final winner. `npm run build` creates the production frontend and the bundled function artifact; `npm run package` also creates the project ZIP.
