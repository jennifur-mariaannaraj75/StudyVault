const axios = require("axios");

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/**
 * Decode common HTML entities in transcripts and scraped web pages
 */
function decodeHtmlEntities(str) {
  if (!str) return "";
  return String(str)
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/**
 * Format seconds into [MM:SS] or [HH:MM:SS]
 */
function formatTimestamp(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

/**
 * Detect if a URL is a YouTube link and return its 11-character video ID
 */
function parseYoutubeVideoId(rawUrl) {
  if (!rawUrl) return null;
  try {
    const u = new URL(rawUrl.trim().startsWith("http") ? rawUrl.trim() : `https://${rawUrl.trim()}`);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    if (host === "youtu.be") {
      const id = u.pathname.split("/").filter(Boolean)[0];
      return id && id.length >= 10 ? id.slice(0, 11) : null;
    }
    if (host.includes("youtube.com") || host.includes("youtube-nocookie.com")) {
      if (u.searchParams.get("v")) {
        return u.searchParams.get("v").slice(0, 11);
      }
      const parts = u.pathname.split("/").filter(Boolean);
      if ((parts[0] === "shorts" || parts[0] === "embed" || parts[0] === "live" || parts[0] === "v") && parts[1]) {
        return parts[1].slice(0, 11);
      }
    }
  } catch (_) {}
  const reg = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts|live)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
  const match = String(rawUrl).match(reg);
  return match ? match[1] : null;
}

/**
 * Extract YouTube video metadata, full description, and timestamped transcript captions
 */
async function extractYoutubeSource(rawUrl) {
  const videoId = parseYoutubeVideoId(rawUrl);
  if (!videoId) {
    throw new Error("Invalid YouTube video URL");
  }

  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  let title = `YouTube Video (${videoId})`;
  let author = "YouTube Channel";
  let description = "";
  let keywords = [];
  let durationSec = 0;
  let transcriptSegments = [];

  // 1. Fetch oEmbed metadata (fast & reliable title + author)
  try {
    const oembedRes = await axios.get(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`,
      { timeout: 8000, headers: { "User-Agent": USER_AGENT } }
    );
    if (oembedRes.data) {
      if (oembedRes.data.title) title = oembedRes.data.title.trim();
      if (oembedRes.data.author_name) author = oembedRes.data.author_name.trim();
    }
  } catch (_) {}

  // 2. Fetch watch page HTML to parse ytInitialPlayerResponse (description + captionTracks)
  try {
    const pageRes = await axios.get(watchUrl, {
      timeout: 12000,
      headers: {
        "User-Agent": USER_AGENT,
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    const html = String(pageRes.data || "");

    const playerMatch = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\});\s*(?:var\s|let\s|const\s|<\/script>)/s);
    if (playerMatch) {
      try {
        const playerData = JSON.parse(playerMatch[1]);
        const vd = playerData.videoDetails || {};
        if (vd.title) title = vd.title.trim();
        if (vd.author) author = vd.author.trim();
        if (vd.shortDescription) description = vd.shortDescription.trim();
        if (Array.isArray(vd.keywords)) keywords = vd.keywords;
        if (vd.lengthSeconds) durationSec = Number(vd.lengthSeconds) || 0;

        const tracks =
          playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
        if (tracks.length > 0) {
          // Prefer English track, fallback to first available track
          const preferredTrack =
            tracks.find((t) => String(t.languageCode || "").startsWith("en")) || tracks[0];
          if (preferredTrack && preferredTrack.baseUrl) {
            const capRes = await axios.get(preferredTrack.baseUrl, {
              timeout: 10000,
              headers: { "User-Agent": USER_AGENT },
            });
            const xml = String(capRes.data || "");
            const textMatches = [...xml.matchAll(/<text\s+start="([\d.]+)"(?:\s+dur="([\d.]+)")?[^>]*>([\s\S]*?)<\/text>/gi)];
            for (const m of textMatches) {
              const startSec = parseFloat(m[1] || "0");
              const rawLine = decodeHtmlEntities(m[3].replace(/<[^>]+>/g, " "))
                .replace(/\s+/g, " ")
                .trim();
              if (rawLine) {
                transcriptSegments.push({
                  start: startSec,
                  timestamp: formatTimestamp(startSec),
                  text: rawLine,
                });
              }
            }
          }
        }
      } catch (_) {}
    }
  } catch (_) {}

  // 3. Build structured study document text
  const sections = [];
  sections.push(`# YouTube Video Lecture: ${title}`);
  sections.push(`- **Channel / Instructor:** ${author}`);
  sections.push(`- **Source URL:** ${watchUrl}`);
  if (durationSec > 0) {
    sections.push(`- **Duration:** ${formatTimestamp(durationSec)}`);
  }
  if (keywords.length > 0) {
    sections.push(`- **Topics & Keywords:** ${keywords.slice(0, 15).join(", ")}`);
  }

  if (description) {
    sections.push(`\n## Video Overview & Description\n${description}`);
  }

  if (transcriptSegments.length > 0) {
    sections.push(`\n## Full Timestamped Video Transcript`);
    // Group segments into ~60-second paragraphs for clean reading & page citations
    let bucketStart = transcriptSegments[0].timestamp;
    let bucketStartSec = transcriptSegments[0].start;
    let bucketLines = [];

    for (const seg of transcriptSegments) {
      if (seg.start - bucketStartSec >= 60 && bucketLines.length > 0) {
        sections.push(`\n### [${bucketStart}] Lecture Segment\n${bucketLines.join(" ")}`);
        bucketStart = seg.timestamp;
        bucketStartSec = seg.start;
        bucketLines = [seg.text];
      } else {
        bucketLines.push(seg.text);
      }
    }
    if (bucketLines.length > 0) {
      sections.push(`\n### [${bucketStart}] Lecture Segment\n${bucketLines.join(" ")}`);
    }
  } else if (!description || description.length < 120) {
    // Fallback: fetch Wikipedia summary on the video title's topic so the study source is rich
    const cleanQuery = title
      .replace(/\(.*?\)|\[.*?\]/g, " ")
      .replace(/tutorial|crash course|lecture|full course|explained|in \d+ minutes/gi, " ")
      .trim();
    if (cleanQuery.length >= 3) {
      try {
        const wikiRes = await axios.get("https://en.wikipedia.org/w/api.php", {
          params: {
            action: "query",
            list: "search",
            srsearch: cleanQuery,
            format: "json",
            srlimit: 2,
          },
          headers: { "User-Agent": USER_AGENT },
          timeout: 6000,
        });
        const topHit = wikiRes.data?.query?.search?.[0];
        if (topHit && topHit.title) {
          const extractRes = await axios.get("https://en.wikipedia.org/w/api.php", {
            params: {
              action: "query",
              prop: "extracts",
              explaintext: 1,
              titles: topHit.title,
              format: "json",
            },
            headers: { "User-Agent": USER_AGENT },
            timeout: 6000,
          });
          const pagesObj = extractRes.data?.query?.pages || {};
          const firstPage = Object.values(pagesObj)[0];
          if (firstPage && firstPage.extract) {
            sections.push(
              `\n## Topic Reference & Background (${topHit.title})\n${firstPage.extract.slice(0, 18000)}`
            );
          }
        }
      } catch (_) {}
    }
  }

  const fullText = sections.join("\n").trim();
  const safeTitle = title.replace(/[\\/:*?"<>|]/g, "-").slice(0, 75).trim();
  const filename = `YouTube - ${safeTitle}.txt`;

  return {
    sourceType: "youtube",
    title,
    filename,
    url: watchUrl,
    fullText,
  };
}

/**
 * Extract clean article text from Wikipedia or any general Web URL
 */
async function extractWebUrlSource(rawUrl) {
  const targetUrl = rawUrl.trim().startsWith("http") ? rawUrl.trim() : `https://${rawUrl.trim()}`;

  // 1. Check if it's a YouTube URL first
  if (parseYoutubeVideoId(targetUrl)) {
    return extractYoutubeSource(targetUrl);
  }

  const parsedUrl = new URL(targetUrl);
  const host = parsedUrl.hostname.replace(/^www\./, "").toLowerCase();

  // 2. Check if it's a Wikipedia article URL (e.g. en.wikipedia.org/wiki/Operating_system)
  if (host.endsWith("wikipedia.org") && parsedUrl.pathname.startsWith("/wiki/")) {
    const wikiLang = host.split(".")[0] || "en";
    const wikiSlug = decodeURIComponent(parsedUrl.pathname.replace(/^\/wiki\//, ""));
    try {
      const apiRes = await axios.get(`https://${wikiLang}.wikipedia.org/w/api.php`, {
        params: {
          action: "query",
          prop: "extracts",
          explaintext: 1,
          titles: wikiSlug,
          redirects: 1,
          format: "json",
        },
        headers: { "User-Agent": USER_AGENT },
        timeout: 12000,
      });
      const pagesObj = apiRes.data?.query?.pages || {};
      const pageData = Object.values(pagesObj)[0];
      if (pageData && pageData.extract && pageData.extract.length > 80) {
        const cleanTitle = pageData.title || wikiSlug.replace(/_/g, " ");
        const fullText = `# ${cleanTitle} (Wikipedia Reference)\n- **Source URL:** ${targetUrl}\n\n${pageData.extract.slice(0, 55000)}`;
        const safeTitle = cleanTitle.replace(/[\\/:*?"<>|]/g, "-").slice(0, 75);
        return {
          sourceType: "wikipedia",
          title: cleanTitle,
          filename: `Wiki - ${safeTitle}.txt`,
          url: targetUrl,
          fullText,
        };
      }
    } catch (_) {}
  }

  // 3. General Web Article / Documentation Scraper
  const res = await axios.get(targetUrl, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    timeout: 15000,
  });

  const html = String(res.data || "");

  // Extract page title
  const ogTitleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  const titleTagMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  let pageTitle = decodeHtmlEntities(
    (ogTitleMatch && ogTitleMatch[1]) || (titleTagMatch && titleTagMatch[1]) || host
  )
    .replace(/\s+/g, " ")
    .trim();

  // Extract meta description
  const descMatch =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
  const metaDesc = descMatch ? decodeHtmlEntities(descMatch[1]).trim() : "";

  // Prefer <article> or <main> if present to avoid nav/footer noise
  const articleMatch =
    html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i) ||
    html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  let bodyHtml = articleMatch ? articleMatch[1] : html;

  // Strip non-content blocks
  bodyHtml = bodyHtml
    .replace(/<script\b[^<]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^<]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^<]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg\b[^<]*>[\s\S]*?<\/svg>/gi, " ")
    .replace(/<nav\b[^<]*>[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer\b[^<]*>[\s\S]*?<\/footer>/gi, " ")
    .replace(/<header\b[^<]*>[\s\S]*?<\/header>/gi, " ");

  // Convert structural tags into readable markdown breaks before stripping remaining HTML
  const structuredText = decodeHtmlEntities(
    bodyHtml
      .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "\n\n# $1\n")
      .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "\n\n## $1\n")
      .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "\n\n### $1\n")
      .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "\n- $1")
      .replace(/<\/(?:p|div|section|tr|blockquote|pre)>/gi, "\n\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const headerBlock = `# ${pageTitle}\n- **Source URL:** ${targetUrl}\n${
    metaDesc ? `- **Summary:** ${metaDesc}\n` : ""
  }\n`;

  const fullText = (headerBlock + structuredText).slice(0, 55000).trim();
  const safeTitle = pageTitle.replace(/[\\/:*?"<>|]/g, "-").slice(0, 70).trim() || host;
  const filename = `Web - ${safeTitle}.txt`;

  return {
    sourceType: "web",
    title: pageTitle,
    filename,
    url: targetUrl,
    fullText,
  };
}

module.exports = {
  parseYoutubeVideoId,
  extractYoutubeSource,
  extractWebUrlSource,
};
