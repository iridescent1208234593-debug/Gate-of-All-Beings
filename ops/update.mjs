import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { lookup } from "node:dns/promises";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(root, "ops/assets/gallery-manifest.json");
const manifestScript = path.join(root, "ops/assets-manifest.mjs");
const wranglerScript = path.join(root, "node_modules/wrangler/bin/wrangler.js");
const bucket = "iridescently-assets";
const command = process.argv[2] || "full";
const startedAt = new Date();
const reportPath = path.join(
  root,
  ".updates",
  `${startedAt.toISOString().replaceAll(":", "-").replaceAll(".", "-")}.json`,
);
const report = {
  timestamp: startedAt.toISOString(),
  branch: null,
  previousCommit: null,
  newCommit: null,
  build: { status: "not-run" },
  tests: { status: "not-run" },
  gitPush: { status: "not-run" },
  assetManifest: null,
  uploaded: [],
  replaced: [],
  skipped: [],
  warnings: [],
};

function call(exe, args, { capture = true } = {}) {
  const windowsNpm = process.platform === "win32" && exe === "npm";
  const result = spawnSync(windowsNpm ? "npm.cmd" : exe, args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    shell: windowsNpm,
    stdio: capture ? "pipe" : "inherit",
  });
  if (result.error) throw result.error;
  return { status: result.status ?? 1, stdout: result.stdout || "", stderr: result.stderr || "" };
}

function git(...args) {
  const result = call("git", args);
  if (result.status !== 0) throw new Error(result.stderr.trim() || `git ${args.join(" ")} failed`);
  return result.stdout.trim();
}

function gitOutput(...args) {
  const result = call("git", args);
  if (result.status !== 0) throw new Error(result.stderr.trim() || `git ${args.join(" ")} failed`);
  return result.stdout.replace(/(?:\r?\n)+$/, "");
}

function run(exe, args) {
  const result = call(exe, args, { capture: false });
  if (result.status !== 0) throw new Error(`${exe} ${args.join(" ")} failed (${result.status})`);
}

async function confirm(prompt) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) return false;
  const input = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await input.question(`${prompt} [y/N] `)).trim().toLowerCase() === "y";
  } finally {
    input.close();
  }
}

function jsonFromFile(file) {
  return readFile(file, "utf8").then((content) => JSON.parse(content));
}

function assetPlan(manifest, cloud) {
  return {
    managed: manifest?.count ?? null,
    totalBytes: manifest?.totalBytes ?? null,
    unsupported: manifest?.excluded?.length ?? 0,
    new: cloud.r2Enabled ? "pending remote listing" : "unknown: R2 disabled",
    changed: cloud.r2Enabled ? "pending remote listing" : "unknown: R2 disabled",
    unchanged: cloud.r2Enabled ? "pending remote listing" : "unknown: R2 disabled",
    remoteOnly: cloud.r2Enabled ? "pending remote listing" : "unknown: R2 disabled",
    status: cloud.r2Enabled ? "remote diff unavailable" : "blocked: R2 disabled",
  };
}

async function cloudStatus() {
  const auth = existsSync(wranglerScript)
    ? call(process.execPath, [wranglerScript, "whoami"])
    : { status: 1, stdout: "", stderr: "Wrangler dependency missing" };
  const r2 = auth.status === 0
    ? call(process.execPath, [wranglerScript, "r2", "bucket", "list"])
    : { status: 1, stdout: "", stderr: "Wrangler auth missing" };
  let assetDomain = { dns: "unknown", https: "unknown" };
  try {
    const resolved = await lookup("assets.iridescently.xyz");
    assetDomain.dns = resolved.address;
  } catch {
    assetDomain.dns = "missing";
  }
  try {
    const response = await fetch("https://assets.iridescently.xyz/", {
      method: "HEAD",
      signal: AbortSignal.timeout(8000),
    });
    assetDomain.https = `HTTP ${response.status}`;
  } catch {
    assetDomain.https = "unreachable";
  }
  const output = `${r2.stdout}\n${r2.stderr}`;
  return {
    wranglerAuth: auth.status === 0 ? "configured" : "missing",
    r2Enabled: r2.status === 0,
    r2Status: /10042|enable R2/i.test(output) ? "subscription required" : r2.status === 0 ? "configured" : "unavailable",
    bucket: output.includes(bucket) ? bucket : r2.status === 0 ? `${bucket}: missing` : `${bucket}: not checked`,
    assetDomain,
  };
}

