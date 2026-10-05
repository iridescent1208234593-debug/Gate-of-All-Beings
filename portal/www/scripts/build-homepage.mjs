import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const homepageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const projectRoot = path.resolve(homepageRoot, "../..");
const galleryRoot = path.join(
  projectRoot,
  "New project/gallery/codrops-depth-gallery",
);
const galleryDir =
  process.env.GALLERY_DIR ||
  path.join(
    projectRoot,
    "assets/罗小黑战记数据库/罗小黑节气贺图（gallery素材）",
  );
const stageDir = path.join(homepageRoot, ".homepage-build");
const publishDir = path.join(homepageRoot, ".homepage-publish");
const publicDir = path.join(homepageRoot, "assets/homepage");
const viteBin = path.join(galleryRoot, "node_modules/vite/bin/vite.js");
const viteConfig = path.join(homepageRoot, "vite.config.mjs");

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

function hashFile(file) {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(file);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(hash.digest("hex")));
  });
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
      stdio: "inherit",
    },
  );
}

if (process.argv.includes("--dev")) {
  const dev = runVite(["--host", "127.0.0.1"]);
  if (dev.error) throw dev.error;
  process.exit(dev.status ?? 1);
}

ensureInside(homepageRoot, stageDir);
ensureInside(homepageRoot, publishDir);
ensureInside(path.join(homepageRoot, "assets"), publicDir);

const build = runVite(["build"]);
if (build.error) throw build.error;
if (build.status !== 0) process.exit(build.status ?? 1);

const manifestModule = await import(
  pathToFileURL(path.join(galleryRoot, "gallery-plugin.js"))
);
const manifest = await manifestModule.discoverGallery(galleryDir);
if (manifest.length === 0)
  throw new Error(`No supported Gallery images found in ${galleryDir}`);

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

const stagedGalleryDir = path.join(stageDir, "gallery-files");
const stagedGalleryFiles = [];
for (const file of manifest) {
  const source = path.resolve(galleryDir, ...file.name.split("/"));
  const staged = path.resolve(stagedGalleryDir, ...file.name.split("/"));
  ensureInside(galleryDir, source);
  ensureInside(stagedGalleryDir, staged);
  if (!existsSync(staged))
    throw new Error(`Gallery build output is missing ${file.name}`);
  if (statSync(source).size !== statSync(staged).size) {
    throw new Error(`Gallery build size changed for ${file.name}`);
  }
  stagedGalleryFiles.push({ source, staged, name: file.name });
}

if (stagedGalleryFiles.length !== manifest.length) {
  throw new Error(
    `Expected ${manifest.length} Gallery files; staged ${stagedGalleryFiles.length}`,
  );
}

for (const file of stagedGalleryFiles) {
  if ((await hashFile(file.source)) !== (await hashFile(file.staged))) {
    throw new Error(`Gallery build SHA-256 mismatch: ${file.name}`);
  }
}

rmSync(publishDir, { recursive: true, force: true });
mkdirSync(publishDir, { recursive: true });
for (const entry of readdirSync(stageDir, { withFileTypes: true })) {
  if (entry.name === "homepage.html" || entry.name === "index.html") continue;
  cpSync(path.join(stageDir, entry.name), path.join(publishDir, entry.name), {
    recursive: true,
  });
}

rmSync(publicDir, { recursive: true, force: true });
mkdirSync(publicDir, { recursive: true });
for (const entry of readdirSync(publishDir, { withFileTypes: true })) {
  cpSync(path.join(publishDir, entry.name), path.join(publicDir, entry.name), {
    recursive: true,
  });
}
rmSync(publishDir, { recursive: true, force: true });
writeFileSync(path.join(homepageRoot, "index.html"), versionedHomepage);

console.log(
  `[homepage] Published ${manifest.length} Gallery assets with matching SHA-256 hashes.`,
);
