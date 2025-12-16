const { getListItems } = require("../Shared/spClient");

const MAIN_LIST = process.env.SP_LIST_TITLE;

const FIELD_CANDIDATES = {
  thumbnail: ["Thumbnail", "thumbnail"],
  cover: ["CoverImage", "Cover_Image", "Cover_x0020_Image", "Cover Image", "coverImage", "cover"],
};

function parseSpImageField(value) {
  if (!value) return { fileName: null, serverRelativeUrl: null, url: null };

  let v = value;

  if (typeof v === "string") {
    try {
      v = JSON.parse(v);
    } catch {
      const maybeUrl = v.trim();
      return {
        fileName: maybeUrl.split("/").pop() || null,
        serverRelativeUrl: null,
        url: maybeUrl || null,
      };
    }
  }

  const fileName =
    v?.fileName ||
    v?.FileName ||
    v?.name ||
    v?.Name ||
    null;

  const serverRelativeUrl =
    v?.serverRelativeUrl ||
    v?.ServerRelativeUrl ||
    null;

  const url =
    v?.serverUrl && v?.serverRelativeUrl
      ? String(v.serverUrl).replace(/\/$/, "") + String(v.serverRelativeUrl)
      : v?.url || v?.Url || null;

  return { fileName, serverRelativeUrl, url };
}

function pickField(item, candidates = []) {
  for (const key of candidates) {
    if (item && Object.prototype.hasOwnProperty.call(item, key)) {
      return item[key];
    }
  }
  return null;
}

module.exports = async function (context, req) {
  try {
    const items = await getListItems(MAIN_LIST, { orderby: "Created desc" });

    const enriched = (Array.isArray(items) ? items : []).map((it) => {
      const thumbRaw = pickField(it, FIELD_CANDIDATES.thumbnail);
      const coverRaw = pickField(it, FIELD_CANDIDATES.cover);

      const thumb = parseSpImageField(thumbRaw);
      const cover = parseSpImageField(coverRaw);

      return {
        ...it,
        ThumbnailUrl: thumb.url || null,
        ThumbnailServerRelativeUrl: thumb.serverRelativeUrl || null,
        CoverImageUrl: cover.url || null,
        CoverImageServerRelativeUrl: cover.serverRelativeUrl || null,
      };
    });

    context.res = {
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: enriched,
    };
  } catch (err) {
    const status = err?.response?.status || 500;

    context.log.error("Error in get-usecase-data:", {
      status,
      message: err?.message,
      spData: err?.response?.data,
      stack: err?.stack,
    });

    context.res = {
      status,
      headers: { "Content-Type": "application/json" },
      body: { error: "Internal server error" },
    };
  }
};
