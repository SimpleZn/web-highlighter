import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const ROOT = process.cwd();
const EXT_SRC = path.join(ROOT, "extension");
const DIST_DIR = path.join(ROOT, "dist", "extension");

console.log("Building Chrome extension...\n");

if (fs.existsSync(DIST_DIR)) {
  fs.rmSync(DIST_DIR, { recursive: true });
}
fs.mkdirSync(DIST_DIR, { recursive: true });
fs.mkdirSync(path.join(DIST_DIR, "src"), { recursive: true });
fs.mkdirSync(path.join(DIST_DIR, "icons"), { recursive: true });

console.log("Generating icons...");
execSync("npx tsx script/generate-icons.ts", { stdio: "inherit", cwd: ROOT });

const filesToCopy = [
  "manifest.json",
  "popup.html",
  "popup.css",
  "popup.js",
  "options.html",
  "options.css",
  "options.js",
  "src/background.js",
  "src/content.js",
  "src/content.css",
];

for (const file of filesToCopy) {
  const src = path.join(EXT_SRC, file);
  const dest = path.join(DIST_DIR, file);
  const destDir = path.dirname(dest);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`  Copied: ${file}`);
  } else {
    console.warn(`  Warning: ${file} not found`);
  }
}

const iconSizes = [16, 48, 128];
for (const size of iconSizes) {
  const src = path.join(EXT_SRC, "icons", `icon${size}.png`);
  const dest = path.join(DIST_DIR, "icons", `icon${size}.png`);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`  Copied: icons/icon${size}.png`);
  }
}

const fileCount = countFiles(DIST_DIR);
const totalSize = getDirSize(DIST_DIR);

console.log("\n========================================");
console.log("  Chrome Extension Build Complete!");
console.log("========================================");
console.log(`  Output:  dist/extension/`);
console.log(`  Files:   ${fileCount}`);
console.log(`  Size:    ${(totalSize / 1024).toFixed(1)} KB`);
console.log("========================================");
console.log("\nTo install in Chrome:");
console.log("  1. Open chrome://extensions");
console.log("  2. Enable 'Developer mode'");
console.log("  3. Click 'Load unpacked'");
console.log(`  4. Select the '${path.relative(ROOT, DIST_DIR)}' folder`);
console.log("");

function countFiles(dir: string): number {
  let count = 0;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      count += countFiles(path.join(dir, entry.name));
    } else {
      count++;
    }
  }
  return count;
}

function getDirSize(dir: string): number {
  let size = 0;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      size += getDirSize(fullPath);
    } else {
      size += fs.statSync(fullPath).size;
    }
  }
  return size;
}
