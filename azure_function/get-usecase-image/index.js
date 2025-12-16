const {
  getListItemById,
  getListItemAttachments,
  downloadAttachmentByServerRelativeUrl,
} = require("../Shared/spClient");

const MAIN_LIST = process.env.SP_LIST_TITLE;

function guessContentType(fileName = "") {
  const f = String(fileName).toLowerCase();
  if (f.endsWith(".png")) return "image/png";
  if (f.endsWith(".webp")) return "image/webp";
  if (f.endsWith(".gif")) return "image/gif";
  if (f.endsWith(".jpg") || f.endsWith(".jpeg")) return "image/jpeg";
  return "application/octet-stream";
}

function parseImageFieldToFileName(value) {
  // SharePoint is returning Thumbnail as a JSON string like:
  // {"fileName":"Reserved_ImageAttachment_....png","originalImageName":"..."}
  if (!value) return null;

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed?.fileName || parsed?.FileName || null;
    } catch {
      return null;
    }
  }

  // In case SP returns an object (rare)
  return value?.fileName || value?.FileName || null;
}

module.exports = async function (context, req) {
  try {
    const itemId = Number(req.query.itemId);
    if (!itemId) {
      context.res = { status: 400, body: "Missing or invalid itemId" };
      return;
    }

    const kindRaw = String(req.query.kind || "thumbnail").toLowerCase();
    const kind = kindRaw === "cover" ? "cover" : "thumbnail";
    const fieldName = kind === "cover" ? "Cover_x0020_Image" : "Thumbnail";

    // Read item field to find the reserved attachment file name
    const item = await getListItemById(MAIN_LIST, itemId, {
      select: `Id,ID,${fieldName},Attachments,Modified`,
    });

    const targetFileName = parseImageFieldToFileName(item?.[fieldName]);

    // STRICT: if field not set, return 404
    if (!targetFileName) {
      context.res = {
        status: 404,
        body: kind === "cover" ? "No CoverImage set for this item" : "No Thumbnail set for this item",
      };
      return;
    }

    // List attachments and STRICT-match by FileName
    const attachments = await getListItemAttachments(MAIN_LIST, itemId);
    const chosen = (attachments || []).find((a) => a.FileName === targetFileName) || null;

    if (!chosen) {
      context.res = {
        status: 404,
        body: `Image field is set but attachment not found: ${targetFileName}`,
      };
      return;
    }

    const fileBuffer = await downloadAttachmentByServerRelativeUrl(chosen.ServerRelativeUrl);

    context.res = {
      status: 200,
      isRaw: true,
      headers: {
        "Content-Type": guessContentType(chosen.FileName),
        "Content-Disposition": `inline; filename="${chosen.FileName}"`,
        "Cache-Control": "no-store",
        "X-Item-Id": String(itemId),
        "X-Image-Kind": kind,
        "X-Source-Filename": chosen.FileName,
      },
      body: fileBuffer,
    };
  } catch (err) {
    const status = err?.response?.status || 500;

    context.log.error("Error in get-usecase-image:", {
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
