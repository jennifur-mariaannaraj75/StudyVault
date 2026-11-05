const axios = require("axios");

const HTTP_HEADERS = {
  "User-Agent": "StudyVaultAcademicResearchApp/2.0 (https://github.com/jennifur-mariaannaraj75/StudyVault; educational-research)",
  Accept: "application/json",
};

/**
 * Cleans up a raw topic or query string into a focused academic search query.
 */
function buildCleanSearchQuery(rawTopic, notebookTitle = "") {
  let cleaned = String(rawTopic || "")
    .replace(/\[.*?\]/g, "")
    .replace(/^(?:explain|what is|define|diagram of|show me|generate|image of)\s+/i, "")
    .replace(/[^\w\s/\-+.#]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned || cleaned.length < 2) {
    cleaned = String(notebookTitle || "Computer Science Architecture").trim();
  }
  return cleaned.slice(0, 80);
}

/**
 * Searches Wikipedia articles for the topic and extracts all technical diagrams/figures inside those articles.
 */
async function searchWikipediaArticleImages(query, limit = 6) {
  const results = [];
  try {
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
      query
    )}&srlimit=4&format=json&origin=*`;
    const searchRes = await axios.get(searchUrl, { headers: HTTP_HEADERS, timeout: 6500 });
    const pages = searchRes.data?.query?.search || [];
    if (pages.length === 0) return results;

    const titles = pages.map((p) => p.title).join("|");

    // 1. Get main pageimages + internal images list from the matched Wikipedia articles
    const propUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(
      titles
    )}&prop=pageimages|images|info&inprop=url&piprop=original|thumbnail&pithumbsize=1000&imlimit=25&format=json&origin=*`;
    const propRes = await axios.get(propUrl, { headers: HTTP_HEADERS, timeout: 6500 });
    const pageMap = propRes.data?.query?.pages || {};

    const extraFileTitles = [];
    const fileToArticleMap = {};

    for (const page of Object.values(pageMap)) {
      const articleUrl = page.fullurl || `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title)}`;
      const thumbUrl = page?.thumbnail?.source || page?.original?.source;
      if (
        thumbUrl &&
        !/flag_of|commons-logo|wiki_letter|ambox|padlock|question_book|edit-clear|disambig|icon|nuvola|crystal_clear|folder| portal/i.test(
          thumbUrl
        )
      ) {
        results.push({
          id: `wiki_${page.pageid || results.length}`,
          title: `${page.title} — Technical Diagram`,
          imageUrl: thumbUrl,
          thumbUrl: thumbUrl,
          thumbnailUrl: thumbUrl,
          sourceName: "Wikipedia Encyclopedia",
          sourceUrl: articleUrl,
          googleSearchUrl: `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(page.title + " diagram")}`,
          caption: `External reference diagram from Wikipedia article "${page.title}".`,
          kind: "wikipedia_diagram",
        });
      }

      // Collect embedded SVG/PNG figures from the article
      const imList = page?.images || [];
      for (const im of imList) {
        const imTitle = String(im.title || "");
        if (!/\.(?:svg|png)$/i.test(imTitle)) continue;
        if (
          /flag[\s_-]*of|commons[\s_-]*logo|wiki[\s_-]*letter|ambox|padlock|question[\s_-]*book|edit[\s_-]*clear|disambig|icon|symbol|logo|stub|nuvola|oojs|wikimedia|wiktionary|wikibooks|wikiquote|wikisource|wikiversity|speaker|listen|increase|decrease|steady|lock-|merge|split|text[\s_-]*document/i.test(
            imTitle
          )
        ) {
          continue;
        }
        if (!extraFileTitles.includes(imTitle) && extraFileTitles.length < 12) {
          extraFileTitles.push(imTitle);
          fileToArticleMap[imTitle] = { articleTitle: page.title, articleUrl };
        }
      }
    }

    // 2. Resolve URLs for embedded Wikipedia article figures
    if (extraFileTitles.length > 0 && results.length < limit) {
      const iiUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(
        extraFileTitles.join("|")
      )}&prop=imageinfo&iiprop=url|dimensions&iiurlwidth=1000&format=json&origin=*`;
      const iiRes = await axios.get(iiUrl, { headers: HTTP_HEADERS, timeout: 6500 });
      const iiPages = iiRes.data?.query?.pages || {};

      for (const fPage of Object.values(iiPages)) {
        if (results.length >= limit) break;
        const ii = fPage?.imageinfo?.[0];
        if (!ii) continue;
        const w = ii.width || ii.thumbwidth || 0;
        const h = ii.height || ii.thumbheight || 0;
        if (w > 0 && h > 0 && (w < 160 || h < 110)) continue; // skip tiny icons

        const imgUrl = ii.thumburl || ii.url;
        if (!imgUrl || results.some((r) => r.imageUrl === imgUrl)) continue;

        const cleanName = String(fPage.title || "")
          .replace(/^File:/i, "")
          .replace(/\.(?:svg|png|jpe?g)$/i, "")
          .replace(/[_-]+/g, " ")
          .trim();
        const meta = fileToArticleMap[fPage.title] || {};

        results.push({
          id: `wikifig_${results.length}_${Date.now().toString(36)}`,
          title: cleanName || `${meta.articleTitle || query} Diagram`,
          imageUrl: imgUrl,
          thumbUrl: imgUrl,
          thumbnailUrl: imgUrl,
          sourceName: `Wikipedia (${meta.articleTitle || "Article"})`,
          sourceUrl: meta.articleUrl || ii.descriptionurl || imgUrl,
          googleSearchUrl: `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(
            (cleanName || query) + " diagram"
          )}`,
          caption: `Technical figure "${cleanName}" from Wikipedia article "${meta.articleTitle || query}".`,
          kind: "wikipedia_diagram",
        });
      }
    }
  } catch (err) {
    console.warn("[webImageSearch] Wikipedia image search notice:", err.message);
  }
  return results.slice(0, limit);
}

/**
 * Searches Wikimedia Commons specifically for technical diagrams, flowcharts, and educational illustrations.
 */
async function searchWikimediaCommonsDiagrams(query, limit = 6) {
  const results = [];
  try {
    const searchQuery = `${query} diagram`;
    const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
      searchQuery
    )}&gsrnamespace=6&gsrlimit=${limit + 6}&prop=imageinfo&iiprop=url|extmetadata|dimensions|mime&iiurlwidth=1000&format=json&origin=*`;

    const res = await axios.get(url, { headers: HTTP_HEADERS, timeout: 6500 });
    const pages = res.data?.query?.pages || {};

    for (const page of Object.values(pages)) {
      const ii = page?.imageinfo?.[0];
      if (!ii) continue;
      const mime = String(ii.mime || "").toLowerCase();
      // Prefer SVG and PNG diagrams over camera JPEGs
      if (!mime.includes("svg") && !mime.includes("png")) {
        continue;
      }
      const imgUrl = ii.thumburl || ii.url;
      if (!imgUrl) continue;
      if (/icon|logo|symbol|stub|flag|avatar|portrait|photo_of|boeing|airbus|aircraft/i.test(page.title || "")) {
        continue;
      }

      const cleanTitle = String(page.title || "")
        .replace(/^File:/i, "")
        .replace(/\.(?:svg|png|jpe?g|webp|gif)$/i, "")
        .replace(/[_-]+/g, " ")
        .trim();

      const rawDesc =
        ii.extmetadata?.ObjectName?.value ||
        ii.extmetadata?.ImageDescription?.value ||
        cleanTitle;
      const cleanDesc = String(rawDesc)
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 140);

      results.push({
        id: `commons_${page.pageid || results.length}`,
        title: cleanTitle || `${query} Diagram`,
        imageUrl: imgUrl,
        thumbUrl: imgUrl,
        thumbnailUrl: imgUrl,
        sourceName: "Wikimedia Commons",
        sourceUrl: ii.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title)}`,
        googleSearchUrl: `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(query + " diagram")}`,
        caption: cleanDesc || `Educational diagram for ${query}.`,
        width: ii.thumbwidth || ii.width || 800,
        height: ii.thumbheight || ii.height || 600,
        kind: "wikimedia_commons",
      });

      if (results.length >= limit) break;
    }
  } catch (err) {
    console.warn("[webImageSearch] Wikimedia Commons search notice:", err.message);
  }
  return results;
}

/**
 * Searches Openverse (open web image search engine) for diagrams and illustrations matching the topic.
 */
async function searchOpenverseWebImages(query, limit = 6) {
  const results = [];
  try {
    const url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(
      query + " diagram"
    )}&page_size=${limit}`;
    const res = await axios.get(url, { headers: HTTP_HEADERS, timeout: 3200 });
    const items = res.data?.results || [];

    for (const item of items) {
      if (!item.url) continue;
      results.push({
        id: `openverse_${item.id || results.length}`,
        title: item.title ? String(item.title).slice(0, 85) : `${query} Web Diagram`,
        imageUrl: item.url,
        thumbUrl: item.thumbnail || item.url,
        thumbnailUrl: item.thumbnail || item.url,
        sourceName: item.source ? `Web (${item.source})` : "External Web Source",
        sourceUrl: item.foreign_landing_url || item.url,
        googleSearchUrl: `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(query + " diagram")}`,
        caption: `External web diagram for "${query}" via ${item.creator || item.source || "Web Search"}.`,
        width: item.width || 800,
        height: item.height || 600,
        kind: "openverse_web",
      });
      if (results.length >= limit) break;
    }
  } catch (err) {
    console.warn("[webImageSearch] Openverse search notice:", err.message);
  }
  return results;
}

