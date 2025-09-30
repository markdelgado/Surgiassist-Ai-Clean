from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import os
import requests
from openai import OpenAI
import json

load_dotenv()
api_key = os.getenv("OPENAI_API_KEY")

if not api_key:
    raise ValueError("OPENAI_API_KEY not found in environment variables.")

client = OpenAI(api_key=api_key)

app = FastAPI()

# CORS for local frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ========== Data Models ==========

class RiskInput(BaseModel):
    age: int
    bmi: float
    comorbidities: list[str]
    procedure: str
    labs: dict

class AttachmentInput(BaseModel):
    name: str
    type: str | None = None
    size: int | None = None
    notes: str | None = None


class NoteInput(BaseModel):
    patient_summary: str
    procedure: str
    labs_imaging_summary: str | None = None
    attachments: list[AttachmentInput] | None = None

class PubMedInput(BaseModel):
    query: str

# ========== Routes ==========

@app.get("/")
def root():
    return {"message": "SurgiAssist AI Backend is Running ✅"}

@app.post("/risk")
def get_risk(data: RiskInput):
    if data.labs:
        labs_summary = ", ".join(
            f"{key}: {value}" for key, value in data.labs.items() if value not in (None, "")
        )
    else:
        labs_summary = "Not provided"

    comorbidity_text = ", ".join(data.comorbidities) if data.comorbidities else "None reported"

    prompt = (
        "You are a perioperative risk assessment assistant. "
        "Estimate the patient's risk of post-operative complications using well-established clinical considerations. "
        "Return a JSON object with exactly these fields: risk_percent (number), risk_level (low/moderate/high), "
        "key_drivers (array of concise bullet strings), and optimization_steps (array of actionable bullet strings). "
        "If information is missing, note that in the arrays rather than hallucinating data.\n\n"
        f"Age: {data.age}\n"
        f"BMI: {data.bmi}\n"
        f"Comorbidities: {comorbidity_text}\n"
        f"Planned procedure: {data.procedure}\n"
        f"Labs: {labs_summary}\n"
        "Provide the risk estimate as a percentage between 0 and 100."
    )

    response = client.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=[{"role": "system", "content": "You output only JSON with clinically grounded reasoning."},
                  {"role": "user", "content": prompt}],
        temperature=0.3,
        response_format={"type": "json_object"}
    )

    content = response.choices[0].message.content

    try:
        payload = json.loads(content)
    except json.JSONDecodeError:
        payload = {
            "risk_percent": None,
            "risk_level": "unknown",
            "key_drivers": ["Unable to parse model response."],
            "optimization_steps": [],
        }

    return payload

@app.post("/notes")
def generate_note(data: NoteInput):
    labs_text = (data.labs_imaging_summary or "").strip() or "Not provided"

    attachment_lines = []
    if data.attachments:
        for item in data.attachments:
            parts = []
            if item.name:
                descriptor = item.name
                if item.type:
                    descriptor += f" ({item.type})"
                parts.append(descriptor)
            if item.notes:
                parts.append(item.notes.strip())
            if parts:
                attachment_lines.append(" — ".join(parts))

    attachments_text = (
        "\n".join(f"- {line}" for line in attachment_lines)
        if attachment_lines
        else "No supporting files uploaded."
    )

    prompt = (
        "You are an experienced perioperative physician assistant. "
        "Draft a polished pre-operative note that can be copied directly into the EMR. "
        "Use clear section headers and concise bullet points where useful. "
        "Keep the tone clinical and objective. "
        "Structure the note using the following sections (even if some items need to be marked as 'Not provided'):\n\n"
        "1. Patient Overview\n"
        "2. Planned Procedure\n"
        "3. Pertinent Medical History & Comorbidities\n"
        "4. Relevant Labs / Imaging\n"
        "5. Risk Considerations & Mitigations\n"
        "6. Pre-Op Checklist\n\n"
        "Summaries should be tailored to the input provided. Highlight red-flag issues succinctly. "
        "If labs or imaging details are provided, weave them into section 4. Reference any supporting files succinctly. "
        "Limit the entire note to ~220 words.\n\n"
        f"Patient summary: {data.patient_summary}\n"
        f"Planned procedure: {data.procedure}\n"
        f"Labs & imaging details: {labs_text}\n"
        "Supporting files:\n"
        f"{attachments_text}"
    )

    response = client.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=[{"role": "system", "content": "You create structured surgical documentation."},
                  {"role": "user", "content": prompt}],
        temperature=0.4,
    )

    note_text = response.choices[0].message.content.strip()
    return {"generated_note": note_text}

@app.post("/pubmed")
def get_pubmed_summary(data: PubMedInput):
    try:
        base_url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
        params = {
            "db": "pubmed",
            "term": data.query,
            "retmax": 8,
            "retmode": "json",
            "sort": "relevance"
        }

        search_response = requests.get(base_url, params=params, timeout=10)
        search_response.raise_for_status()
        ids = search_response.json().get("esearchresult", {}).get("idlist", [])

        if not ids:
            return {"related_articles": []}

        summary_url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi"
        summary_params = {
            "db": "pubmed",
            "id": ",".join(ids),
            "retmode": "json"
        }

        summary_response = requests.get(summary_url, params=summary_params, timeout=10)
        summary_response.raise_for_status()
        summary_json = summary_response.json().get("result", {})

        articles = []
        for pmid in summary_json.get("uids", [])[:5]:
            record = summary_json.get(pmid, {})
            title = record.get("title", "")
            journal = record.get("fulljournalname") or record.get("source")
            pubdate = record.get("pubdate") or record.get("sortpubdate")
            authors = record.get("authors", [])

            author_names = []
            for author in authors[:3]:
                if isinstance(author, dict) and author.get("name"):
                    author_names.append(author["name"])
                elif isinstance(author, str):
                    author_names.append(author)

            summary_bits = []
            if journal:
                summary_bits.append(journal)
            if pubdate:
                summary_bits.append(pubdate)
            if author_names:
                summary_bits.append(", ".join(author_names))

            articles.append({
                "pmid": pmid,
                "title": title.strip(),
                "url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
                "summary": " • ".join(summary_bits)
            })

        return {"related_articles": articles}
    except requests.RequestException as exc:
        print("PubMed API error", exc)
        return {"related_articles": []}
