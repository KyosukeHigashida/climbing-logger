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

## Out Of Scope

- Authentication
- Supabase or cloud sync
- Gym master data
- Grade system editor
- Strength training
- Statistics and charts
- AI analysis
- JSON merge import
