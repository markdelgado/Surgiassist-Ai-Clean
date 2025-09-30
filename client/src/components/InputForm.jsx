import { useEffect, useRef, useState } from "react";
import { generateNote } from "../api/api";
import html2pdf from "html2pdf.js";

const InputForm = () => {
  const [patientSummary, setPatientSummary] = useState("");
  const [procedure, setProcedure] = useState("");
  const [labsSummary, setLabsSummary] = useState("");
  const [attachments, setAttachments] = useState([]);
  const attachmentsRef = useRef([]);
  const [noteResult, setNoteResult] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  useEffect(() => {
    return () => {
      attachmentsRef.current.forEach((file) => {
        if (file.previewUrl) URL.revokeObjectURL(file.previewUrl);
      });
    };
  }, []);

  const handleFilesSelected = (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    const mapped = files.map((file) => {
      const id = `${file.name}-${file.lastModified}-${crypto.randomUUID?.() || Math.random()}`;
      const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : "";
      return {
        id,
        file,
        name: file.name,
        type: file.type,
        size: file.size,
        previewUrl,
        notes: "",
      };
    });

    setAttachments((prev) => [...prev, ...mapped]);
    event.target.value = "";
  };

  const handleAttachmentNoteChange = (id, value) => {
    setAttachments((prev) =>
      prev.map((item) => (item.id === id ? { ...item, notes: value } : item))
    );
  };

  const removeAttachment = (id) => {
    setAttachments((prev) => {
      const next = prev.filter((item) => item.id !== id);
      const removed = prev.find((item) => item.id === id);
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const input = {
      patient_summary: patientSummary,
      procedure: procedure,
      labs_imaging_summary: labsSummary.trim() || null,
      attachments: attachments.map((file) => ({
        name: file.name,
        type: file.type,
        size: file.size,
        notes: file.notes.trim(),
      })),
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
      html2canvas: {
        scale: 2,
        backgroundColor: "#ffffff",
        scrollY: -window.scrollY,
      },
      jsPDF: { unit: "in", format: "letter", orientation: "portrait" },
    };

    const prevStyles = {
      background: noteElement.style.background,
      color: noteElement.style.color,
      maxHeight: noteElement.style.maxHeight,
      overflow: noteElement.style.overflow,
      boxShadow: noteElement.style.boxShadow,
    };

    noteElement.style.background = "#ffffff";
    noteElement.style.color = "#0f172a";
    noteElement.style.maxHeight = "none";
    noteElement.style.overflow = "visible";
    noteElement.style.boxShadow = "none";

    const pre = noteElement.querySelector("pre");
    const prePrev = pre
      ? {
          background: pre.style.background,
          color: pre.style.color,
          margin: pre.style.margin,
        }
      : null;

    if (pre) {
      pre.style.background = "transparent";
      pre.style.color = "#0f172a";
      pre.style.margin = "0";
    }

    html2pdf()
      .set(opt)
      .from(noteElement)
      .save()
      .catch((error) => {
        console.error("Error exporting note PDF", error);
      })
      .finally(() => {
        noteElement.style.background = prevStyles.background;
        noteElement.style.color = prevStyles.color;
        noteElement.style.maxHeight = prevStyles.maxHeight;
        noteElement.style.overflow = prevStyles.overflow;
        noteElement.style.boxShadow = prevStyles.boxShadow;

        if (pre && prePrev) {
          pre.style.background = prePrev.background;
          pre.style.color = prePrev.color;
          pre.style.margin = prePrev.margin;
        }
      });
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

        <label className="input-field">
          <span className="input-field__label">Labs & imaging highlights</span>
          <textarea
            rows={4}
            placeholder="Key lab values, imaging impressions, consultant comments, etc."
            value={labsSummary}
            onChange={(e) => setLabsSummary(e.target.value)}
          />
          <span className="input-field__hint">
            Summaries here will feed the “Relevant Labs / Imaging” section.
          </span>
        </label>

        <div className="attachment-section">
          <div className="attachment-section__header">
            <div>
              <h3>Supporting files</h3>
              <p>Add lab PDFs or imaging captures (JPG, PNG). They stay on this device.</p>
            </div>
            <label className="file-upload" aria-label="Upload lab or imaging files">
              <input
                type="file"
                accept="application/pdf,image/*"
                multiple
                onChange={handleFilesSelected}
              />
              <span>Upload files</span>
            </label>
          </div>

          {attachments.length > 0 && (
            <ul className="attachment-list">
              {attachments.map((item) => (
                <li key={item.id} className="attachment-item">
                  <div className="attachment-item__summary">
                    <div className="attachment-item__meta">
                      <span className="attachment-item__name">{item.name}</span>
                      <span className="attachment-item__type">{item.type || "Unknown type"}</span>
                      <span className="attachment-item__size">
                        {Math.round(item.size / 1024)} KB
                      </span>
                    </div>
                    {item.previewUrl && (
                      <img
                        src={item.previewUrl}
                        alt={`${item.name} preview`}
                        className="attachment-item__preview"
                      />
                    )}
                  </div>
                  <textarea
                    rows={3}
                    className="attachment-item__notes"
                    placeholder="Add a quick note (e.g., CTA chest shows segmental PE)."
                    value={item.notes}
                    onChange={(e) => handleAttachmentNoteChange(item.id, e.target.value)}
                  />
                  <button
                    type="button"
                    className="button button--ghost attachment-item__remove"
                    onClick={() => removeAttachment(item.id)}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

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
