import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  mkdir,
  readFile,
  realpath,
  readdir,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import runtimePaths from "../../services/platform/runtime-paths.cjs";

const root = path.resolve(process.env.IRIDESCENTLY_PROJECT_ROOT || process.cwd());
const galleryRoot = path.join(root, "apps/www/gallery-engine");
const sourceDir = process.env.GALLERY_DIR || path.join(
  runtimePaths.assetsRoot,
  "source/罗小黑战记数据库/罗小黑节气贺图（gallery素材）",
);
const manifestPath = path.join(runtimePaths.cacheRoot, "ops", "gallery-manifest.json");
const supportedTypes = new Map([
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"],
]);

function hashFile(file) {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(file);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

const { discoverGallery } = await import(
  pathToFileURL(path.join(galleryRoot, "gallery-plugin.js"))
);
const discovered = await discoverGallery(sourceDir);
if (!discovered.length) throw new Error(`No Gallery images found in ${sourceDir}`);
const sourceRoot = await realpath(sourceDir);

const files = [];
for (const item of discovered) {
  const name = item.name.replaceAll("\\", "/");
  const parts = name.split("/");
  if (
    !name ||
    name.startsWith("/") ||
    parts.some((part) => !part || part === "." || part === "..")
  ) {
    throw new Error(`Unsafe Gallery path: ${item.name}`);
  }
  const type = supportedTypes.get(path.extname(name).toLowerCase());
  if (!type) throw new Error(`Unsupported Gallery type: ${name}`);
  const file = path.resolve(sourceDir, ...parts);
  const realFile = await realpath(file);
  const relativeFile = path.relative(sourceRoot, realFile);
  if (
    relativeFile.startsWith(`..${path.sep}`) ||
    relativeFile === ".." ||
    path.isAbsolute(relativeFile)
  ) {
    throw new Error(`Gallery image resolves outside the source directory: ${name}`);
  }
  const fileStat = await stat(file);
  files.push({
    key: `gallery/${name}`,
    source: name,
    size: fileStat.size,
    sha256: await hashFile(file),
    mime: type,
    category: "gallery",
  });
}
files.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));

async function findGifs(directory, prefix = "") {
  const excluded = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const name = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      excluded.push(...(await findGifs(path.join(directory, entry.name), name)));
    } else if (entry.isFile() && path.extname(entry.name).toLowerCase() === ".gif") {
      excluded.push({
        key: `gallery/${name}`,
        source: name,
        status: "UNSUPPORTED/EXCLUDED",
        reason: "GIF is not supported by the current Gallery pipeline.",
      });
    }
  }
  return excluded;
}
const excluded = (await findGifs(sourceDir)).sort((a, b) =>
  a.key < b.key ? -1 : a.key > b.key ? 1 : 0,
);

const version = createHash("sha256")
  .update(
    JSON.stringify({
      files: files.map(({ key, size, sha256 }) => [key, size, sha256]),
      excluded,
    }),
  )
  .digest("hex");
const manifest = {
  version,
  count: files.length,
  totalBytes: files.reduce((sum, file) => sum + file.size, 0),
  files,
  excluded,
};
const output = `${JSON.stringify(manifest, null, 2)}\n`;

if (process.argv.includes("--check")) {
  let current;
  try {
    current = await readFile(manifestPath, "utf8");
  } catch {}
  if (current !== output) {
    throw new Error("Gallery manifest is missing or stale; run npm run assets:manifest");
  }
} else {
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, output);
}

console.log(
  `Gallery manifest ${version.slice(0, 16)}: ${files.length} files, ${manifest.totalBytes} bytes.`,
);
