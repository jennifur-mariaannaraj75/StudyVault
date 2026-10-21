const AdmZip = require("adm-zip");
const mammoth = require("mammoth");
const officeParser = require("officeparser");

/**
 * Extracts slide-by-slide text, titles, and notes from PPTX/PPT buffers.
 * @param {Buffer} buffer
 * @param {string} filename
 * @returns {Promise<{pages: Array<{pageNumber: number, title: string, text: string, notes?: string}>, pageCount: number, fullText: string}>}
 */
async function extractPptx(buffer, filename = "presentation.pptx") {
  const slides = [];

  try {
    const zip = new AdmZip(buffer);
    const zipEntries = zip.getEntries();

    // Find all slide XML files
    const slideEntries = zipEntries.filter((entry) =>
      /^ppt\/slides\/slide\d+\.xml$/i.test(entry.entryName)
    );

    if (slideEntries.length > 0) {
      // Sort slides numerically: slide1.xml, slide2.xml, ...
      slideEntries.sort((a, b) => {
        const numA = parseInt(a.entryName.match(/slide(\d+)\.xml/i)?.[1] || "0", 10);
        const numB = parseInt(b.entryName.match(/slide(\d+)\.xml/i)?.[1] || "0", 10);
        return numA - numB;
      });

      // Find speaker notes entries
      const notesMap = new Map();
      zipEntries.forEach((entry) => {
        const m = entry.entryName.match(/ppt\/notesSlides\/notesSlide(\d+)\.xml/i);
        if (m) {
          try {
            const rawXml = entry.getData().toString("utf8");
            const noteTexts = [];
            const textMatches = rawXml.match(/<a:t[^>]*>(.*?)<\/a:t>/gi) || [];
            for (const tm of textMatches) {
              const val = tm.replace(/<[^>]+>/g, "").trim();
              if (val) noteTexts.push(val);
            }
            if (noteTexts.length > 0) {
              notesMap.set(parseInt(m[1], 10), noteTexts.join(" "));
            }
          } catch (_) {}
        }
      });

      for (let idx = 0; idx < slideEntries.length; idx++) {
        const entry = slideEntries[idx];
        const slideNum = idx + 1;
        const xml = entry.getData().toString("utf8");

        // Parse paragraphs and text runs in the slide
        const paragraphs = [];
        const pBlocks = xml.split(/<\/a:p>/gi);

        for (const pBlock of pBlocks) {
          const tMatches = pBlock.match(/<a:t[^>]*>(.*?)<\/a:t>/gi);
          if (tMatches) {
            const line = tMatches
              .map((tm) => tm.replace(/<[^>]+>/g, "").trim())
              .filter(Boolean)
              .join(" ");
            if (line) {
              paragraphs.push(line);
            }
          }
        }

        let slideTitle = `Slide ${slideNum}`;
        let slideBody = [];

        if (paragraphs.length > 0) {
          slideTitle = paragraphs[0];
          slideBody = paragraphs.slice(1);
        }

        const notes = notesMap.get(slideNum) || "";
        const formattedText = [
          `# ${slideTitle}`,
          "",
          ...slideBody.map((b) => `• ${b}`),
          ...(notes ? ["", `Notes: ${notes}`] : []),
        ].join("\n").trim();

        slides.push({
          pageNumber: slideNum,
          title: slideTitle,
          text: formattedText || `Slide ${slideNum}`,
          notes: notes,
          bullets: slideBody,
        });
      }
    }
  } catch (zipErr) {
    console.warn(`[officeExtractor] AdmZip PPTX parsing failed for ${filename}:`, zipErr.message);
  }

  // Fallback if AdmZip didn't find slides (e.g. older .ppt format or non-standard PPTX)
  if (slides.length === 0) {
    try {
      const rawText = await officeParser.parseOffice(buffer);
      const text = (rawText || "").trim();
      if (text) {
        // Split text by slide boundaries or double newlines into distinct slides
        const rawSlides = text.split(/(?:Slide\s+\d+|--- Slide \d+ ---|\n{3,})/i).filter(Boolean);
        if (rawSlides.length > 0) {
          rawSlides.forEach((chunk, i) => {
            const lines = chunk.trim().split("\n").map((l) => l.trim()).filter(Boolean);
            const title = lines[0] || `Slide ${i + 1}`;
            slides.push({
              pageNumber: i + 1,
              title,
              text: chunk.trim(),
              notes: "",
              bullets: lines.slice(1),
            });
          });
        } else {
          slides.push({
            pageNumber: 1,
            title: filename.replace(/\.[^/.]+$/, ""),
            text: text,
            notes: "",
            bullets: [],
          });
        }
      }
    } catch (opErr) {
      console.warn(`[officeExtractor] officeParser fallback failed for ${filename}:`, opErr.message);
    }
  }

  // If still empty, create default slide
  if (slides.length === 0) {
    slides.push({
      pageNumber: 1,
      title: filename.replace(/\.[^/.]+$/, ""),
      text: `Presentation: ${filename}\nNo extractable text found in slides.`,
      notes: "",
      bullets: [],
    });
  }

  const fullText = slides
    .map((s) => `--- Slide ${s.pageNumber}: ${s.title} ---\n${s.text}`)
    .join("\n\n");

  return {
    pages: slides,
    pageCount: slides.length,
    fullText,
  };
}

/**
 * Extracts paginated text, headings, and paragraphs from DOCX/DOC buffers.
 * @param {Buffer} buffer
 * @param {string} filename
 * @returns {Promise<{pages: Array<{pageNumber: number, title?: string, text: string}>, pageCount: number, fullText: string}>}
 */
async function extractDocx(buffer, filename = "document.docx") {
  let fullText = "";

  try {
    const res = await mammoth.extractRawText({ buffer });
    fullText = (res.value || "").trim();
  } catch (mErr) {
    console.warn(`[officeExtractor] Mammoth DOCX parsing failed for ${filename}:`, mErr.message);
  }

  if (!fullText) {
    try {
      fullText = (await officeParser.parseOffice(buffer) || "").trim();
    } catch (opErr) {
      console.warn(`[officeExtractor] officeParser fallback failed for ${filename}:`, opErr.message);
    }
  }

  if (!fullText) {
    fullText = `Document: ${filename}\nNo extractable text found.`;
  }

  // Paginate document text into realistic ~350-500 word pages or by section headings
  const paragraphs = fullText.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const pages = [];
  let currentPageText = [];
  let currentWordCount = 0;

  for (const para of paragraphs) {
    const words = para.split(/\s+/).length;
    // Check if this paragraph looks like a page break or major heading
    const isMajorHeading = /^(chapter|section|module|unit|table of contents|introduction|abstract|summary|conclusion)\b/i.test(para) && para.length < 100;

    if ((currentWordCount + words > 380 && currentPageText.length > 0) || (isMajorHeading && currentWordCount > 150)) {
      pages.push({
        pageNumber: pages.length + 1,
        text: currentPageText.join("\n\n"),
      });
      currentPageText = [para];
      currentWordCount = words;
    } else {
      currentPageText.push(para);
      currentWordCount += words;
    }
  }

  if (currentPageText.length > 0 || pages.length === 0) {
    pages.push({
      pageNumber: pages.length + 1,
      text: currentPageText.join("\n\n") || fullText,
    });
  }

  return {
    pages,
    pageCount: pages.length,
    fullText: pages.map((p) => `--- Page ${p.pageNumber} ---\n${p.text}`).join("\n\n"),
  };
}

module.exports = {
  extractPptx,
  extractDocx,
};
