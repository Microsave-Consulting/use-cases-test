// scripts/export_images_and_json.cjs
// Purpose:
// 1) Read SharePoint-exported raw JSON (public/data/use_cases.raw.json)
// 2) Download:
//    a) Thumbnail via Azure Function (?kind=thumbnail)  [STRICT]
//    b) Cover via Azure Function (?kind=cover)          [STRICT]
// 3) Save as thumbnail.<ext> and cover.<ext> based on response headers
// 4) Write normalized JSON (public/data/use_cases.json) with:
//    - Thumbnail (relative path)
//    - CoverImage (relative path)
//    - Images = [CoverImage] (back-compat)
//
// IMPORTANT changes vs earlier version:
// - No gating on it.Attachments (image columns are not necessarily attachments)
// - curl uses -f so 404/500 fails the download step and we do not write junk files
// - Always cleans stale cover/thumbnail files before attempting downloads

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
  // Use the LAST header block (final response).
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
  // Handles:
  // - inline; filename="cover.png"
  // - attachment; filename=cover.png
  // - filename*=UTF-8''cover.png
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

function cleanOldImages(folder) {
  // Remove stale cover.* / thumbnail.* and temp/header artifacts
  const files = fs.existsSync(folder) ? fs.readdirSync(folder) : [];
  for (const f of files) {
    if (/^(cover|thumbnail)\.(png|jpe?g|webp|gif|tmp)$/i.test(f)) {
      try {
        fs.unlinkSync(path.join(folder, f));
      } catch {}
    }
    if (/^headers\.(cover|thumbnail)\.txt$/i.test(f)) {
      try {
        fs.unlinkSync(path.join(folder, f));
      } catch {}
    }
  }
}

function buildImageUrl(itemId, kind) {
  // Azure Functions key via querystring
  return `${baseImageUrl}?itemId=${encodeURIComponent(itemId)}&kind=${encodeURIComponent(
    kind
  )}&code=${encodeURIComponent(key)}`;
}

function downloadKind({ id, folder, kind }) {
  const tmpFile = path.join(folder, `${kind}.tmp`);
  const headerFile = path.join(folder, `headers.${kind}.txt`);
  const url = buildImageUrl(id, kind);

  // IMPORTANT:
  // -f  => fail on HTTP errors (e.g., 404) so we don't save HTML as an "image"
  // -sS => silent but still show errors
  // -L  => follow redirects
  execFileSync("curl", ["-f", "-sS", "-L", "-D", headerFile, url, "-o", tmpFile], {
    stdio: "inherit",
  });

  const st = fs.statSync(tmpFile);
  if (st.size === 0) throw new Error(`${kind} download is empty`);

  const headersText = fs.readFileSync(headerFile, "utf8");
  const headers = parseHeaderFileToMap(headersText);

  const cd = headers.get("content-disposition") || "";
  const ct = headers.get("content-type") || "";

  const servedName = filenameFromContentDisposition(cd);
  let ext = extFromFilename(servedName) || extFromContentType(ct);

  // Normalize jpeg -> jpg
  if (ext === "jpeg") ext = "jpg";

  if (!ext || !isSupportedImageExt(ext)) {
    ext = "jpg"; // last-resort fallback
  }

  const outFile = path.join(folder, `${kind}.${ext}`);
  fs.renameSync(tmpFile, outFile);

  // Cleanup headers file
  try {
    fs.unlinkSync(headerFile);
  } catch {}

  const rel = `/images/use-cases/${id}/${kind}.${ext}`;
  return rel;
}

let skippedMissingId = 0;

let coverDownloaded = 0;
let coverMissing = 0; // 404 from strict API
let coverFailed = 0;

let thumbDownloaded = 0;
let thumbMissing = 0; // 404 from strict API
let thumbFailed = 0;

for (const it of items) {
  const id = it.ID ?? it.Id ?? it.id;
  if (!id) {
    skippedMissingId++;
    continue;
  }

  // Default outputs each run (prevents stale JSON fields)
  it.Thumbnail = null;
  it.CoverImage = null;
  it.Images = [];

  const folder = path.join(imagesRoot, String(id));
  fs.mkdirSync(folder, { recursive: true });

  // Remove stale files from prior runs
  cleanOldImages(folder);

  // Thumbnail (library card)
  try {
    const relThumb = downloadKind({ id, folder, kind: "thumbnail" });
    it.Thumbnail = relThumb;
    thumbDownloaded++;
  } catch (e) {
    // Treat strict 404 as "missing" not "failed"
    const msg = String(e?.message || "");
    if (msg.toLowerCase().includes("curl") && msg.includes("(22)")) {
      // curl returns exit code 22 for HTTP errors when -f is used
      thumbMissing++;
    } else {
      thumbFailed++;
    }

    // Cleanup partials
    try {
      const tmp = path.join(folder, "thumbnail.tmp");
      if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    } catch {}
    try {
      const hf = path.join(folder, "headers.thumbnail.txt");
      if (fs.existsSync(hf)) fs.unlinkSync(hf);
    } catch {}

    it.Thumbnail = null;
  }

  // Cover (detail hero)
  try {
    const relCover = downloadKind({ id, folder, kind: "cover" });
    it.CoverImage = relCover;
    it.Images = [relCover]; // back-compat for older consumers
    coverDownloaded++;
  } catch (e) {
    const msg = String(e?.message || "");
    if (msg.toLowerCase().includes("curl") && msg.includes("(22)")) {
      coverMissing++;
    } else {
      coverFailed++;
    }

    // Cleanup partials
    try {
      const tmp = path.join(folder, "cover.tmp");
      if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    } catch {}
    try {
      const hf = path.join(folder, "headers.cover.txt");
      if (fs.existsSync(hf)) fs.unlinkSync(hf);
    } catch {}

    it.CoverImage = null;
    it.Images = [];
  }
}

fs.writeFileSync(outJsonPath, JSON.stringify(items, null, 2));

console.log(`Wrote ${outJsonPath} (${items.length} items)`);
console.log(
  [
    `Thumbnail: downloaded=${thumbDownloaded}, missing(404)=${thumbMissing}, failed=${thumbFailed}`,
    `Cover: downloaded=${coverDownloaded}, missing(404)=${coverMissing}, failed=${coverFailed}`,
    `Skipped: missing ID=${skippedMissingId}`,
  ].join(" | ")
);
