# SurgiAssist AI

Full-stack assistant that accelerates pre-operative workflows:
- generate structured notes
- estimate surgical risk
- surface PubMed evidence from a single interface.

## Project structure

```
.
├── client/                 # Vite + React frontend
│   ├── src/App.jsx         # Application shell and layout
│   ├── src/api/api.js      # REST helpers (reads VITE_API_BASE)
│   └── src/components/     # InputForm, RiskForm, PubMedSearch modules
├── server/                 # FastAPI backend
│   ├── main.py             # REST endpoints: /notes, /risk, /pubmed
│   └── requirements.txt    # Deployment dependencies
└── models/, routes/, ...   # Backing models or future expansion
```

## Features

- **Pre-op note ge nerator** – Clinicians feed a patient summary, planned procedure, labs/imaging highlights, and optional supporting files (PDFs, images). GPT produces a six-section EMR-ready note with referenced attachments. Notes can be exported to PDF.
- **Risk assessment** – Uses GPT to return risk percentage, level, key drivers, and optimization steps. Structured UI renders the JSON response with color-coded chips and downloadable PDF.
- **PubMed evidence** – Queries NCBI e-utils, summarizes the top five relevance-ranked articles with titles, journal/date/authors, and offers related search chips.
- **Delightful UI** – Tailwind-inspired styling with cards, gradient hero, drag-and-drop attachments, and responsive layout.

## Local development

### Backend

1. `cd server`
2. `python -m venv venv && source venv/bin/activate`
3. `pip install -r requirements.txt`
4. Create `server/.env` with `OPENAI_API_KEY=...`
5. `uvicorn main:app --reload`

### Frontend

1. `cd client`
2. `npm install`
3. `npm run dev`

The React app expects the API at `http://127.0.0.1:8000`; configure `VITE_API_BASE` to override.

## Deployment notes

- Host the backend on Render/Railway/Fly/Cloud Run. Expose `uvicorn main:app --host 0.0.0.0 --port $PORT`. Inject secrets via the platform settings and narrow CORS to your frontend domain.
- Deploy the frontend to Netlify/Vercel/Cloudflare Pages. Build command `npm run build`, publish directory `dist`. Set `VITE_API_BASE` to the live backend URL.
- Confirm PDFs still render correctly server-side (no headless support needed) and that PubMed API calls respect NCBI rate limits.

## Future enhancements

- Real file uploads with secure storage (currently attachment metadata stays client-side).
- Authentication and team collaboration (per-user note history, approvals, shared templates).
- Automated testing: unit tests for formatting (Jest/RTL) and end-to-end flows (Playwright).
- Analytics dashboards comparing predicted vs. observed complications, and user feedback loops for the LLM prompts.
