const axios = require("axios");
const { ManagedIdentityCredential } = require("@azure/identity");

module.exports = async function (context, req) {
  try {
    const spSiteUrl = process.env.SP_SITE_URL;  // e.g. https://tenant.sharepoint.com/sites/MySite
    const listId = process.env.SP_LIST_ID;      // GUID of the list

    if (!spSiteUrl || !listId) {
      throw new Error("Missing SP_SITE_URL or SP_LIST_ID");
    }

    // 1) Use Managed Identity to get a token for Microsoft Graph
    const credential = new ManagedIdentityCredential();
    const graphScope = "https://graph.microsoft.com/.default";

    const token = await credential.getToken(graphScope);
    if (!token || !token.token) {
      throw new Error("Failed to acquire Managed Identity access token for Graph");
    }

    const accessToken = token.token;

    // 2) Build Graph URL for the SharePoint site & list
    const siteUrl = new URL(spSiteUrl);
    const hostname = siteUrl.hostname;   // e.g. yourtenant.sharepoint.com
    const sitePath = siteUrl.pathname;   // e.g. /sites/MySite

    const graphUrl = `https://graph.microsoft.com/v1.0/sites/${hostname}:${sitePath}:/lists/${listId}/items`;

    // 3) Call Graph to get list items and selected fields
    const graphResp = await axios.get(graphUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json"
      },
      params: {
        "$expand": "fields($select=Id,Title,Modified)",
        "$top": 100
      }
    });

    const rawItems = graphResp.data && graphResp.data.value ? graphResp.data.value : [];

    const items = rawItems.map(item => ({
      id: item.fields?.Id ?? item.id,
      title: item.fields?.Title || "",
      modified: item.fields?.Modified || ""
    }));

    context.res = {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: items
    };

  } catch (err) {
    context.log("ERROR message:", err.message);
    context.log("ERROR status:", err.response?.status);
    context.log("ERROR data:", err.response?.data);

    context.res = {
      status: 500,
      body: {
        error: "Failed to read SharePoint list via Graph + Managed Identity",
        message: err.message,
        status: err.response?.status || null,
        data: err.response?.data || null
      }
    };
  }
};
