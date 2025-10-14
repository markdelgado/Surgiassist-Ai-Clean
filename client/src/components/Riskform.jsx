import { useState } from "react";
import axios from "axios";
import html2pdf from "html2pdf.js";
import useAppContext from "../hooks/useAppContext";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://127.0.0.1:8000";

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

  const [riskResult, setRiskResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { setRiskResult: setGlobalRiskResult } = useAppContext();

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (["bilirubin", "alt"].includes(name)) {
      setFormData((prev) => ({
        ...prev,
        labs: {
          ...prev.labs,
          [name]: value === "" ? "" : parseFloat(value),
        },
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const cleanedLabs = Object.fromEntries(
      Object.entries(formData.labs).filter(([, value]) => value !== "" && value !== null && !Number.isNaN(value))
    );

    const payload = {
      age: parseInt(formData.age),
      bmi: parseFloat(formData.bmi),
      comorbidities: formData.comorbidities
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean),
      procedure: formData.procedure,
      labs: cleanedLabs,
    };

    try {
      const res = await axios.post(`${API_BASE}/risk`, payload);
      setRiskResult(res.data);
      setGlobalRiskResult(res.data);
      setError("");
    } catch (err) {
      setRiskResult(null);
      setGlobalRiskResult(null);
      setError("[ERROR] Could not calculate risk.");
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
      html2canvas: {
        scale: 2,
        backgroundColor: "#ffffff",
        scrollY: -window.scrollY,
      },
      jsPDF: { unit: "in", format: "letter", orientation: "portrait" },
    };

    const prevStyles = {
      background: element.style.background,
      color: element.style.color,
      maxHeight: element.style.maxHeight,
      overflow: element.style.overflow,
      boxShadow: element.style.boxShadow,
    };

    element.style.background = "#ffffff";
    element.style.color = "#0f172a";
    element.style.maxHeight = "none";
    element.style.overflow = "visible";
    element.style.boxShadow = "none";

    html2pdf()
      .set(options)
      .from(element)
      .save()
      .catch((error) => {
        console.error("Error exporting risk PDF", error);
      })
      .finally(() => {
        element.style.background = prevStyles.background;
        element.style.color = prevStyles.color;
        element.style.maxHeight = prevStyles.maxHeight;
        element.style.overflow = prevStyles.overflow;
        element.style.boxShadow = prevStyles.boxShadow;
      });
  };

  const percentValue = riskResult?.risk_percent;
  const numericPercent =
    typeof percentValue === "number" ? percentValue : Number(percentValue);
  const formattedRiskPercent =
    Number.isFinite(numericPercent) ? `${numericPercent.toFixed(1)}%` : "—";

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

      {error && (
        <div className="result-panel" role="alert">
          <div className="result-panel__body">
            <p>{error}</p>
          </div>
        </div>
      )}

      {riskResult && (
        <div className="result-panel" aria-live="polite">
          <div className="result-panel__header">
            <h3 className="result-panel__title">Estimated complication risk</h3>
            <button onClick={exportRiskPDF} className="button button--ghost">
              Download PDF
            </button>
          </div>
          <div id="risk-pdf" className="result-panel__body risk-summary">
            <div className="risk-summary__score">
              <div>
                <span className="risk-summary__value">{formattedRiskPercent}</span>
                <span className={`risk-summary__chip risk-summary__chip--${(riskResult.risk_level || "unknown").toLowerCase()}`}>
                  {riskResult.risk_level || "Unknown"}
                </span>
              </div>
            </div>

            <div className="risk-summary__section">
              <h4>Key drivers</h4>
              <ul>
                {(riskResult.key_drivers || ["No drivers identified."]).map((item, idx) => (
                  <li key={`driver-${idx}`}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="risk-summary__section">
              <h4>Optimization steps</h4>
              <ul>
                {(riskResult.optimization_steps || ["No optimization steps provided."]).map((item, idx) => (
                  <li key={`opt-${idx}`}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default RiskForm;
