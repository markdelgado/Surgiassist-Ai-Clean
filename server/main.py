from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import os
import requests
from openai import OpenAI

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

class NoteInput(BaseModel):
    patient_summary: str
    procedure: str

class PubMedInput(BaseModel):
    query: str

# ========== Routes ==========

@app.get("/")
def root():
    return {"message": "SurgiAssist AI Backend is Running ✅"}

@app.post("/risk")
def get_risk(data: RiskInput):
    # Simple logic: Increase risk with age, BMI, comorbidities
    base_risk = 5
    base_risk += (data.age - 40) * 0.2
    base_risk += (data.bmi - 25) * 0.3
    base_risk += len(data.comorbidities) * 1.5
    risk = min(max(base_risk, 0), 100)
    return {"estimated_complication_risk": f"{risk:.1f}%"}

@app.post("/notes")
def generate_note(data: NoteInput):
    prompt = f"Generate a concise pre-op note for a patient with the following: {data.patient_summary}. Procedure: {data.procedure}."

    response = client.chat.completions.create(
        model="gpt-3.5-turbo",  # 👈 Use this instead of "gpt-4"
        messages=[{"role": "user", "content": prompt}]
    )

    return {"generated_note": response.choices[0].message.content.strip()}

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
