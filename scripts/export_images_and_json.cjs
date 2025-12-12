// scripts/process_use_cases_with_images.js
// Purpose:
// 1) Read SharePoint-exported raw JSON (public/data/use_cases.raw.json)
// 2) For items with attachments, download cover image via Azure Function
// 3) Save cover as cover.<ext> (png/jpg/webp/gif) based on response headers
// 4) Write normalized JSON (public/data/use_cases.json) with correct CoverImage/Images paths

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const rawPath = "public/data/use_cases.raw.json";
const outJsonPath = "public/data/use_cases.json";

if (!fs.existsSync(rawPath)) {
  console.error(`Missing raw JSON: ${rawPath}`);
  process.exit(1);
}

const items = JSON.parse(fs.readFileSync(rawPath, "utf8"));

const baseImageUrl = process.env.AZURE_FUNC_URL_IMAGE;
const key = process.env.AZURE_FUNC_KEY;

if (!baseImageUrl || !key) {
  console.error("Missing AZURE_FUNC_URL_IMAGE or AZURE_FUNC_KEY env vars");
  process.exit(1);
}

const imagesRoot = path.join("public", "images", "use-cases");
fs.mkdirSync(imagesRoot, { recursive: true });

function parseHeaderFileToMap(headerText) {
  // curl -D outputs headers; redirects can produce multiple header blocks.
  // We use the LAST header block (final response).
  const blocks = headerText
    .split(/\r?\n\r?\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  const last = blocks[blocks.length - 1] || "";
  const lines = last.split(/\r?\n/);

  const map = new Map();
  for (const line of lines) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const k = line.slice(0, idx).trim().toLowerCase();
    const v = line.slice(idx + 1).trim();
    map.set(k, v);
  }
  return map;
}

function filenameFromContentDisposition(cd = "") {
  // Handles: inline; filename="cover.png"
  // Also tolerates filename*=UTF-8''cover.png
  const m = String(cd).match(/filename\*?=(?:UTF-8''|")?([^;"\r\n"]+)/i);
  if (!m) return null;
  return m[1].replace(/"/g, "").trim();
}

function extFromFilename(name = "") {
  const m = String(name).match(/\.([a-zA-Z0-9]+)$/);
  return m ? m[1].toLowerCase() : null;
}

function extFromContentType(ct = "") {
  const s = String(ct).toLowerCase();
  if (s.includes("image/png")) return "png";
  if (s.includes("image/jpeg")) return "jpg";
  if (s.includes("image/webp")) return "webp";
  if (s.includes("image/gif")) return "gif";
  return null;
}

function isSupportedImageExt(ext = "") {
  return ["png", "jpg", "jpeg", "webp", "gif"].includes(String(ext).toLowerCase());
}

function cleanOldCovers(folder) {
  // Remove any previously saved cover.* to prevent stale files lingering.
  // Keep only non-cover assets.
  const files = fs.existsSync(folder) ? fs.readdirSync(folder) : [];
  for (const f of files) {
    if (/^cover\.(png|jpe?g|webp|gif|tmp)$/i.test(f)) {
      try {
        fs.unlinkSync(path.join(folder, f));
      } catch {}
    }
    if (/^headers\.txt$/i.test(f)) {
      try {
        fs.unlinkSync(path.join(folder, f));
      } catch {}
    }
  }
}

let downloaded = 0;
let skipped = 0;
let failed = 0;

for (const it of items) {
  const id = it.ID ?? it.Id ?? it.id;
  if (!id) continue;

  if (!it.Attachments) {
    it.Images = [];
    it.CoverImage = null;
    skipped++;
    continue;
  }

  const folder = path.join(imagesRoot, String(id));
  fs.mkdirSync(folder, { recursive: true });

  // IMPORTANT: remove any stale cover.* from prior runs
  cleanOldCovers(folder);

  const url = `${baseImageUrl}?itemId=${encodeURIComponent(id)}&code=${encodeURIComponent(
    key
  )}`;

  const tmpFile = path.join(folder, "cover.tmp");
  const headerFile = path.join(folder, "headers.txt");

  try {
    // Download body + headers
    // -sSL: silent + follow redirects + show errors on failure
    // -D: write headers to file
    // -o: write body to tmp file
    execFileSync("curl", ["-sSL", "-D", headerFile, url, "-o", tmpFile], {
      stdio: "inherit",
    });

    const st = fs.statSync(tmpFile);
    if (st.size === 0) throw new Error("Downloaded file is empty");

    const headersText = fs.readFileSync(headerFile, "utf8");
    const headers = parseHeaderFileToMap(headersText);

    const cd = headers.get("content-disposition") || "";
    const ct = headers.get("content-type") || "";

    const servedName = filenameFromContentDisposition(cd);
    let ext = extFromFilename(servedName) || extFromContentType(ct);

    // Normalize jpeg -> jpg
    if (ext === "jpeg") ext = "jpg";

    if (!ext || !isSupportedImageExt(ext)) {
      // Last-resort fallback
      ext = "jpg";
    }

    const outFile = path.join(folder, `cover.${ext}`);
    fs.renameSync(tmpFile, outFile);

    // Cleanup headers file
    try {
      fs.unlinkSync(headerFile);
    } catch {}

    const rel = `/images/use-cases/${id}/cover.${ext}`;
    it.Images = [rel];
    it.CoverImage = rel;

    downloaded++;
  } catch (e) {
    // Cleanup partials
    try {
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    } catch {}
    try {
      if (fs.existsSync(headerFile)) fs.unlinkSync(headerFile);
    } catch {}

    it.Images = [];
    it.CoverImage = null;

    failed++;
    console.error(`Cover image export failed for ID=${id}: ${e.message}`);
  }
}

fs.writeFileSync(outJsonPath, JSON.stringify(items, null, 2));

console.log(`Wrote ${outJsonPath} (${items.length} items)`);
console.log(
  `Images: downloaded=${downloaded}, skipped(no attachments)=${skipped}, failed=${failed}`
);