async function getStatus() {
  const status = gitOutput("status", "--porcelain=v1");
  let manifest = null;
  let manifestStatus = "missing";
  try {
    manifest = await jsonFromFile(manifestPath);
    manifestStatus = call(process.execPath, [manifestScript, "--check"]).status === 0 ? "current" : "stale";
  } catch {
    manifestStatus = "missing or source unavailable";
  }
  let tracking = "unconfigured";
  try {
    tracking = git("rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}");
  } catch {}
  const counts = {
    staged: git("diff", "--cached", "--name-only").split(/\r?\n/).filter(Boolean).length,
    modified: git("diff", "--name-only").split(/\r?\n/).filter(Boolean).length,
    untracked: git("ls-files", "--others", "--exclude-standard").split(/\r?\n/).filter(Boolean).length,
    conflict: git("ls-files", "-u").split(/\r?\n/).filter(Boolean).length,
  };
  let aheadBehind = null;
  if (tracking !== "unconfigured") {
    const [ahead, behind] = git("rev-list", "--left-right", "--count", `HEAD...${tracking}`).split(/\s+/).map(Number);
    aheadBehind = { ahead, behind };
  }
  const cloud = await cloudStatus();
  return {
    git: {
      branch: git("branch", "--show-current"),
      head: git("rev-parse", "HEAD"),
      origin: git("remote", "get-url", "origin"),
      tracking,
      aheadBehind,
      ...counts,
    },
    assets: {
      manifest: manifestStatus,
      managed: manifest?.count ?? null,
      totalBytes: manifest?.totalBytes ?? null,
      new: cloud.r2Enabled ? "pending remote listing" : "unknown: R2 disabled",
      changed: cloud.r2Enabled ? "pending remote listing" : "unknown: R2 disabled",
      unchanged: cloud.r2Enabled ? "pending remote listing" : "unknown: R2 disabled",
      remoteOnly: cloud.r2Enabled ? "pending remote listing" : "unknown: R2 disabled",
      unsupported: manifest?.excluded ?? [],
    },
    cloud,
  };
}

function printStatus(status) {
  console.log(JSON.stringify(status, null, 2));
}

function filesChanged() {
  return gitOutput("status", "--porcelain=v1", "--untracked-files=all")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.slice(3).replace(/^"|"$/g, ""));
}

function outgoingAudit(base, head) {
  const commits = git("rev-list", `${base}..${head}`).split(/\r?\n/).filter(Boolean);
  const paths = commits.flatMap((commit) =>
    git("show", "--format=", "--name-only", commit).split(/\r?\n/).filter(Boolean),
  );
  const forbidden = paths.filter((file) =>
    /(^|\/)(\.env(?:\.|$)|.*\.(?:pem|key|db|sqlite3?)|.*\.bak(?:-|$)|backup|credentials?|sessions?|cookies?|cache|logs?|user[-_ ]?uploads|\.codex-remote-attachments|users\.db|save\.db)(\/|$)/i.test(file),
  );
  const patch = commits.map((commit) => git("show", "--format=", "--unified=0", commit)).join("\n");
  const secretLike = /BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY|gh[pousr]_[A-Za-z0-9]{20,}|(?:api[_-]?key|secret|password|token)\s*[:=]\s*["'][^"'\s]{12,}/i.test(patch);
  return { commits, forbidden: [...new Set(forbidden)], secretLike };
}

async function saveReport() {
  report.newCommit = call("git", ["rev-parse", "HEAD"]).stdout.trim() || null;
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`[update] Report: ${path.relative(root, reportPath)}`);
}

