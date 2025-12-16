// Shared/spClient.js
const axios = require("axios");
const { getAccessToken, SITE_URL } = require("./auth");

/**
 * Internal: GET JSON from SharePoint REST API (odata=nometadata)
 */
async function spGet(relativeUrl) {
  const token = await getAccessToken();
  const url = `${SITE_URL}${relativeUrl}`;

  const res = await axios.get(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json;odata=nometadata",
    },
  });

  return res.data;
}

/**
 * Internal: GET raw bytes (arraybuffer) from SharePoint REST API
 */
async function spGetBinary(relativeUrl) {
  const token = await getAccessToken();
  const url = `${SITE_URL}${relativeUrl}`;

  const res = await axios.get(url, {
    responseType: "arraybuffer",
    headers: {
      Authorization: `Bearer ${token}`,
      // Accept not strictly needed for $value, but harmless
      Accept: "*/*",
    },
  });

  // Convert ArrayBuffer to Node Buffer (Azure Functions likes Buffer for isRaw)
  return Buffer.from(res.data);
}

/**
 * Get items from a SharePoint list by its Title.
 * opts: { filter, select, orderby, top }
 */
async function getListItems(listTitle, opts = {}) {
  const params = [];

  if (opts.select) params.push(`$select=${encodeURIComponent(opts.select)}`);
  if (opts.filter) params.push(`$filter=${encodeURIComponent(opts.filter)}`);
  if (opts.orderby) params.push(`$orderby=${encodeURIComponent(opts.orderby)}`);
  if (opts.top) params.push(`$top=${opts.top}`);

  const query = params.length ? `?${params.join("&")}` : "";
  const relativeUrl = `/_api/web/lists/getbytitle('${listTitle}')/items${query}`;

  const data = await spGet(relativeUrl);
  return data.value || (data.d && data.d.results) || [];
}

/**
 * Get a single list item by ID.
 * opts: { select }  e.g. select: "Id,ID,Title,Image,Attachments"
 */
async function getListItemById(listTitle, itemId, opts = {}) {
  if (!itemId && itemId !== 0) throw new Error("itemId is required");

  const params = [];
  if (opts.select) params.push(`$select=${encodeURIComponent(opts.select)}`);

  const query = params.length ? `?${params.join("&")}` : "";
  const relativeUrl = `/_api/web/lists/getbytitle('${listTitle}')/items(${itemId})${query}`;

  return spGet(relativeUrl);
}

/**
 * List attachments for a given list item.
 * Returns: [{ FileName, ServerRelativeUrl }, ...]
 */
async function getListItemAttachments(listTitle, itemId) {
  if (!itemId && itemId !== 0) throw new Error("itemId is required");

  const relativeUrl = `/_api/web/lists/getbytitle('${listTitle}')/items(${itemId})/AttachmentFiles`;
  const data = await spGet(relativeUrl);

  // With odata=nometadata, SharePoint returns { value: [...] }
  const files = data.value || (data.d && data.d.results) || [];

  // Normalize shape just in case
  return files.map((f) => ({
    FileName: f.FileName || f.FileName?.toString?.() || f.FileName,
    ServerRelativeUrl: f.ServerRelativeUrl,
  }));
}

/**
 * Download an attachment file by its ServerRelativeUrl.
 * Returns: Buffer (raw bytes)
 */
async function downloadAttachmentByServerRelativeUrl(serverRelativeUrl) {
  if (!serverRelativeUrl) throw new Error("serverRelativeUrl is required");

  // OData requires single quotes escaped by doubling them
  const escaped = String(serverRelativeUrl).replace(/'/g, "''");

  // $value returns binary
  const relativeUrl = `/_api/web/GetFileByServerRelativeUrl('${escaped}')/$value`;
  return spGetBinary(relativeUrl);
}

module.exports = {
  getListItems,
  getListItemById,
  getListItemAttachments,
  downloadAttachmentByServerRelativeUrl,
};
