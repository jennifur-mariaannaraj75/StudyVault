# Marginalia — a NotebookLM-style app

Upload PDFs, get an instant summary + key topics + suggested questions for each one,
and chat with your documents — every answer is grounded in your sources and tells you
which file it came from.

**Stack:** Node.js + Express (backend/API) · MongoDB + Mongoose (storage) ·
vanilla HTML/CSS/JS (frontend, no build step) · Google Gemini API — free tier
(summaries + chat) · `pdf-parse` (text extraction) · `multer` (file uploads).

## 1. Prerequisites

- [Node.js](https://nodejs.org) 18+
- MongoDB running somewhere — either:
  - **Local:** install MongoDB Community Server and run it (`mongod`), or
  - **Cloud (easiest):** a free [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register) cluster — copy its connection string
- A **free** [Google AI Studio API key](https://aistudio.google.com/apikey) (used for summaries and chat answers — no credit card required)

## 2. Install

```bash
cd notebooklm-clone
npm install
```

## 3. Configure

Copy the example env file and fill in your values:

```bash
cp .env.example .env
```

Edit `.env`:

```
MONGO_URI=mongodb://127.0.0.1:27017/notebooklm_clone
GEMINI_API_KEY=...your key from aistudio.google.com...
GEMINI_MODEL=gemini-2.5-flash
PORT=5000
```

## 4. Run

```bash
npm start
```

Then open **http://localhost:5000** in your browser.

For auto-restart while developing:

```bash
npm run dev
```

## How it works

1. **Create a notebook** from the "+" button on the left — this is your project/workspace, just like a NotebookLM notebook.
2. **Upload one or more PDFs.** The server extracts the text (`pdf-parse`), stores it in MongoDB, and asks Gemini to generate a short summary, key topics, and suggested starter questions — shown in the right-hand "Studio" panel as each file finishes.
3. **Ask questions in the chat.** The server pulls the most relevant passages from your uploaded PDFs (a lightweight keyword-based retrieval step, no vector database required) and asks Gemini to answer using only those passages, citing the source filename(s) under each answer.
4. Everything (notebooks, documents, extracted text, chat history) is persisted in MongoDB, so it's all still there if you restart the server.

## Project structure

```
notebooklm-clone/
├── server/
│   ├── server.js            # Express app entry point
│   ├── config/db.js         # MongoDB connection
│   ├── models/               # Mongoose schemas: Notebook, Document, Message
│   ├── routes/                # /api/notebooks, /documents, /chat
│   └── utils/
│       ├── pdfExtractor.js   # PDF -> raw text
│       ├── textChunker.js    # chunking + keyword-based relevant-passage retrieval
│       └── aiClient.js       # calls the Gemini API for summaries + chat
└── public/
    ├── index.html
    ├── css/style.css
    └── js/app.js             # all frontend logic (fetch calls to the API)
```

## Notes & things you may want to extend

- **Retrieval is keyword-based, not embeddings-based.** This keeps the app dependency-light and easy to run locally with nothing but MongoDB. If you outgrow it, swap `textChunker.js`'s scoring for a real embeddings model + a vector index (MongoDB Atlas Vector Search works well here, since you're already on MongoDB).
- **Scanned/image-only PDFs are supported via automatic OCR.** If a PDF has no text layer, the app renders each page to an image and runs Tesseract OCR on it automatically — no manual conversion needed. This is noticeably slower than normal text extraction (a few seconds per page) and needs internet access the first time it runs (to download the OCR language data), but works fully offline after that.
- **No authentication** is included — it's a single-user app as-is. Add an auth layer (e.g. sessions + a `User` model) before deploying it somewhere public.
- **Large PDFs:** documents are capped at 25MB on upload, and only the first ~60,000 characters are sent to the model when generating the initial summary (the full text is still stored and used for chat retrieval).
