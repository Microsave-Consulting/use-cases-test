// get-page-data/index.js
const { getListItems } = require("../Shared/spClient");

// List titles from env (with sensible defaults)
const PAGES_LIST = process.env.SP_LIST_PAGES || "Pages";
const SECTIONS_LIST = process.env.SP_LIST_SECTIONS || "Sections";
const SECTION_ITEMS_LIST = process.env.SP_LIST_SECTIONITEMS || "SectionItems";
const ASSETS_LIST = process.env.SP_LIST_ASSETS || "Assets";

// Escape single quotes for OData
function escapeOData(str) {
  return (str || "").replace(/'/g, "''");
}

module.exports = async function (context, req) {
  try {
    const slug = (req.query.slug || req.query.Slug || "").trim();

    if (!slug) {
      context.res = {
        status: 400,
        body: { error: "Missing 'slug' query parameter" }
      };
      return;
    }

    //
    // 1) PAGE (from Pages list)
    //
    const pages = await getListItems(PAGES_LIST, {
      filter: `Slug eq '${escapeOData(slug)}'`,
      top: 1
    });

    if (!pages.length) {
      context.res = {
        status: 404,
        body: { error: `Page not found for slug '${slug}'` }
      };
      return;
    }

    const p = pages[0];

    const page = {
      id: p.Id,
      title: p.Title,
      slug: p.Slug,
      seoTitle: p.SeoTitle,
      seoDescription: p.SeoDescription,
      socialImageUrl: p.SocialImageUrl,
      language: p.Language
    };

    //
    // 2) SECTIONS (filtered by PageSlug)
    //
    const sectionsRaw = await getListItems(SECTIONS_LIST, {
      filter: `PageSlug eq '${escapeOData(slug)}'`,
      orderby: "SortOrder asc"
    });

    const sections = sectionsRaw.map((s) => ({
      id: s.Id,
      pageSlug: s.PageSlug,
      sectionKey: s.SectionKey,
      sectionType: s.SectionType,
      heading: s.Heading,
      subheading: s.Subheading,
      introText: s.IntroText,
      bodyText: s.BodyText,
      heroBgImageUrl: s.HeroBgImageUrl,
      heroIconUrl: s.HeroIconUrl,
      primaryCtaLabel: s.PrimaryCtaLabel,
      primaryCtaHref: s.PrimaryCtaHref,
      extraJson: s.ExtraJson,
      sortOrder: s.SortOrder,
      items: []
    }));

    //
    // 3) SECTION ITEMS (filtered by PageSlug)
    //
    const itemsRaw = await getListItems(SECTION_ITEMS_LIST, {
      filter: `PageSlug eq '${escapeOData(slug)}'`,
      orderby: "SectionKey asc, SortOrder asc"
    });

    const items = itemsRaw.map((i) => ({
      id: i.Id,
      pageSlug: i.PageSlug,
      sectionKey: i.SectionKey,
      itemType: i.ItemType,
      groupLabel: i.GroupLabel,
      label: i.Label,
      subtitle: i.Subtitle,
      title: i.Title,
      description: i.Description,
      bullets: i.Bullets,
      valueText: i.ValueText,
      url: i.Url,
      iconUrl: i.IconUrl,
      location: i.Location,
      stageCode: i.StageCode,
      dateRange: i.DateRange,
      extraJson: i.ExtraJson,
      sortOrder: i.SortOrder
    }));

    // Group items by SectionKey
    const itemsBySectionKey = {};
    for (const item of items) {
      if (!itemsBySectionKey[item.sectionKey]) {
        itemsBySectionKey[item.sectionKey] = [];
      }
      itemsBySectionKey[item.sectionKey].push(item);
    }

    // Attach items to each section
    for (const section of sections) {
      section.items = itemsBySectionKey[section.sectionKey] || [];
    }

    //
    // 4) ASSETS (no filter)
    //
    const assetsRaw = await getListItems(ASSETS_LIST);
    const assets = {};
    for (const a of assetsRaw) {
      assets[a.Key] = {
        key: a.Key,
        title: a.Title,
        url: a.Url,
        altText: a.AltText
      };
    }

    //
    // 5) Final response
    //
    const payload = {
      page,
      sections,
      assets
    };

    context.res = {
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: payload
    };
  } catch (err) {
    const status = err.response?.status || 500;
    const spData = err.response?.data;

    context.log.error("Error in get-page-data:", {
      status,
      message: err.message,
      spData
    });

    const debug = req.query.debug === "1";

    context.res = {
      status,
      body: debug
        ? {
            error: "SharePoint call failed",
            status,
            message: err.message,
            spResponse: spData
          }
        : {
            error: "Internal server error",
            details: err.message
          }
    };
  }
};
