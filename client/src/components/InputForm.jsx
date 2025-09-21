import { useState } from "react";
import { generateNote } from "../api/api";
import html2pdf from "html2pdf.js";

const InputForm = () => {
  const [patientSummary, setPatientSummary] = useState("");
  const [procedure, setProcedure] = useState("");
  const [noteResult, setNoteResult] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const input = {
      patient_summary: patientSummary,
      procedure: procedure,
    };
    const data = await generateNote(input);
    setNoteResult(data.generated_note);
    setLoading(false);
  };
  const exportNotePDF = () => {
    if (!noteResult.trim()) return;

    const noteElement = document.getElementById("note-pdf");
    if (!noteElement) return;

    const opt = {
      margin: 0.5,
      filename: "preop-note.pdf",
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: "in", format: "letter", orientation: "portrait" },
    };

    html2pdf().set(opt).from(noteElement).save();
  };

  return (
    <section className="section-card" aria-labelledby="note-generator-title">
      <div className="section-card__header">
        <div className="section-card__icon" aria-hidden>
          🧠
        </div>
        <div>
          <h2 id="note-generator-title" className="section-card__title">
            Generate Pre-Op Note
          </h2>
          <p className="section-card__subtitle">
            Turn a quick patient summary into a clean briefing for the surgical team.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="form-grid" aria-label="Generate pre-operative note">
        <label className="input-field">
          <span className="input-field__label">Patient summary</span>
          <textarea
            rows={5}
            required
            placeholder="e.g. 65yo male with diabetes presenting with acute cholecystitis..."
            value={patientSummary}
            onChange={(e) => setPatientSummary(e.target.value)}
          />
        </label>

        <label className="input-field">
          <span className="input-field__label">Planned procedure</span>
          <input
            type="text"
            required
            placeholder="e.g. laparoscopic cholecystectomy"
            value={procedure}
            onChange={(e) => setProcedure(e.target.value)}
          />
        </label>

        <button type="submit" disabled={loading} className="button button--primary">
          {loading ? "Generating note…" : "Generate note"}
        </button>
      </form>

      {noteResult && (
        <div className="result-panel" aria-live="polite">
          <div className="result-panel__header">
            <h3 className="result-panel__title">AI-generated note</h3>
            <button onClick={exportNotePDF} className="button button--ghost">
              Download PDF
            </button>
          </div>
          <div id="note-pdf" className="result-panel__body">
            <pre>{noteResult}</pre>
          </div>
        </div>
      )}
    </section>
  );
};

export default InputForm;
