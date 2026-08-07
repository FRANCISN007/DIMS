import axios from "axios";

// ✅ Use the API base URL from config.json (set globally in index.js)
const API_BASE_URL = window.apiBaseUrl || `http://${window.location.hostname}:8000`;

const API = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json"
  }
});

export default API;
