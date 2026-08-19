# History

## Context

This project started as a local-first climbing session logger MVP for personal gym use.

The initial workflow was:

- Run the Vite dev server on a PC at the gym.
- Access it from an iPhone over the same LAN.
- Store all training data locally in the browser with IndexedDB.

That workflow was later replaced with a GitHub Pages hosted PWA so the app can be launched and used from the iPhone alone.

## Product Decisions

- The app is intentionally local-first.
- IndexedDB is the source of truth.
- Session, Climb, and Attempt raw records are stored.
- Derived values such as attempt counts, sends, fails, interval time, flash, and session duration are calculated from raw records.
- `Attempt.timestamp` means the time the try is considered finished as a training event.
- `Attempt.createdAt` means when the record was actually created in the app.
- `Attempt.updatedAt` means when the attempt was last edited.
- Attempt date editing was intentionally removed.
- Attempt time editing remains available only as a small correction tool for delayed or forgotten recording.

## Reliability Work

- ID generation was centralized because `crypto.randomUUID()` was unavailable on iPhone over LAN HTTP.
- A fallback ID generator was added for non-secure local test environments.
- Current climb selection is UI state and is restored with localStorage.
- Session deletion was added later with double confirmation because it permanently removes the session, its climbs, and its attempts.
- JSON export was added as a manual backup mechanism.
- JSON restore was added as a full local database replacement, not a merge import.

## PWA / Deployment

- GitHub Pages deployment is handled by GitHub Actions.
- The successful deployment required enabling GitHub Pages with `Source: GitHub Actions` in repository settings.
- The app uses `HashRouter` to keep routing simple on GitHub Pages.
- The GitHub Actions build sets `VITE_BASE_PATH` from the repository name.
- A web app manifest, iPhone home screen metadata, safe-area CSS, icons, and a service worker were added for iPhone standalone use.
- The service worker caches the app shell and built static assets so the app can open offline after the first online launch.

## Offline / Storage Notes

- Offline mode is intended for app shell availability and local IndexedDB recording.
- There is no cloud sync.
- Data lives on the specific device/browser profile.
- `navigator.storage.persist()` is requested when available, but the app does not depend on it succeeding.
- Regular JSON export is still recommended as protection against device/browser storage eviction.

## Verified

- GitHub Actions deploy succeeded after GitHub Pages was enabled.
- Local automated checks passed during development:
  - `npm run test:run`
  - `npm run typecheck`
  - `npm run build`
- Playwright smoke checks were used during development for mobile layout, service worker control, offline reload, and offline attempt recording.

## Later Product Evolution

After the PWA baseline was established, the app shifted from a simple attempt logger into a more session-realistic climbing workflow.

The largest conceptual change was moving away from "press FAIL/SEND to record a point event" toward a START -> climbing action -> FAIL/SEND -> rest cycle. This came from the need to distinguish action time from rest time and to make rest intervals meaningful across the whole session, not per problem card.

The session venue also became stricter. Starting a session without choosing a gym was considered too ambiguous, so gym selection became required. Once a session starts, its venue is treated as fixed historical context. During the session, the user can still switch the wall context used for new climbs.

Gym and board concepts were separated because gym walls and standardized boards have different identities and presets. "Gym Wall" is treated as the normal wall of the selected venue, while boards such as Kilter Board, Tension Board, or Moon Board are managed separately.

Grade and wall angle management became user-managed master data. The important product decision is that these presets are allowed to evolve while using the app. Adding, deleting, or simplifying presets should not rewrite past climbing records. Existing climbs keep the meaning they had when recorded.

Wall angle entry was adjusted for in-session use. The app should not require a perfect gym master setup before climbing. Angles can be added from the wall angle selector as needed, duplicate angle entry should be harmless, and impossible angle values should be rejected.

The Current Climb card went through several UX revisions. It moved from a separate add/edit form toward an always-visible card where grade, wall angle, name, and wall can be adjusted directly. Later, these fields became a draft for the next climb: changing one of them no longer mutates the existing climb immediately. Instead, pressing START after a change creates a new climb card and starts the attempt there. This made card creation feel like part of the climbing flow rather than a separate management action.

Because START now creates a new card when the current inputs differ, the explicit "+" button in Recent Climbs became redundant and was removed.

Effort recording was added as optional post-attempt metadata. The attempt itself should be recorded immediately on FAIL/SEND; effort should never delay the core record. The effort prompt appears after FAIL/SEND, can be saved or intentionally skipped, and the skip preference carries forward so repeated no-effort logging is low-friction.

The FAIL/SEND to effort transition was tuned to avoid visual flicker. The desired feel is immediate: after FAIL/SEND, the app should move straight into the effort prompt without briefly showing START or an intermediate saving message.

Rest handling was clarified as session-wide. Rest is the interval since the previous completed attempt, regardless of which climb card that attempt belonged to. The label changed away from problem-specific rest wording to avoid implying the timer belongs to one climb.

Timeline display was redesigned around intervals. Attempt blocks show action segments, and rest blocks represent the space between attempts. Rest blocks are intentionally compact and visually simple because they are derived context, not separate logged records.

The mobile UI was repeatedly tightened around iPhone use. Timestamp editing, sliders, card layout, action buttons, and timeline sizing were adjusted by checking narrow mobile widths. The Current Climb card was reshaped into a clearer control surface with inputs, attempts/rest metrics, and a large bottom START action.

## Transition Performance Notes

Home to Session navigation briefly showed loading and progressive field population because the Session screen rebuilt its data from IndexedDB after navigation. Passing already-loaded data through route state helped the first symptom, but it made routing carry too much application data.

An in-memory active session working set was then introduced so warm navigation can render from memory while IndexedDB remains the persistent source of truth. The intent is:

- warm in-app navigation should be instant
- cold reload or direct URL can rebuild from IndexedDB
- timers should still derive from timestamps, not stored ticking values
- the memory store is a cache, not persistence

The first store attempt made interactions worse because it refreshed the full session snapshot after frequent actions such as START, FAIL, SEND, and effort save. That turned quick UI actions into full IndexedDB reload waits.

The corrected direction is to use full snapshot rebuilds only for cold load, direct URL fallback, and less frequent master-data changes. During normal session operation, successful writes should update the in-memory working set by small deltas such as the created climb, created attempt, updated attempt, or removed attempt.

Another important lesson was that Context updates must be no-op when values have not actually changed. Rewriting the same current climb id into the store created unnecessary snapshot objects, which caused repeated renders and made even simple navigation such as Home feel unreliable.

## Current Out Of Scope

- Authentication
- Supabase or cloud sync
- Strength training
- Statistics and charts
- AI analysis
- JSON merge import
