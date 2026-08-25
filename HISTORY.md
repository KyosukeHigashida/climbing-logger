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

## Recent Recording Semantics

Climb-level memo was added as a note about the problem itself, such as beta, crux, footholds, or reminders. It is intentionally not treated as a new-climb trigger. Changing grade, wall angle, wall, or name can mean the user is preparing a different climb, but changing memo is usually just adding information to the same climb.

Attempt-level memo was added separately for comments about one try, such as why a fall happened or what changed on that attempt. This distinction matters: climb memo describes the problem, while attempt memo describes the execution.

Effort and attempt memo are collected after FAIL/SEND, but the attempt record itself should already exist by then. This keeps the core logging action fast and preserves the idea that post-attempt metadata can be filled in or skipped without risking the primary record.

The Summary screen is meant to be a review state, not an editing-heavy destructive state. Reopening a session remains possible, but the button is styled as an intentional action. Session deletion was kept out of the immediate post-session summary flow to reduce accidental data loss right after recording.

## Master Data Integrity

Grade and wall angle presets were originally treated as replaceable setup lists. That proved unsafe because old climbs can reference preset IDs. Replacing a master list by deleting and recreating records can leave historical climbs pointing at IDs that no longer exist.

The master-data rule changed: editing gym or board grade/wall-angle presets should preserve existing IDs whenever the same value remains present. Removed presets that have never been used may be deleted, but used presets should be archived instead of hard-deleted.

Archived presets should not appear as normal choices for new climbs. They may still appear when viewing or editing a historical climb that already references them. This allows the gym/board master to evolve while old logs remain understandable.

Wall angle IDs are no longer the only source of display truth. Climbs also carry snapshot values, so a climb should still show its recorded grade or angle even if the original preset is unavailable or archived. The UI should avoid special wording such as "(saved)" and simply display the recorded value naturally.

The same owner boundary remains important: gym presets and board presets can share labels or numeric angles, but they are not the same master records. A gym "V4" and a board "V4", or a gym 40 degree angle and a board 40 degree angle, must not collapse into the same identity.

## Active Session And Master Editing

The app is now expected to support master-data editing during an active session. This came from the practical gym workflow: the user may start climbing before the gym or board master is perfectly prepared, then add or simplify grades, boards, and wall angles as real problems require them.

Home is therefore both a return point for the active session and a place to manage Gym and Board masters. An active session should keep its venue, current climb, active attempt, and current wall state when the user leaves to add or edit master data.

New boards, grades, and wall angles added during an active session should appear as choices when returning to the session without requiring a browser reload. Likewise, deleted or archived unused presets should disappear from normal selectors without forcing the user to refresh the page.

When a selected board is archived or deleted, the session should fall back to Gym Wall rather than leaving the user on an unusable wall state. When a selected wall angle or grade is no longer valid for the current wall context, the Current Climb input should reset to a neutral choice such as No angle or Select Grade instead of preserving a stale old value as if it were still selectable.

Historical climbs remain different from draft inputs. Old climbs may still display the grade or angle they were recorded with, using their stored snapshot values if needed. But the Current Climb draft for a new attempt should reflect the currently valid master choices, especially after switching between Gym Wall and a Board.

Continue Session should feel instant, but it must not preserve stale master choices indefinitely. The desired model is warm navigation from the in-memory active session state, plus a background reconciliation with IndexedDB so master edits made from Home or master pages are reflected as soon as possible.

## Strength Training Integration

Strength training was added to the same session flow because gym sessions often mix climbing attempts and supplemental exercises. The goal is not to create a separate workout app, but to let hangboard, pull, core, or similar work sit inside the same training day.

The session has a single current activity mode. Switching between Climb and Training should feel like changing the current recording surface, not starting a new session. Recent Activity acts as a quick way to return to the relevant current surface.

The core invariant became broader: one session can have at most one active physical action at a time. An active climbing attempt and an active strength set should not overlap. This keeps action/rest interpretation meaningful across mixed climbing and training sessions.

Training effort uses the same style of slider as climb attempt effort because the app should not teach two different rating controls for the same subjective concept. Labels are preferred over raw numeric display in user-facing activity and timeline views.

Training set details were tuned for compact mobile review. Weight, reps, and work duration are displayed as plain values such as "10 kg, 5 reps, 10 sec" rather than symbolic formulas, because the latter was harder to scan beside climbing activity.

