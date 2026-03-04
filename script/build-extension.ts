import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { build } from "vite";

const ROOT = process.cwd();
const EXT_SRC = path.join(ROOT, "extension");
const DIST_DIR = path.join(ROOT, "dist", "extension");

console.log("Building Chrome extension...\n");

console.log("Step 1: Building UI pages with Vite...");
await build({
  configFile: path.join(ROOT, "vite.extension.config.ts"),
  logLevel: "warn",
});
console.log("  UI pages built successfully.\n");

console.log("Step 2: Building extension scripts with Vite...");
await build({
  configFile: path.join(ROOT, "vite.extension-scripts.config.ts"),
  logLevel: "warn",
});

const srcDir = path.join(DIST_DIR, "src");
if (!fs.existsSync(srcDir)) fs.mkdirSync(srcDir, { recursive: true });

const contentCssSrc = path.join(ROOT, "client", "src", "extension", "content.css");
const contentCssDest = path.join(srcDir, "content.css");
fs.copyFileSync(contentCssSrc, contentCssDest);
console.log("  Copied: src/content.css");
console.log("  Extension scripts built successfully.\n");

console.log("Step 3: Generating icons...");
execSync("npx tsx script/generate-icons.ts", { stdio: "inherit", cwd: ROOT });

const iconsDir = path.join(DIST_DIR, "icons");
if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });

const iconSizes = [16, 48, 128];
for (const size of iconSizes) {
  const src = path.join(EXT_SRC, "icons", `icon${size}.png`);
  const dest = path.join(iconsDir, `icon${size}.png`);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`  Copied: icons/icon${size}.png`);
  }
}

console.log("\nStep 4: Generating manifest.json...");
const manifest = {
  manifest_version: 3,
  name: "Web Highlighter & Comments",
  version: "1.0.0",
  description:
    "Highlight text and add comments on any webpage. Syncs with your Web Highlighter dashboard.",
  permissions: ["storage", "activeTab", "contextMenus"],
  host_permissions: ["<all_urls>"],
  action: {
    default_popup: "popup/index.html",
    default_icon: {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png",
    },
  },
  icons: {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png",
  },
  content_scripts: [
    {
      matches: ["<all_urls>"],
      css: ["src/content.css"],
      js: ["src/content.js"],
      run_at: "document_idle",
    },
  ],
  background: {
    service_worker: "src/background.js",
  },
  options_ui: {
    page: "options/index.html",
    open_in_tab: true,
  },
  content_security_policy: {
    extension_pages: "script-src 'self'; object-src 'self'",
  },
};

fs.writeFileSync(
  path.join(DIST_DIR, "manifest.json"),
  JSON.stringify(manifest, null, 2)
);
console.log("  manifest.json generated.");

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
