import { createHash } from "node:crypto";
import {
  createReadStream,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { candidateRoot, releaseRoot, recordCandidate } from "../../../tools/release/release-artifacts.mjs";
import runtimePaths from "../../../services/platform/runtime-paths.cjs";

const homepageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const projectRoot = path.resolve(homepageRoot, "../../../portal");
const galleryRoot = path.join(
  projectRoot,
  "apps/www/gallery-engine",
);
const galleryDir = process.env.GALLERY_DIR || path.join(
  runtimePaths.assetsRoot, "source/罗小黑战记数据库/罗小黑节气贺图（gallery素材）",
);
const stageDir = path.join(releaseRoot, ".work/homepage");
const homepageCandidate = path.join(candidateRoot, "homepage");
const publicDir = path.join(homepageCandidate, "assets/homepage");
const viteBin = path.join(galleryRoot, "node_modules/vite/bin/vite.js");
const viteConfig = path.join(homepageRoot, "vite.config.mjs");
const viteNodeModule = path.join(
  galleryRoot,
  "node_modules/vite/dist/node/index.js",
);
const galleryPluginModule = path.join(galleryRoot, "gallery-plugin.js");
const previewDir = path.join(runtimePaths.cacheRoot, "homepage", "gallery-previews");
const operationsEnv = {
  ...process.env,
  IRIDESCENTLY_PROJECT_ROOT: projectRoot,
  GALLERY_DIR: galleryDir,
  GALLERY_PREVIEW_DIR: previewDir,
};
const [{ loadEnv }, { resolveGalleryAssetBase, discoverGallery }] =
  await Promise.all([
    import(pathToFileURL(viteNodeModule)),
    import(pathToFileURL(galleryPluginModule)),
  ]);
const galleryAssetBase = resolveGalleryAssetBase(
  loadEnv("production", homepageRoot, "VITE_"),
);
const galleryUsesCdn = /^https?:\/\//i.test(galleryAssetBase);

function ensureInside(parent, candidate) {
  const relative = path.relative(parent, candidate);
  if (
    !relative ||
    relative.startsWith(`..${path.sep}`) ||
    relative === ".." ||
    path.isAbsolute(relative)
  ) {
    throw new Error(
      `Refusing to clean a path outside its dedicated homepage output: ${candidate}`,
    );
  }
}

function runVite(args) {
  if (!existsSync(viteBin)) {
    throw new Error(
      `Gallery build dependencies are missing. Install them in: ${galleryRoot}`,
    );
  }
  return spawnSync(
    process.execPath,
    [viteBin, ...args, "--config", viteConfig],
    {
      cwd: homepageRoot,
      env: { ...operationsEnv, GALLERY_PREVIEW_DIR: previewDir },
      stdio: "inherit",
    },
  );
}

if (process.argv.includes("--dev")) {
  const previews = spawnSync(
    process.execPath,
    [path.join(projectRoot, "tools/build/build-gallery-previews.mjs")],
    { cwd: projectRoot, stdio: "inherit", env: operationsEnv },
  );
  if (previews.error) throw previews.error;
  if (previews.status !== 0) process.exit(previews.status ?? 1);
  const dev = runVite(["--host", "127.0.0.1"]);
  if (dev.error) throw dev.error;
  process.exit(dev.status ?? 1);
}

ensureInside(releaseRoot, stageDir);
ensureInside(candidateRoot, homepageCandidate);
ensureInside(homepageCandidate, publicDir);
rmSync(path.join(candidateRoot, "homepage.json"), { force: true });
rmSync(homepageCandidate, { recursive: true, force: true });

const previews = spawnSync(
  process.execPath,
  [path.join(projectRoot, "tools/build/build-gallery-previews.mjs")],
  { cwd: projectRoot, stdio: "inherit", env: operationsEnv },
);
if (previews.error) throw previews.error;
if (previews.status !== 0) process.exit(previews.status ?? 1);

const build = runVite(["build"]);
if (build.error) throw build.error;
if (build.status !== 0) process.exit(build.status ?? 1);

const manifest = await discoverGallery(galleryDir);
if (manifest.length === 0)
  throw new Error(`No supported Gallery images found in ${galleryDir}`);
const gallerySourceHash = createHash("sha256");
for (const asset of manifest) {
  gallerySourceHash.update(asset.name, "utf8").update("\0");
  for await (const chunk of createReadStream(path.join(galleryDir, ...asset.name.split("/")))) {
    gallerySourceHash.update(chunk);
  }
}

const builtHomepagePath = path.join(stageDir, "homepage.html");
const builtHomepage = readFileSync(builtHomepagePath, "utf8");
for (const asset of [
  "/assets/homepage/homepage.js",
  "/assets/homepage/homepage.css",
]) {
  if (!builtHomepage.includes(asset)) {
    throw new Error(`Homepage build output is missing its ${asset} reference`);
  }
}

const assetVersion = createHash("sha256")
  .update(readFileSync(path.join(stageDir, "homepage.js")))
  .update(readFileSync(path.join(stageDir, "homepage.css")))
  .digest("hex")
  .slice(0, 16);
const versionedHomepage = [
  "/assets/homepage/homepage.js",
  "/assets/homepage/homepage.css",
].reduce(
  (html, asset) => html.replace(asset, `${asset}?v=${assetVersion}`),
  builtHomepage,
);

rmSync(homepageCandidate, { recursive: true, force: true });
mkdirSync(publicDir, { recursive: true });
for (const entry of readdirSync(stageDir, { withFileTypes: true })) {
  if (entry.name === "homepage.html" || entry.name === "index.html") continue;
  cpSync(path.join(stageDir, entry.name), path.join(publicDir, entry.name), {
    recursive: true,
  });
}
writeFileSync(path.join(homepageCandidate, "index.html"), versionedHomepage);
await recordCandidate("homepage", {
  buildCommand: "npm run build:homepage",
  externalAssets: [{
    name: "seasonal-gallery-source",
    source: process.env.GALLERY_DIR ? "GALLERY_DIR (external asset directory)" : "assets/罗小黑战记数据库/罗小黑节气贺图（gallery素材）",
    directory: path.basename(galleryDir),
    fileCount: manifest.length,
    sha256: gallerySourceHash.digest("hex"),
  }],
});

console.log(
  galleryUsesCdn
    ? `[homepage] Candidate: ${manifest.length} Gallery preview CDN references; originals stay in the persistent server asset library behind the authenticated API. Upload gallery-previews before publishing.`
    : `[homepage] Candidate: ${manifest.length} locally served WebP previews; original images stay in the persistent server asset library behind the authenticated API.`,
);
console.log(`[homepage] ${homepageCandidate} — seal it with the site and modules candidates via npm run release:seal.`);
