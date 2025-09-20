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
  html2pdf().from(element).save("risk-estimate.pdf");
};

  return (
    <div className="max-w-xl mx-auto p-4 mt-12">
      <h2 className="text-2xl font-semibold mb-4">📊 Surgical Risk Calculator</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="number"
          name="age"
          placeholder="Age"
          required
          value={formData.age}
          onChange={handleChange}
          className="w-full p-2 border rounded"
        />
        <input
          type="number"
          step="0.1"
          name="bmi"
          placeholder="BMI"
          required
          value={formData.bmi}
          onChange={handleChange}
          className="w-full p-2 border rounded"
        />
        <input
          type="text"
          name="comorbidities"
          placeholder="Comorbidities (comma-separated)"
          value={formData.comorbidities}
          onChange={handleChange}
          className="w-full p-2 border rounded"
        />
        <input
          type="text"
          name="procedure"
          placeholder="Procedure name"
          value={formData.procedure}
          onChange={handleChange}
          className="w-full p-2 border rounded"
        />

        <input
          type="number"
          step="0.1"
          name="bilirubin"
          placeholder="Bilirubin"
          value={formData.labs.bilirubin}
          onChange={handleChange}
          className="w-full p-2 border rounded"
        />
        <input
          type="number"
          step="0.1"
          name="alt"
          placeholder="ALT"
          value={formData.labs.alt}
          onChange={handleChange}
          className="w-full p-2 border rounded"
        />

        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          disabled={loading}
        >
          {loading ? "Calculating..." : "Calculate Risk"}
        </button>
      </form>

      {riskResult && (
  <div className="mt-6">
    <h3 className="text-xl font-semibold">💡 Estimated Risk:</h3>
    <div
      id="risk-pdf"
      className="text-lg mt-2 bg-gray-100 p-4 rounded border"
    >
      {riskResult}
    </div>
    <button
      onClick={exportRiskPDF}
      className="mt-4 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
    >
      Download PDF
    </button>
  </div>
)}
    </div>
  );
};

export default RiskForm;