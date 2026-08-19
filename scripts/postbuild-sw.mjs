import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";

const distDir = "dist";
const swPath = join(distDir, "sw.js");
const assetDirs = ["assets", "icons"];

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
    .replace('"self.__CACHE_VERSION__"', JSON.stringify(`climbing-logger-${cacheVersion}`))
    .replace("self.__APP_ASSETS__ || []", JSON.stringify(assets, null, 2)),
);
