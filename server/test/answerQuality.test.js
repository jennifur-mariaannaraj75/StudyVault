const assert = require("assert");
const { buildSystemPrompt, generateOfflineAnswer } = require("../utils/aiClient");
const katex = require("katex");

global.escapeHtml = function(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

// Replicate frontend parseMarkdownToHtml for test validation
function parseMarkdownToHtml(markdownText) {
  if (!markdownText) return "";

  // 1. Separate code blocks and math into placeholders
  const codeBlocks = [];
  let text = String(markdownText).replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
    const idx = codeBlocks.length;
    codeBlocks.push({ lang, code });
    return `___CODE_BLOCK_${idx}___`;
  });

  const inlineCodes = [];
  text = text.replace(/`([^`\n]+)`/g, (match, code) => {
    const idx = inlineCodes.length;
    inlineCodes.push(code);
    return `___INLINE_CODE_${idx}___`;
  });

  const displayMath = [];
  text = text.replace(/\$\$([\s\S]*?)\$\$/g, (match, math) => {
    const idx = displayMath.length;
    displayMath.push(math.trim());
    return `___MATH_DISP_${idx}___`;
  });
  text = text.replace(/\\\[([\s\S]*?)\\\]/g, (match, math) => {
    const idx = displayMath.length;
    displayMath.push(math.trim());
    return `___MATH_DISP_${idx}___`;
  });

  const inlineMath = [];
  text = text.replace(/(^|[^\w\$])\$([^\$\n]+?)\$(?!\w)/g, (match, prefix, math) => {
    if (/^\d+(?:\.\d+)?$/.test(math.trim())) return match;
    const idx = inlineMath.length;
    inlineMath.push(math.trim());
    return `${prefix}___MATH_INL_${idx}___`;
  });
  text = text.replace(/\\\(([\s\S]*?)\\\)/g, (match, math) => {
    const idx = inlineMath.length;
    inlineMath.push(math.trim());
    return `___MATH_INL_${idx}___`;
  });

  // 2. Strict & Safe Source Citation Parsing:
  const renderCitationChip = (fname, pNum) => {
    const trimmedFname = (fname || "").trim().replace(/^📄\s*/, "");
    if (/^[a-zA-Z0-9]$|^[a-zA-Z]_[a-zA-Z0-9]+$/i.test(trimmedFname)) {
      return `[${trimmedFname}]`;
    }
    const cleanPage = pNum ? parseInt(pNum, 10) || 1 : 1;
    const pageStr = `p.${cleanPage}`;
    return `<span class="citation-chip" data-doc="${escapeHtml(trimmedFname)}" data-page="${cleanPage}" title="Click to view in PDF Viewer at ${pageStr}">📄 [${escapeHtml(trimmedFname)}, ${pageStr}]</span>`;
  };

  text = text.replace(/\[\s*([^,\]\n]{2,}?)\s*,\s*p(?:age|\.)?\s*(\d+)\s*\]/gi, (match, fname, pNum) => {
    return renderCitationChip(fname, pNum);
  });

  text = text.replace(/\[\s*([a-zA-Z0-9_\-\. ]+\.(?:pdf|docx|doc|txt|epub|pptx))\s*\]/gi, (match, fname) => {
    return renderCitationChip(fname, 1);
  });

  // 3. Academic Callouts
  text = text.replace(/^>\s*\*\*Definition(?:\s*\([^)]*\))?:\*\*\s*(.*?)(?=\n\n|\n[^\>]|$)/gims, (match, body) => {
    const cleanBody = body.replace(/^>\s*/gm, "").trim();
    return `\n<div class="callout-definition"><div class="callout-title">📖 Definition</div><div class="callout-body">${cleanBody}</div></div>\n`;
  });

  text = text.replace(/^>\s*\*\*Exam Tip:\*\*\s*(.*?)(?=\n\n|\n[^\>]|$)/gims, (match, body) => {
    const cleanBody = body.replace(/^>\s*/gm, "").trim();
    return `\n<div class="callout-exam-tip"><div class="callout-title">💡 Exam Tip</div><div class="callout-body">${cleanBody}</div></div>\n`;
  });

  text = text.replace(/^>\s*\*\*Quick Revision Summary:\*\*\s*(.*?)(?=\n\n|\n[^\>]|$)/gims, (match, body) => {
    const cleanBody = body.replace(/^>\s*/gm, "").trim();
    return `\n<div class="callout-revision"><div class="callout-title">⚡ Quick Revision Summary</div><div class="callout-body">${cleanBody}</div></div>\n`;
  });

  // 4. Tables
  text = text.replace(/(?:^|\n)(\|[^\n]+\|\r?\n\|[-:\s|]+\|\r?\n(?:\|[^\n]+\|\r?\n?)+)/g, (match, tableText) => {
    const lines = tableText.trim().split(/\r?\n/).filter((l) => l.trim().startsWith("|"));
    if (lines.length < 2) return match;

    const parseRow = (line) => line.split("|").slice(1, -1).map((c) => c.trim());
    const headerCols = parseRow(lines[0]);
    const bodyRows = lines.slice(2).map(parseRow);

    let tableHtml = '<div class="academic-table-wrap"><table class="academic-table"><thead><tr>';
    headerCols.forEach((h) => {
      tableHtml += `<th>${h}</th>`;
    });
    tableHtml += "</tr></thead><tbody>";
    bodyRows.forEach((row) => {
      tableHtml += "<tr>";
      row.forEach((cell) => {
        tableHtml += `<td>${cell}</td>`;
      });
      tableHtml += "</tr>";
    });
    tableHtml += "</tbody></table></div>";
    return `\n${tableHtml}\n`;
  });

  // 5. Headings
  text = text.replace(/^#### (.*$)/gim, '<h4 class="academic-heading">$1</h4>');
  text = text.replace(/^### (.*$)/gim, '<h3 class="academic-heading">$1</h3>');
  text = text.replace(/^## (.*$)/gim, '<h2 class="academic-heading">$1</h2>');

  // 6. Formatting
  text = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

  // 7. Math Render via KaTeX
  html = text.replace(/___MATH_DISP_(\d+)___/g, (match, id) => {
    const mathCode = displayMath[parseInt(id, 10)] || "";
    try {
      const rendered = katex.renderToString(mathCode, { displayMode: true, throwOnError: false });
      return `<div class="math-display-wrap">${rendered}</div>`;
    } catch (_) {
      return `<div class="math-display-wrap"><code>${escapeHtml(mathCode)}</code></div>`;
    }
  });

  html = html.replace(/___MATH_INL_(\d+)___/g, (match, id) => {
    const mathCode = inlineMath[parseInt(id, 10)] || "";
    try {
      const rendered = katex.renderToString(mathCode, { displayMode: false, throwOnError: false });
      return `<span class="math-inline">${rendered}</span>`;
    } catch (_) {
      return `<span class="math-inline"><code>${escapeHtml(mathCode)}</code></span>`;
    }
  });

  return html;
}

// Sample mock chunks
const sampleOSChunks = [
  {
    filename: "Operating_Systems_Concepts.pdf",
    pageNumber: 18,
    chunk: "Deadlock avoidance requires that the system has additional information about how resources are to be requested. The Banker's Algorithm is a resource allocation and deadlock avoidance algorithm. Data structures include Available, Max, Allocation, and Need. The Need matrix is computed as Need[i][j] = Max[i][j] - Allocation[i][j].",
    lexicalScore: 0.88,
    rawCosine: 0.85
  },
  {
    filename: "Concurrency_Lecture.docx",
    pageNumber: 4,
    chunk: "A state is considered safe if there exists a safe sequence of processes. If no such sequence exists, the system is in an unsafe state, which may lead to deadlock.",
    lexicalScore: 0.72,
    rawCosine: 0.78
  }
];

async function runTests() {
  console.log("=== Running StudyVault Answer Quality & Formatting Tests ===\n");

  // Test 1: Main Points Question
  {
    console.log("Test 1: Main-points question containing definitions and tables...");
    const answer = generateOfflineAnswer("What are the main points?", sampleOSChunks, "study-notes");
    assert(answer.includes("Topic Overview"), "Should contain Topic Overview");
    assert(answer.includes("> **Definition:"), "Should contain explicit Definition block");
    assert(answer.includes("| Aspect |") || answer.includes("| Structure |"), "Should contain a comparison table");
    assert(answer.includes("> **Quick Revision Summary:"), "Should contain Quick Revision Summary");
    assert(!answer.includes("[n, p.1]"), "Should not contain corrupt citations");

    const html = parseMarkdownToHtml(answer);
    assert(html.includes("callout-definition"), "HTML must contain definition callout");
    assert(html.includes("academic-table"), "HTML must contain academic table");
    assert(html.includes("callout-revision"), "HTML must contain revision callout");
    console.log("  ✓ Test 1 passed.");
  }

  // Test 2: Banker's Algorithm Formula with Citations
  {
    console.log("Test 2: Banker's Algorithm formula with citations without corruption...");
    const answer = generateOfflineAnswer("Explain the Banker's Algorithm Need formula", sampleOSChunks, "study-notes");
    assert(answer.includes("Need[i][j] = Max[i][j] - Allocation[i][j]") || answer.includes("Need_{ij} = Max_{ij} - Allocation_{ij}"), "Must contain correct Banker's formula");
    assert(!answer.includes("[n, p.1][m, p.1]"), "Must NOT corrupt [n] into citation [n, p.1]");
    assert(!answer.includes("Max**[i, p.1][j, p.1]**"), "Must NOT corrupt Max[i][j] into citations");

    const html = parseMarkdownToHtml(answer);
    assert(html.includes("katex"), "Formula must be rendered by KaTeX");
    assert(!html.includes("data-doc=\"i\""), "Must not create a citation chip for variable 'i'");
    assert(!html.includes("data-doc=\"j\""), "Must not create a citation chip for variable 'j'");
    console.log("  ✓ Test 2 passed.");
  }

  // Test 3: Multiple source documents and page references
  {
    console.log("Test 3: Answer with multiple source documents and page references...");
    const answer = generateOfflineAnswer("Compare deadlock detection and avoidance", sampleOSChunks, "compare-topics");
    assert(answer.includes("Operating_Systems_Concepts.pdf"), "Must cite first document");
    assert(answer.includes("Concurrency_Lecture.docx"), "Must cite second document");
    const html = parseMarkdownToHtml(answer);
    assert(html.includes("data-doc=\"Operating_Systems_Concepts.pdf\""), "Citation chip for OS pdf must exist");
    assert(html.includes("data-page=\"18\""), "Page 18 must be preserved");
    assert(html.includes("data-doc=\"Concurrency_Lecture.docx\""), "Citation chip for Concurrency doc must exist");
    assert(html.includes("data-page=\"4\""), "Page 4 must be preserved");
    console.log("  ✓ Test 3 passed.");
  }

  // Test 4: Inline and display LaTeX
  {
    console.log("Test 4: Answer containing inline and display LaTeX ($ and $$)...");
    const latexSample = `Here is the display equation:
