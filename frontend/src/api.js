import axios from "axios";

const API_BASE_URL = "http://127.0.0.1:8000"; // backend FastAPI

export async function getRepos() {
  const response = await axios.get(`${API_BASE_URL}/git/repos`);
  return response.data;
}

export async function getDirs(repoId) {
  if (!repoId) throw new Error("repoId is required for getDirs");
  const response = await axios.get(`${API_BASE_URL}/git/dirs?repo_id=${repoId}`);
  return response.data;
}

export async function getScripts(repoId = null, dir = null) {
  let url = `${API_BASE_URL}/git/scripts`;
  const params = [];
  if (repoId) params.push(`repo_id=${repoId}`);
  if (dir) params.push(`dir=${encodeURIComponent(dir)}`);
  if (params.length) url += `?${params.join("&")}`;
  const response = await axios.get(url);
  return response.data;
}

export async function getScriptContent(scriptId) {
  const response = await axios.get(`${API_BASE_URL}/git/scripts/${scriptId}/content`);
  return response.data;
}

// Authentication helpers
export async function login(username, password) {
  const response = await axios.post(`${API_BASE_URL}/auth/login`, { username, password });
  return response.data; // { access_token, token_type }
}

export function setAuthToken(token) {
  if (token) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete axios.defaults.headers.common['Authorization'];
  }
}

export function logout() {
  setAuthToken(null);
  try { localStorage.removeItem('auth_token'); } catch (e) { /* ignore */ }
}
