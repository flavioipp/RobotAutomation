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

// Filesystem endpoints (directly read from disk under REPOS_BASE_PATH)
export async function fsGetRepos() {
  const response = await axios.get(`${API_BASE_URL}/git/fs/repos`);
  return response.data;
}

export async function fsList(repo, path = '.') {
  const response = await axios.get(`${API_BASE_URL}/git/fs/list`, { params: { repo, path } });
  return response.data;
}

export async function fsGetFile(repo, path) {
  const response = await axios.get(`${API_BASE_URL}/git/fs/file`, { params: { repo, path } });
  return response.data;
}

export async function fsGetMeta(repo, path) {
  const response = await axios.get(`${API_BASE_URL}/git/fs/meta`, { params: { repo, path } });
  return response.data;
}

export async function fsGetMetaDir(repo, path = '.') {
  const response = await axios.get(`${API_BASE_URL}/git/fs/meta-dir`, { params: { repo, path } });
  return response.data;
}

export async function fsSaveSuite(repo, name, files) {
  const response = await axios.post(`${API_BASE_URL}/git/fs/save-suite`, { repo, name, files });
  return response.data;
}

export async function fsListSuites(repo) {
  const response = await axios.get(`${API_BASE_URL}/git/fs/list-suites`, { params: { repo } });
  return response.data;
}

export async function fsGetSuiteFile(repo, name) {
  const response = await axios.get(`${API_BASE_URL}/git/fs/suite-file`, { params: { repo, name } });
  return response.data;
}

// Return backend filesystem config (SCRIPT_REPO_NAME and available repos)
export async function fsGetConfig() {
  const response = await axios.get(`${API_BASE_URL}/git/fs/config`);
  return response.data;
}

// Request backend to checkout a branch in the configured script repo
export async function fsCheckout(branch) {
  const response = await axios.post(`${API_BASE_URL}/git/fs/checkout`, { branch });
  return response.data;
}

export async function getBenches() {
  const response = await axios.get(`${API_BASE_URL}/git/benches`);
  return response.data;
}

export async function getUsers() {
  const response = await axios.get(`${API_BASE_URL}/auth/users`);
  return response.data;
}

export async function getBrands() {
  const response = await axios.get(`${API_BASE_URL}/db/brands`);
  return response.data;
}

export async function getEquipTypes() {
  const response = await axios.get(`${API_BASE_URL}/db/equip-types`);
  return response.data;
}

export async function getLibs() {
  const response = await axios.get(`${API_BASE_URL}/db/libs`);
  return response.data;
}

export async function getLibsForEquipType(equipTypeId) {
  const response = await axios.get(`${API_BASE_URL}/db/libs`, { params: { equip_type_id: equipTypeId } });
  return response.data;
}

export async function getBenchesPage(limit = 50, offset = 0) {
  const response = await axios.get(`${API_BASE_URL}/db/benches`, { params: { limit, offset } });
  return response.data; // { items, limit, offset, total }
}

export async function getBenchById(id) {
  const response = await axios.get(`${API_BASE_URL}/db/benches/${id}`);
  return response.data;
}

export async function updateBench(id, payload) {
  const response = await axios.patch(`${API_BASE_URL}/db/benches/${id}`, payload);
  return response.data;
}

export async function revealCredential(benchId, credId) {
  const response = await axios.get(`${API_BASE_URL}/db/benches/${benchId}/credentials/${credId}`);
  return response.data; // { cred_id, pwd }
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