$$Need_{ij} = Max_{ij} - Allocation_{ij}$$
And the inline term is $Available[j]$ for resource $R_j$. [Operating_Systems_Concepts.pdf, p. 18]`;
    const html = parseMarkdownToHtml(latexSample);
    assert(html.includes("math-display-wrap"), "Must wrap display math in container");
    assert(html.includes("math-inline"), "Must wrap inline math in container");
    assert(html.includes("katex-display"), "KaTeX display mode must be active");
    assert(html.includes("data-page=\"18\""), "Citation must remain clickable and uncorrupted");
    console.log("  ✓ Test 4 passed.");
  }

  // Test 5: Question whose answer is not supported by retrieved documents
  {
    console.log("Test 5: Question whose answer is not supported by retrieved documents...");
    const answerEmpty = generateOfflineAnswer("What is photosynthesis?", []);
    assert.strictEqual(answerEmpty, "I couldn't find this information in your uploaded sources.", "Must state unsupported info for empty chunks");

    const irrelevantChunks = [
      {
        filename: "OS.pdf",
        pageNumber: 1,
        chunk: "CPU scheduling algorithms allocate processor time.",
        lexicalScore: 0,
        rawCosine: 0.12
      }
    ];
    const answerIrrelevant = generateOfflineAnswer("What is the capital of Mars?", irrelevantChunks);
    assert.strictEqual(answerIrrelevant, "I couldn't find this information in your uploaded sources.", "Must state unsupported info for low relevance");
    console.log("  ✓ Test 5 passed.");
  }

  // Test 6: Short question should not generate an overwhelming long study guide
  {
    console.log("Test 6: Short question does not generate long study guide...");
    const shortAnswer = generateOfflineAnswer("What is deadlock?", sampleOSChunks, "study-notes");
    assert(shortAnswer.length < 800, "Short question answer should be concise (under 800 chars)");
    assert(!shortAnswer.includes("### 10-Mark Comprehensive Analysis"), "Must not generate full exam guide for simple question");
    console.log("  ✓ Test 6 passed.");
  }

  // Test 7: Detailed academic question generates structured breakdown
  {
    console.log("Test 7: Detailed academic question...");
    const detailedAnswer = generateOfflineAnswer("Provide a detailed study breakdown and main concepts of the Banker's algorithm", sampleOSChunks, "study-notes");
    assert(detailedAnswer.includes("Topic Overview"), "Must include overview");
    assert(detailedAnswer.includes("Core Resource Matrices Comparison"), "Must include table comparison");
    assert(detailedAnswer.includes("> **Exam Tip:"), "Must include Exam Tip");
    assert(detailedAnswer.includes("> **Quick Revision Summary:"), "Must include Quick Revision Summary");
    console.log("  ✓ Test 7 passed.");
  }

  // Test 8: Response containing special characters, brackets, underscores, and mathematical operators
  {
    console.log("Test 8: Response containing special characters, brackets, underscores, and operators...");
    const rawComplex = `Matrix notation:
