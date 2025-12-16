const axios = require("axios");
const { ConfidentialClientApplication } = require("@azure/msal-node");

/**
 * Normalize whatever is in CERT_PRIVATE_KEY into a proper PKCS#8 PEM:
 * - Strip header/footer
 * - Remove all whitespace
 * - Re-wrap to 64-char lines
 * - Re-add header/footer with newlines
 */
function normalizePrivateKey(pem) {
  if (!pem) return pem;

  const header = "-----BEGIN PRIVATE KEY-----";
  const footer = "-----END PRIVATE KEY-----";

  let body = pem.replace(header, "").replace(footer, "");

  // Remove all whitespace (spaces, tabs, newlines, etc.)
  body = body.replace(/[\r\n\s]/g, "");

  // Split into 64-character lines
  const chunks = body.match(/.{1,64}/g) || [];
  const wrapped = chunks.join("\n");

  return `${header}\n${wrapped}\n${footer}`;
}

module.exports = async function (context, req) {
  const tenantId = process.env.TENANT_ID;
  const clientId = process.env.CLIENT_ID;
  const spSiteUrl = process.env.SP_SITE_URL;
  const listId = process.env.SP_LIST_ID;

  const certThumbprint = process.env.CERT_THUMBPRINT;
  const rawCertPrivateKey = process.env.CERT_PRIVATE_KEY;

  try {
    // 0) Safety check for missing configs
    const missing = [];
    if (!tenantId) missing.push("TENANT_ID");
    if (!clientId) missing.push("CLIENT_ID");
    if (!spSiteUrl) missing.push("SP_SITE_URL");
    if (!listId) missing.push("SP_LIST_ID");
    if (!certThumbprint) missing.push("CERT_THUMBPRINT");
    if (!rawCertPrivateKey) missing.push("CERT_PRIVATE_KEY");

    if (missing.length > 0) {
      throw new Error("Missing environment variables: " + missing.join(", "));
    }

    // 1) Normalize the private key to a proper PEM
    const certPrivateKey = normalizePrivateKey(rawCertPrivateKey);
    context.log(
      "Normalized private key length:",
      certPrivateKey ? certPrivateKey.length : "missing"
    );

    // 2) Prepare MSAL client with certificate
    const spOrigin = new URL(spSiteUrl).origin; // e.g. https://tenant.sharepoint.com

    const msalConfig = {
      auth: {
        clientId: clientId,
        authority: `https://login.microsoftonline.com/${tenantId}`,
        clientCertificate: {
          thumbprint: certThumbprint,
          privateKey: certPrivateKey,
        },
      },
    };

    const cca = new ConfidentialClientApplication(msalConfig);

    // 3) Acquire token for SharePoint using app-only + certificate
    const tokenResponse = await cca.acquireTokenByClientCredential({
      scopes: [`${spOrigin}/.default`], // Uses SharePoint app permissions (Sites.Read.All)
    });

    if (!tokenResponse || !tokenResponse.accessToken) {
      throw new Error("Failed to acquire access token");
    }

    const accessToken = tokenResponse.accessToken;

    // 4) Call SharePoint REST API using list GUID
    const spResp = await axios.get(
      `${spSiteUrl}/_api/web/lists(guid'${listId}')/items?$select=Id,Text,Title,Modified,No`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json;odata=nometadata",
        },
      }
    );

    const rawItems = spResp.data.value || [];

    const items = rawItems.map((item) => ({
      id: item.Id,
      title: item.Title || "",
      text: item.Text || "",
      modified: item.Modified || "",
      num: item.No || "",
    }));

    context.res = {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: items,
    };
  } catch (err) {
    context.log("ERROR message:", err.message);
    context.log("ERROR status:", err.response?.status);
    context.log("ERROR data:", err.response?.data);

    context.res = {
      status: 500,
      body: {
        error: "Failed to read SharePoint list",
        message: err.message,
        status: err.response?.status || null,
        data: err.response?.data || null,
      },
    };
  }
};
