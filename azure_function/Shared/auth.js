// Shared/auth.js
const { ConfidentialClientApplication } = require("@azure/msal-node");

const SITE_URL = process.env.SP_SITE_URL;      // e.g. https://tenant.sharepoint.com/sites/YourSite
const TENANT_ID = process.env.TENANT_ID;
const CLIENT_ID = process.env.CLIENT_ID;
const CERT_THUMBPRINT = process.env.CERT_THUMBPRINT;
const CERT_PRIVATE_KEY = process.env.CERT_PRIVATE_KEY;

if (!SITE_URL || !TENANT_ID || !CLIENT_ID || !CERT_THUMBPRINT || !CERT_PRIVATE_KEY) {
  console.warn("One or more SharePoint env vars are missing.");
}

// Normalize PKCS#8 private key
function normalizePrivateKey(pem) {
  if (!pem) return pem;

  const header = "-----BEGIN PRIVATE KEY-----";
  const footer = "-----END PRIVATE KEY-----";

  let raw = pem.replace(/\r/g, "").trim();

  if (raw.startsWith(header) && raw.endsWith(footer)) {
    raw = raw.slice(header.length, raw.length - footer.length).trim();
  }

  raw = raw.replace(/\s+/g, "");
  const wrapped = raw.match(/.{1,64}/g).join("\n");

  return `${header}\n${wrapped}\n${footer}\n`;
}

const msalConfig = {
  auth: {
    clientId: CLIENT_ID,
    authority: `https://login.microsoftonline.com/${TENANT_ID}`,
    clientCertificate: {
      thumbprint: CERT_THUMBPRINT,
      privateKey: normalizePrivateKey(CERT_PRIVATE_KEY)
    }
  }
};

const cca = new ConfidentialClientApplication(msalConfig);

let cachedToken = null;
let cachedExpiry = 0;

async function getAccessToken() {
  const now = Date.now();

  if (cachedToken && now < cachedExpiry - 60 * 1000) {
    return cachedToken;
  }

  const origin = new URL(SITE_URL).origin; // https://tenant.sharepoint.com
  const scope = `${origin}/.default`;

  const result = await cca.acquireTokenByClientCredential({ scopes: [scope] });

  if (!result || !result.accessToken) {
    throw new Error("Failed to acquire access token for SharePoint");
  }

  cachedToken = result.accessToken;
  cachedExpiry = result.expiresOn ? result.expiresOn.getTime() : now + 300000;

  return cachedToken;
}

module.exports = {
  getAccessToken,
  SITE_URL
};
