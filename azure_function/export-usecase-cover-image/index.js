const {
  getListItemById,
  getListItemAttachments,
  downloadAttachmentByServerRelativeUrl,
} = require("../Shared/spClient");

const MAIN_LIST = process.env.SP_LIST_TITLE;

function getExt(fileName = "") {
  const m = String(fileName).match(/\.([a-zA-Z0-9]+)$/);
  return m ? m[1].toLowerCase() : "jpg";
}

function guessContentTypeFromExt(ext = "") {
  switch (ext) {
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    default:
      return "application/octet-stream";
  }
}

function parseImageFieldToFileName(value) {
  if (!value) return null;

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed?.fileName || parsed?.FileName || null;
    } catch {
      return null;
    }
  }

  return value?.fileName || value?.FileName || null;
}

module.exports = async function (context, req) {
  try {
    const itemId = Number(req.query.itemId);
    if (!itemId) {
      context.res = { status: 400, body: "Missing or invalid itemId" };
      return;
    }

    const download = String(req.query.download || "").toLowerCase();
    const dispositionType =
      download === "1" || download === "true" ? "attachment" : "inline";

    // STRICT: Only use CoverImage field's referenced attachment
    const item = await getListItemById(MAIN_LIST, itemId, {
      select: "Id,ID,Cover_x0020_Image,Attachments,Modified",
    });

    const targetFileName = parseImageFieldToFileName(item?.Cover_x0020_Image);

    if (!targetFileName) {
      context.res = { status: 404, body: "No CoverImage set for this item" };
      return;
    }

    const attachments = await getListItemAttachments(MAIN_LIST, itemId);
    const chosen = (attachments || []).find((a) => a.FileName === targetFileName) || null;

    if (!chosen) {
      context.res = {
        status: 404,
        body: `CoverImage is set but attachment not found: ${targetFileName}`,
      };
      return;
    }

    const ext = getExt(chosen.FileName);
    const contentType = guessContentTypeFromExt(ext);

    const fileBuffer = await downloadAttachmentByServerRelativeUrl(chosen.ServerRelativeUrl);

    context.res = {
      status: 200,
      isRaw: true,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `${dispositionType}; filename="cover.${ext}"`,
        "Cache-Control": "no-store",
        "X-Item-Id": String(itemId),
        "X-Source-Filename": chosen.FileName,
      },
      body: fileBuffer,
    };
  } catch (err) {
    const status = err?.response?.status || 500;

    context.log.error("Error in export-usecase-cover-image:", {
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