async function runCode() {
  report.branch = git("branch", "--show-current");
  report.previousCommit = git("rev-parse", "HEAD");
  const allowlist = new Set([
    ".gitignore", "README.md", "docs/README.md", "docs/assets.md", "docs/update-system.md",
    "package.json", "package-lock.json", "ops/assets-manifest.mjs", "ops/update.mjs",
    "ops/assets/gallery-manifest.json",
  ]);
  const changed = filesChanged();
  const unknown = changed.filter((file) => !allowlist.has(file.replaceAll("\\", "/")));
  if (unknown.length) throw new Error(`Unknown worktree changes; stopped without staging: ${unknown.join(", ")}`);
  run("git", ["diff", "--check"]);
  const homepagePath = path.join(root, "portal/www/index.html");
  const originalHomepage = await readFile(homepagePath);
  try {
    run("npm", ["run", "build:modules"]);
    report.build = { status: "passed" };
  } finally {
    await writeFile(homepagePath, originalHomepage);
  }
  run("npm", ["run", "test:portal"]);
  report.tests = { status: "passed" };
  run(process.execPath, [manifestScript, "--check"]);

  const files = changed.map((file) => file.replaceAll("\\", "/"));
  if (files.length) {
    run("git", ["add", "--", ...files]);
    const staged = git("diff", "--cached", "--name-only").split(/\r?\n/).filter(Boolean);
    if (staged.some((file) => !allowlist.has(file))) throw new Error("Unexpected staged path; stopped before commit.");
    run("git", ["diff", "--cached", "--check"]);
    const stagePatch = git("diff", "--cached", "--unified=0");
    if (/BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY|gh[pousr]_[A-Za-z0-9]{20,}|(?:api[_-]?key|secret|password|token)\s*[:=]\s*["'][^"'\s]{12,}/i.test(stagePatch)) {
      throw new Error("Secret-like staged content detected; stopped before commit.");
    }
    run("git", ["commit", "-m", "feat: add safe repository and asset update pipeline"]);
  }

  const audit = outgoingAudit("origin/master", "master");
  if (audit.forbidden.length || audit.secretLike) {
    report.gitPush = {
      status: "blocked",
      reason: "The existing local master ahead commits failed the requested safety audit.",
      forbiddenPaths: audit.forbidden,
      secretLike: audit.secretLike,
    };
    throw new Error("Push blocked: local master contains unreviewed risky history; no remote write performed.");
  }
  if (await confirm(`Push ${report.branch} to origin?`)) {
    run("git", ["push", "-u", "origin", report.branch]);
    const localHead = git("rev-parse", "HEAD");
    const remoteHead = git("ls-remote", "origin", `refs/heads/${report.branch}`).split(/\s+/)[0];
    if (remoteHead !== localHead) throw new Error("Push verification failed: remote branch does not match local HEAD.");
    report.gitPush = { status: "verified", ref: `origin/${report.branch}`, sha: localHead };
  } else {
    report.gitPush = { status: "awaiting-confirmation" };
  }
}

async function runAssets() {
  const checked = call(process.execPath, [manifestScript, "--check"]);
  if (checked.status !== 0) throw new Error("Gallery manifest is stale; regenerate and review it before asset sync.");
  const manifest = await jsonFromFile(manifestPath);
  report.assetManifest = {
    version: manifest.version,
    count: manifest.count,
    totalBytes: manifest.totalBytes,
  };
  const cloud = await cloudStatus();
  if (!cloud.wranglerAuth) throw new Error("Wrangler OAuth is not configured.");
  if (!cloud.r2Enabled) throw new Error(`R2 is unavailable: ${cloud.r2Status}. Stop before uploads.`);
  throw new Error("R2 is enabled, but remote object listing/Pilot is not yet verified; no upload was performed.");
}

async function main() {
  if (command === "status") {
    printStatus(await getStatus());
    return;
  }
  if (command === "check") {
    const status = await getStatus();
    const audit = outgoingAudit("origin/master", "master");
    const warnings = [];
    if (audit.forbidden.length || audit.secretLike) warnings.push("Local master outgoing history is unsafe to push.");
    if (!status.cloud.r2Enabled) warnings.push(`R2 plan blocked: ${status.cloud.r2Status}.`);
    printStatus({
      codePlan: filesChanged(),
      assetPlan: assetPlan({ count: status.assets.managed, totalBytes: status.assets.totalBytes, excluded: status.assets.unsupported }, status.cloud),
      buildPlan: "npm run build:modules",
      testPlan: "npm run test:portal",
      gitPushPlan: { commits: audit.commits.length, forbiddenPaths: audit.forbidden, secretLike: audit.secretLike, status: audit.forbidden.length || audit.secretLike ? "blocked" : "requires confirmation" },
      r2UploadPlan: status.cloud.r2Enabled ? "blocked pending remote diff and Pilot" : "blocked: R2 disabled",
      warnings,
    });
    return;
  }
  if (command === "code" || command === "full") {
    try {
      await runCode();
    } finally {
      if (command === "code") await saveReport();
    }
    if (report.gitPush.status !== "pushed") throw new Error("Code stage did not push; asset stage stopped.");
  }
  if (command === "assets" || command === "full") {
    try {
      await runAssets();
    } finally {
      await saveReport();
    }
  }
  if (!new Set(["status", "check", "code", "assets", "full"]).has(command)) {
    throw new Error(`Unknown update command: ${command}`);
  }
}

main().catch((error) => {
  report.warnings.push(error.message);
  console.error(`[update] ${error.message}`);
  process.exitCode = 1;
  if (command === "code" || command === "assets" || command === "full") {
    saveReport().catch((saveError) => console.error(`[update] Report write failed: ${saveError.message}`));
  }
});