/**
 * Builds an external AI-generated raster image URL via Pollinations Flux AI for the given topic & style.
 */
function buildExternalAiGeneratedImage(query, style = "diagram", summary = "") {
  const styleDesc =
    style === "blueprint"
      ? "clean technical engineering blueprint schematic diagram, labeled nodes and connections, high contrast"
      : style === "infographic"
      ? "modern educational textbook infographic chart, clear visual hierarchy, academic illustration"
      : style === "concept_art"
      ? "scientific 3D conceptual visualization, educational textbook illustration, crisp details"
      : "clean academic computer science textbook diagram, labeled blocks, flow arrows, white background";

  const promptText = `Educational diagram of ${query}. ${summary ? summary.slice(0, 110) + "." : ""} Style: ${styleDesc}`;
  const seed = Math.abs(
    Array.from(query).reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) | 0, 7)
  ) % 100000;

  const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(
    promptText
  )}?width=1200&height=720&nologo=true&seed=${seed}`;

  return {
    id: `ext_ai_${seed}`,
    title: `${query} (AI Generated Illustration)`,
    imageUrl,
    thumbUrl: imageUrl,
    thumbnailUrl: imageUrl,
    sourceName: "External AI Image Engine",
    sourceUrl: `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(query + " diagram")}`,
    googleSearchUrl: `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(query + " diagram")}`,
    caption: `AI-generated visual illustration for "${query}".`,
    isAiGenerated: true,
    kind: "external_ai_generated",
  };
}

/**
 * Downloads an external image URL into a base64 string so Gemini Vision can analyze it.
 */
async function fetchExternalImageAsBase64(imageUrl) {
  if (!imageUrl) return null;
  try {
    const res = await axios.get(imageUrl, {
      responseType: "arraybuffer",
      headers: {
        "User-Agent": HTTP_HEADERS["User-Agent"],
        Accept: "image/*,*/*;q=0.8",
      },
      timeout: 7000,
    });
    const contentType = String(res.headers["content-type"] || "image/png").split(";")[0].trim();
    if (!contentType.startsWith("image/")) return null;
    const base64Data = Buffer.from(res.data).toString("base64");
    return { mimeType: contentType, base64Data };
  } catch (err) {
    return null;
  }
}

/**
 * Searches multiple external sources (Wikimedia Commons, Wikipedia Technical Articles, Openverse Web Search,
 * and External AI Image Generator) for a given topic and returns curated external images + Google Images link.
 */
async function searchExternalTopicImages(rawTopic, notebookTitle = "", style = "diagram") {
  const cleanQuery = buildCleanSearchQuery(rawTopic, notebookTitle);
  const googleImagesUrl = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(cleanQuery + " diagram")}`;

  const [wikiResults, commonsResults, openverseResults] = await Promise.all([
    searchWikipediaArticleImages(cleanQuery, 5),
    searchWikimediaCommonsDiagrams(cleanQuery, 6),
    searchOpenverseWebImages(cleanQuery, 4),
  ]);

  let fallbackCommons = [];
  if (commonsResults.length < 3) {
    const coreWords = cleanQuery
      .split(/\s+/)
      .filter((w) => !/^(?:with|and|or|the|of|in|for|to|from|by|on|at|using|hardware|system|overview)$/i.test(w));
    const shortTopic = coreWords.slice(0, 2).join(" ");
    if (shortTopic && shortTopic.toLowerCase() !== cleanQuery.toLowerCase()) {
      fallbackCommons = await searchWikimediaCommonsDiagrams(shortTopic, 6);
    }
  }

  const aiImage = buildExternalAiGeneratedImage(cleanQuery, style);

  const combined = [];
  const seenUrls = new Set();

  for (const item of [...wikiResults, ...commonsResults, ...openverseResults, ...fallbackCommons, aiImage]) {
    if (!item || !item.imageUrl) continue;
    if (seenUrls.has(item.imageUrl)) continue;
    seenUrls.add(item.imageUrl);
    combined.push(item);
  }

  return {
    query: cleanQuery,
    googleImagesUrl,
    images: combined.slice(0, 12),
  };
}

module.exports = {
  buildCleanSearchQuery,
  searchExternalTopicImages,
  buildExternalAiGeneratedImage,
  fetchExternalImageAsBase64,
};
