import { useState } from "react";
import axios from "axios";
import html2pdf from "html2pdf.js";

const RiskForm = () => {
  const [formData, setFormData] = useState({
    age: "",
    bmi: "",
    comorbidities: "",
    procedure: "",
    labs: {
      bilirubin: "",
      alt: "",
    },
  });

  const [riskResult, setRiskResult] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (["bilirubin", "alt"].includes(name)) {
      setFormData((prev) => ({
        ...prev,
        labs: { ...prev.labs, [name]: parseFloat(value) || 0 },
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const payload = {
      age: parseInt(formData.age),
      bmi: parseFloat(formData.bmi),
      comorbidities: formData.comorbidities
        .split(",")
        .map((item) => item.trim().toLowerCase()),
      procedure: formData.procedure,
      labs: formData.labs,
    };

    try {
      const res = await axios.post("http://127.0.0.1:8000/risk", payload);
      setRiskResult(res.data.estimated_complication_risk);
    } catch (err) {
      setRiskResult("[ERROR] Could not calculate risk.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  const exportRiskPDF = () => {
    const element = document.getElementById("risk-pdf");
    if (!element) return;

    const options = {
      margin: 0.5,
      filename: "risk-estimate.pdf",
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: "in", format: "letter", orientation: "portrait" },
    };

    html2pdf().set(options).from(element).save();
  };

  return (
    <section className="section-card" aria-labelledby="risk-calculator-title">
      <div className="section-card__header">
        <div className="section-card__icon" aria-hidden>
          📊
        </div>
        <div>
          <h2 id="risk-calculator-title" className="section-card__title">
            Surgical risk calculator
          </h2>
          <p className="section-card__subtitle">
            Estimate post-operative complications with quick patient and lab inputs.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="form-grid" aria-label="Calculate surgical risk">
        <div className="form-row">
          <label className="input-field">
            <span className="input-field__label">Age</span>
            <input
              type="number"
              name="age"
              placeholder="e.g. 74"
              required
              value={formData.age}
              onChange={handleChange}
              min="0"
            />
          </label>
          <label className="input-field">
            <span className="input-field__label">BMI</span>
            <input
              type="number"
              step="0.1"
              name="bmi"
              placeholder="e.g. 28.4"
              required
              value={formData.bmi}
              onChange={handleChange}
              min="0"
            />
          </label>
        </div>

        <label className="input-field">
          <span className="input-field__label">Comorbidities</span>
          <input
            type="text"
            name="comorbidities"
            placeholder="e.g. diabetes, hypertension"
            value={formData.comorbidities}
            onChange={handleChange}
          />
          <span className="input-field__hint">Separate each condition with a comma.</span>
        </label>

        <label className="input-field">
          <span className="input-field__label">Procedure name</span>
          <input
            type="text"
            name="procedure"
            placeholder="e.g. laparoscopic colectomy"
            value={formData.procedure}
            onChange={handleChange}
          />
        </label>

        <div className="form-row">
          <label className="input-field">
            <span className="input-field__label">Bilirubin</span>
            <input
              type="number"
              step="0.1"
              name="bilirubin"
              placeholder="mg/dL"
              value={formData.labs.bilirubin}
              onChange={handleChange}
              min="0"
            />
          </label>
          <label className="input-field">
            <span className="input-field__label">ALT</span>
            <input
              type="number"
              step="0.1"
              name="alt"
              placeholder="U/L"
              value={formData.labs.alt}
              onChange={handleChange}
              min="0"
            />
          </label>
        </div>

        <button type="submit" className="button button--primary" disabled={loading}>
          {loading ? "Calculating risk…" : "Calculate risk"}
        </button>
      </form>

      {riskResult && (
        <div className="result-panel" aria-live="polite">
          <div className="result-panel__header">
            <h3 className="result-panel__title">Estimated complication risk</h3>
            <button onClick={exportRiskPDF} className="button button--ghost">
              Download PDF
            </button>
          </div>
          <div id="risk-pdf" className="result-panel__body">
            <p>{riskResult}</p>
          </div>
        </div>
      )}
    </section>
  );
};

export default RiskForm;
