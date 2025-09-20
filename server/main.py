from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import openai
import os
import requests
from openai import OpenAI

load_dotenv()  # Load keys from .env
openai.api_key = os.getenv("OPENAI_API_KEY")
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

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
    base_url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
    params = {
        "db": "pubmed",
        "term": data.query,
        "retmax": 3,
        "retmode": "json"
    }
    r = requests.get(base_url, params=params)
    ids = r.json().get("esearchresult", {}).get("idlist", [])

    summaries = []
    for pmid in ids:
        fetch_url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"
        fetch_params = {
            "db": "pubmed",
            "id": pmid,
            "retmode": "xml"
        }
        fetch = requests.get(fetch_url, params=fetch_params)
        if fetch.ok:
            summaries.append(f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/")
    
    return {"related_articles": summaries}