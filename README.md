# Climbing Session Logger

React + TypeScript + Vite + Dexie.js のクライミングセッション記録 PWA MVP です。

## Commands

```bash
npm install
npm run dev
npm run test:run
npm run typecheck
npm run build
```

GitHub Pages 用の base path は必要に応じて `VITE_BASE_PATH` で指定できます。

```bash
VITE_BASE_PATH=/climbing-logger/ npm run build
```

GitHub Actions deploy uses the repository name as `VITE_BASE_PATH` automatically.

## MVP Scope

- セッション開始、継続、終了
- 複数 Climb の作成と切り替え
- FAIL / SEND attempt の記録
- Attempt timestamp の ISO 8601 保存
- Session timer と Rest timer の表示
- IndexedDB によるリロード後の復元
- 終了済みセッションの summary と timeline 表示
- PWA manifest と Service Worker による app shell cache
- JSON export / restore

## IndexedDB

Dexie database name: `climbingLogger`

Current schema version: `2`

Tables:

- `sessions`: `id, startedAt, endedAt, createdAt, updatedAt`
- `climbs`: `id, sessionId, createdAt, updatedAt`
- `attempts`: `id, sessionId, climbId, timestamp, createdAt, updatedAt`

IndexedDB remains the source of truth for all session data. JSON restore replaces the current local database after validation.

Cloud sync, auth, analytics, images, notifications, and JSON merge import are intentionally out of scope.

## iPhone Install

1. Open the GitHub Pages URL in Safari.
2. Tap Share.
3. Tap Add to Home Screen.
4. Launch Climb Log from the Home Screen.

After the first online launch, the app shell is cached for offline use. Session data stays in IndexedDB on that device. Use Export all data regularly as a manual backup.
