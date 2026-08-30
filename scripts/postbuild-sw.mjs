import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";

const distDir = "dist";
const swPath = join(distDir, "sw.js");
const assetDirs = ["assets", "icons"];
const basePath = normalizeBasePath(process.env.VITE_BASE_PATH ?? "/");
const devScopePath = normalizeBasePath(process.env.VITE_DEV_BASE_PATH ?? `${basePath.replace(/\/dev\/$/, "/")}dev/`);
const cacheScope = basePath.replace(/^\/|\/$/g, "").replace(/[^a-zA-Z0-9]+/g, "-") || "root";

async function collectFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const path = join(dir, entry.name);
      return entry.isDirectory() ? collectFiles(path) : path;
    }),
  );
  return files.flat();
}

const assets = [];
for (const assetDir of assetDirs) {
  try {
    const files = await collectFiles(join(distDir, assetDir));
    assets.push(...files.map((file) => `./${relative(distDir, file).split(sep).join("/")}`));
  } catch {
    // The directory is optional.
  }
}

const sw = await readFile(swPath, "utf8");
const versionHash = createHash("sha256").update(sw).update(JSON.stringify(assets));
for (const file of ["index.html", "manifest.webmanifest"]) {
  try {
    versionHash.update(await readFile(join(distDir, file)));
  } catch {
    // Optional app-shell file.
  }
}
const cacheVersion = versionHash.digest("hex").slice(0, 12);

await writeFile(
  swPath,
  sw
    .replace('"self.__CACHE_VERSION__"', JSON.stringify(`climbing-logger-${cacheScope}-${cacheVersion}`))
    .replace('"self.__CACHE_PREFIX__"', JSON.stringify(`climbing-logger-${cacheScope}-`))
    .replace('"self.__APP_SCOPE__"', JSON.stringify(basePath))
    .replace('"self.__DEV_SCOPE__"', JSON.stringify(devScopePath))
    .replace("self.__OWNS_DEV_SCOPE__", JSON.stringify(basePath === devScopePath))
    .replace("self.__APP_ASSETS__ || []", JSON.stringify(assets, null, 2)),
);

function normalizeBasePath(value) {
  const withLeadingSlash = value.startsWith("/") ? value : `/${value}`;
  return withLeadingSlash.endsWith("/") ? withLeadingSlash : `${withLeadingSlash}/`;
}
