import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://127.0.0.1:8000"; 

export const generateNote = async (input) => {
  try {
    const response = await axios.post(`${API_BASE}/notes`, input);
    return response.data;
  } catch (err) {
    console.error("Error generating note:", err);
    return { generated_note: "[ERROR] Could not generate note." };
  }
};
export const getPubMedLinks = async (query) => {
  try {
    const response = await axios.post(`${API_BASE}/pubmed`, { query });
    return response.data.related_articles;
  } catch (err) {
    console.error("Error fetching PubMed articles:", err);
    return [];
  }
};

export const generateEvidenceBundle = async (payload) => {
  try {
    const response = await axios.post(`${API_BASE}/evidence_bundle`, payload);
    return response.data;
  } catch (err) {
    console.error("Error generating evidence bundle:", err);
    throw err;
  }
};
