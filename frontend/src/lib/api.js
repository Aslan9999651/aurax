import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const api = axios.create({ baseURL: API });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("aurax_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function apiErr(detail) {
  if (detail == null) return "حدث خطأ، حاول مرة أخرى";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((e) => (e && e.msg) || JSON.stringify(e)).join(" ");
  if (detail && detail.msg) return detail.msg;
  return String(detail);
}

export default api;