matrix_A[x][y] = matrix_B[x][y] + delta_val;
Condition: (x <= y && z != 0)
Reference citation: [Operating_Systems_Concepts.pdf, p. 18]`;
    const html = parseMarkdownToHtml(rawComplex);
    assert(html.includes("matrix_A[x][y]"), "Brackets [x][y] must remain uncorrupted");
    assert(!html.includes("data-doc=\"x\""), "Bracket [x] must not become citation chip");
    assert(!html.includes("data-doc=\"y\""), "Bracket [y] must not become citation chip");
    assert(html.includes("data-doc=\"Operating_Systems_Concepts.pdf\""), "Real citation must be preserved");
    console.log("  ✓ Test 8 passed.");
  }

  // Test 9: Citation chips structure and metadata
  {
    console.log("Test 9: Citation chips structure and metadata...");
    const citationInput = "Documented here [Operating_Systems_Concepts.pdf, p. 18] and here [Concurrency_Lecture.docx, page 4].";
    const html = parseMarkdownToHtml(citationInput);
    assert(html.includes('class="citation-chip"'), "Must contain citation chips");
    assert(html.includes('data-doc="Operating_Systems_Concepts.pdf"'), "Must set data-doc for OS pdf");
    assert(html.includes('data-page="18"'), "Must set data-page 18");
    assert(html.includes('data-doc="Concurrency_Lecture.docx"'), "Must set data-doc for Concurrency doc");
    assert(html.includes('data-page="4"'), "Must set data-page 4");
    assert(html.includes("📄 [Operating_Systems_Concepts.pdf, p.18]"), "Must render human-readable badge label");
    console.log("  ✓ Test 9 passed.");
  }

  // Test 10: Correct synchronization between selected study mode and generated content
  {
    console.log("Test 10: Synchronization between selected study mode and generated content...");
    const modes = ["quick-summary", "exam-prep", "step-by-step", "compare-topics", "study-notes"];
    for (const m of modes) {
      const prompt = buildSystemPrompt(m);
      assert(prompt.toLowerCase().includes(m) || prompt.toLowerCase().includes(m.replace(/-/g, " ")), `System prompt must condition on mode ${m}`);
      const offlineAns = generateOfflineAnswer("Explain resource scheduling", sampleOSChunks, m);
      assert(offlineAns && offlineAns.length > 50, `Mode ${m} must produce substantive answer`);
    }
    console.log("  ✓ Test 10 passed.");
  }

  console.log("\nALL 10 TESTS PASSED SUCCESSFULLY! ✨");
}

runTests().catch(err => {
  console.error("Test failure:", err);
  process.exit(1);
});
