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
  const element = document.getElementById("note-pdf");
  html2pdf().from(element).save("preop-note.pdf");
};

  return (
    <div className="max-w-xl mx-auto p-4">
      <h2 className="text-2xl font-semibold mb-4">🧠 Generate Pre-Op Note</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <textarea
          rows={4}
          required
          placeholder="Patient summary (e.g. 65yo male with diabetes...)"
          className="w-full border rounded p-2"
          value={patientSummary}
          onChange={(e) => setPatientSummary(e.target.value)}
        />

        <input
          type="text"
          required
          placeholder="Procedure (e.g. laparoscopic cholecystectomy)"
          className="w-full border rounded p-2"
          value={procedure}
          onChange={(e) => setProcedure(e.target.value)}
        />

        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          {loading ? "Generating..." : "Generate Note"}
        </button>
      </form>
    {noteResult && (
  <div className="mt-6">
    <h3 className="text-xl font-semibold mb-2">📄 AI-Generated Note</h3>
    <div
      id="note-pdf"
      className="whitespace-pre-wrap bg-gray-100 p-4 rounded border"
    >
      {noteResult}
    </div>
    <button
      onClick={exportNotePDF}
      className="mt-4 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
    >
      Download PDF
    </button>
  </div>
)}
    </div>
  );
};

export default InputForm;