Training recording later moved closer to the climb-card mental model. A training name plus its load format is treated like a climb problem identity. The practical meaning is: "Weighted Pull-up, 10 kg, 5 reps, 10 sec" and "Weighted Pull-up, 20 kg, 5 reps, 10 sec" are different training cards, even though their exercise name is the same.

Recent Activity for training should therefore not grow on every START. It should show one recent card per training identity, and the visible sets count should change as completed sets accumulate. This mirrors the climbing side: one climb card can contain multiple attempts.

Set count is intentionally completion-based. Typing a name, changing a draft, or pressing START should not increment the count. A set becomes part of the count only after FINISH, because that is when the physical action has become a completed record.

When the user types a new training name into a draft card, the supporting fields should reset. This prevents accidentally carrying weight, reps, work duration, or memo from an unrelated exercise. When the name matches an existing recent training identity, the latest matching card should repopulate those values so repeat sets are fast.

The word "sets" is preferred in user-facing training labels because the training card represents a collection of completed sets, not a single isolated set. Recent Activity therefore uses wording such as "3 sets" rather than "Set 3".

The phrase "set in progress" was removed from the active training state. The active state should be obvious from the timer and FINISH / cancel controls, and extra labels made the card feel heavier without adding useful information.

Climb and Training share the same rest interval concept. Rest is not owned by a climb card or a training card. It is the elapsed time since the last completed physical activity in the session, whether that previous activity was a climbing attempt or a strength set.

During an active climb attempt or active training set, the same interval display area becomes the action timer for the current activity. A separate second timer on the training card was rejected because it created two competing time displays and made the shared interval model harder to understand.

Training memo follows the climb memo pattern. It belongs on the main training card, above the START / FINISH flow, rather than being hidden only in the post-finish effort step. This lets the user describe the exercise or set context in the same place they enter the training details.

## Current Climb Editing Semantics

Current Climb editing was refined around a real correction scenario: after pressing START, the user may notice that the grade, wall angle, name, or wall context was entered incorrectly. During an active attempt, those edits should correct the current climb record, not prepare a future climb.

The resulting rule is state-based. Before any attempt exists, identity edits change the current climb directly. During an active attempt, identity edits also correct the current climb directly. Only after a completed attempt exists and no attempt is active do identity edits become a draft for the next climb.

This preserves historical integrity without making live correction awkward. Completed climbs are not silently rewritten after the fact, but an in-progress attempt can still be fixed before it is finished.

Memo remains separate from identity. Climb memo is allowed to change on the current climb even after completed attempts, because it is usually a note about the problem rather than proof that the user started a different climb.

## Review And History

The app gained a Session Review / Summary layer to capture end-of-session reflection such as overall RPE and performance. These values are meant to describe the session as a whole, not individual attempts or sets.

Review defaults should carry forward where that reduces repetitive input. The purpose is to make post-session reflection quick enough that it can be done at the gym, while still allowing each session to be adjusted.

A History screen was added because the user needs a way to look back across training days, not only reopen individual recent sessions. The first version focuses on day, week, and month review rather than statistics-heavy analysis.

The calendar is intentionally a data-view style grid. Rounded day chips looked too much like individual buttons and took visual attention away from the activity pattern. A square grid with thin lines makes the monthly distribution easier to scan.

History is documented in Q&A rather than explained below the Home button. Home should stay operational and compact; explanatory text belongs in the help surface.

## Icon And Install Feel

The PWA icon was replaced with a custom visual mark so the installed app feels more intentional on the iPhone home screen. The icon change is presentation only and does not affect storage, routing, service worker behavior, or the local-first data model.

## Statistics

The first statistics feature is an Activity Visualizer rather than a full analytics suite. The goal is to show continuity of activity over time from existing raw records, not to create stored statistics or a separate reporting data model.

Activity, Climb, and Training filters answer different questions. Activity combines attempts and completed strength sets, Climb isolates climbing attempts, and Training isolates completed strength sets. The chart stays derived from IndexedDB records.

Effort filtering uses the same seven-step effort language as attempt and training input. The slider interaction was deliberately aligned with the recording UI so the filter control feels like the same concept viewed from a different angle.

RPE and Performance overlays are session-level review signals. They are drawn separately from activity counts so subjective session review values are not confused with the number of attempts or sets.

Bucket details were added for mobile because hover-only chart inspection is not useful on iPhone. Tapping a bucket should reveal enough detail to understand that period without requiring a desktop pointer.

## Current Out Of Scope

- Authentication
- Supabase or cloud sync
- AI analysis
- JSON merge import
