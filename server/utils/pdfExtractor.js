const pdfParse = require("pdf-parse");

/**
 * Extracts page-by-page text mapping + page count from a PDF file buffer.
 * @param {Buffer} buffer
 * @returns {Promise<{pages: Array<{pageNumber: number, text: string}>, pageCount: number, fullText: string}>}
 */
async function extractPdfPages(buffer) {
  const pages = [];

  function render_page(pageData) {
    return pageData.getTextContent().then(function(textContent) {
      let text = "";
      for (let item of textContent.items) {
        text += item.str + " ";
      }
      const pageText = (text || "").replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
      pages.push({
        pageNumber: pageData.pageIndex + 1,
        text: pageText,
      });
      return pageText;
    });
  }

  try {
    const options = { pagerender: render_page };
    const data = await pdfParse(buffer, options);

    pages.sort((a, b) => a.pageNumber - b.pageNumber);

    if (pages.length > 0) {
      return {
        pages,
        pageCount: data.numpages || pages.length,
        fullText: pages.map((p) => `--- Page ${p.pageNumber} ---\n${p.text}`).join("\n\n"),
      };
    }
  } catch (err) {
    console.warn("[pdfExtractor] Page-level render hook failed, using standard extraction:", err.message);
  }

  // Fallback to standard pdf-parse if render_page didn't populate
  const fallbackData = await pdfParse(buffer);
  const fullText = (fallbackData.text || "").replace(/\r\n/g, "\n").trim();
  const pageCount = fallbackData.numpages || 1;

  const totalChars = fullText.length;
  const charsPerPage = Math.max(500, Math.ceil(totalChars / pageCount));
  const fallbackPages = [];

  for (let i = 0; i < pageCount; i++) {
    const pageText = fullText.slice(i * charsPerPage, (i + 1) * charsPerPage).trim();
    fallbackPages.push({ pageNumber: i + 1, text: pageText });
  }

  return {
    pages: fallbackPages,
    pageCount,
    fullText,
  };
}

module.exports = { extractPdfPages, extractPdfText: async (buf) => {
  const res = await extractPdfPages(buf);
  return { text: res.fullText, pageCount: res.pageCount, pages: res.pages };
}};
