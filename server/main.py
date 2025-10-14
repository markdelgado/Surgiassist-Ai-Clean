from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import os
import requests
from openai import OpenAI
import json
import xml.etree.ElementTree as ET

load_dotenv()
api_key = os.getenv("OPENAI_API_KEY")

if not api_key:
    raise ValueError("OPENAI_API_KEY not found in environment variables.")

client = OpenAI(api_key=api_key)

app = FastAPI()

# CORS for local frontend access
raw_origins = os.getenv("ALLOWED_ORIGINS", "*")
if raw_origins == "*":
    allowed_origins: list[str] | str = "*"
else:
    allowed_origins = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
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

class EvidenceArticle(BaseModel):
    pmid: str
    title: str | None = None
    summary: str | None = None

class EvidenceBundleInput(BaseModel):
    case_context: str | None = None
    articles: list[EvidenceArticle]

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


def fetch_pubmed_details(pmid: str) -> dict:
    """Fetch detailed metadata for a PubMed article, including abstract text."""
    efetch_url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"
    params = {
        "db": "pubmed",
        "id": pmid,
        "retmode": "xml",
    }

    try:
        response = requests.get(efetch_url, params=params, timeout=10)
        response.raise_for_status()
    except requests.RequestException as exc:
        print(f"PubMed fetch error for PMID {pmid}", exc)
        return {}

    try:
        root = ET.fromstring(response.text)
    except ET.ParseError as exc:
        print(f"PubMed XML parse error for PMID {pmid}", exc)
        return {}

    article_node = root.find(".//PubmedArticle")
    if article_node is None:
        return {}

    def get_text(path: str) -> str:
        node = article_node.find(path)
        if node is None:
            return ""
        text = "".join(node.itertext()).strip()
        return text

    title = get_text(".//ArticleTitle")
    journal = get_text(".//Journal/Title")

    pubdate_node = article_node.find(".//JournalIssue/PubDate")
    pub_date_parts: list[str] = []
    if pubdate_node is not None:
        for tag in ("Year", "Month", "Day"):
            child = pubdate_node.find(tag)
            if child is not None and child.text:
                pub_date_parts.append(child.text.strip())
    pub_date = "-".join(pub_date_parts)

    abstract_sections = []
    for abstract in article_node.findall(".//Abstract/AbstractText"):
        label = abstract.attrib.get("Label")
        text = "".join(abstract.itertext()).strip()
        if not text:
            continue
        if label:
            abstract_sections.append(f"{label}: {text}")
        else:
            abstract_sections.append(text)

    abstract_text = "\n".join(abstract_sections).strip()

    return {
        "pmid": pmid,
        "title": title,
        "journal": journal,
        "pub_date": pub_date,
        "abstract": abstract_text,
    }


@app.post("/evidence_bundle")
def generate_evidence_bundle(data: EvidenceBundleInput):
    if not data.articles:
        return {"overview": "", "articles": []}

    detailed_articles = []
    for article in data.articles[:5]:
        details = fetch_pubmed_details(article.pmid)
        if not details:
            details = {
                "pmid": article.pmid,
                "title": article.title or "",
                "journal": "",
                "pub_date": "",
                "abstract": article.summary or "",
            }
        detailed_articles.append(details)

    formatted_entries = []
    for entry in detailed_articles:
        formatted_entries.append(
            "\n".join(
                [
                    f"Title: {entry.get('title') or 'Unknown'}",
                    f"PMID: {entry.get('pmid')}",
                    f"Journal: {entry.get('journal') or 'Unknown'}",
                    f"Publication date: {entry.get('pub_date') or 'Unknown'}",
                    f"Abstract: {entry.get('abstract') or 'Not available'}",
                ]
            )
        )

    case_context = (data.case_context or "").strip() or "No additional case context provided."

    prompt = (
        "You are assisting a surgical team preparing for a case. "
        "Summarize the evidence from the provided PubMed articles and connect them to the case context. "
        "Respond strictly in JSON with this shape:\n"
        "{\n"
        '  "overview": "One paragraph (<=120 words) synthesizing the key insights",\n'
        '  "articles": [\n'
        "    {\n"
        '      "pmid": "12345",\n'
        '      "title": "Exact article title",\n'
        '      "key_takeaways": ["bullet max ~18 words each"],\n'
        '      "clinical_application": "1-2 sentence suggestion tailored to the case"\n'
        "    }\n"
        "  ]\n"
        "}\n"
        "Do not fabricate data. If an abstract is missing, note that in the takeaways.\n\n"
        f"Case context:\n{case_context}\n\n"
        "Articles:\n"
        + "\n\n".join(formatted_entries)
    )

    response = client.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=[
            {"role": "system", "content": "You provide JSON with evidence syntheses for perioperative planning."},
            {"role": "user", "content": prompt},
        ],
        temperature=0.2,
        response_format={"type": "json_object"},
    )

    content = response.choices[0].message.content
    try:
        payload = json.loads(content)
    except json.JSONDecodeError:
        payload = {
            "overview": "",
            "articles": [
                {
                    "pmid": item.get("pmid"),
                    "title": item.get("title"),
                    "key_takeaways": ["Unable to parse model response."],
                    "clinical_application": "",
                }
                for item in detailed_articles
            ],
        }

    return payload
