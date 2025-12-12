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

  const outFile = path.join(folder, "cover.jpg");

  const url = `${baseImageUrl}?itemId=${encodeURIComponent(id)}&code=${encodeURIComponent(
    key
  )}`;

  try {
    execFileSync("curl", ["-sL", url, "-o", outFile], { stdio: "inherit" });

    const st = fs.statSync(outFile);
    if (st.size === 0) throw new Error("Downloaded file is empty");

    const rel = `/images/use-cases/${id}/cover.jpg`;
    it.Images = [rel];
    it.CoverImage = rel;

    downloaded++;
  } catch (e) {
    try {
      if (fs.existsSync(outFile)) fs.unlinkSync(outFile);
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
