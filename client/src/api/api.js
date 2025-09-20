import axios from "axios";

const API_BASE = "http://127.0.0.1:8000"; 

export const generateNote = async (input) => {
  try {
    const response = await axios.post(`${API_BASE}/notes`, input);
    return response.data;
  } catch (err) {
    console.error("Error generating note:", err);
    return { generated_note: "[ERROR] Could not generate note." };
  }
};