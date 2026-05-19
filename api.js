/* ============================================================
   NEXMART — api.js  (Task 7 — YOUR OWN BACKEND)
   All HTTP calls live here.
   ============================================================ */

// ── Change this to your Render URL after deploying backend ──
// const BASE_URL = 'https://nexmart-backend-khy5.onrender.com';
// PRODUCTION → 'https://nexmart-backend.onrender.com'  ← replace with your actual render URL
const BASE_URL = 'https://nexmart-backend-khy5.onrender.com';

/* ── Token helpers (JWT stored in localStorage) ────────────── */
function getToken()   { return localStorage.getItem('nexmart_token'); }
function setToken(t)  { localStorage.setItem('nexmart_token', t); }
function removeToken(){ localStorage.removeItem('nexmart_token'); }
function getUser()    { return JSON.parse(localStorage.getItem('nexmart_user') || 'null'); }
function setUser(u)   { localStorage.setItem('nexmart_user', JSON.stringify(u)); }
function removeUser() { localStorage.removeItem('nexmart_user'); }
function isLoggedIn() { return !!getToken(); }

/* ── Helper: unified fetch with auth header ─────────────────── */
async function apiFetch(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token   = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (res.status === 401) {
    removeToken(); removeUser();
    window.dispatchEvent(new CustomEvent('nexmart:logout'));
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `HTTP ${res.status}: ${res.statusText}`);
  }

  return res.json();
}

/* ════════════════════════════
   GET — Fetch all products
   ════════════════════════════ */
async function fetchProducts(category = '') {
  const query = category ? `?category=${encodeURIComponent(category)}` : '';
  const data  = await apiFetch(`/api/products${query}`);
  return Array.isArray(data) ? data : data.products;
}

/* ════════════════════════════
   POST — Add a product (auth required)
   ════════════════════════════ */
async function addProduct(product) {
  return apiFetch('/api/products', {
    method : 'POST',
    body   : JSON.stringify(product),
  });
}

/* ════════════════════════════
   PUT — Update a product (auth required)
   ════════════════════════════ */
async function updateProduct(id, updates) {
  return apiFetch(`/api/products/${id}`, {
    method : 'PUT',
    body   : JSON.stringify(updates),
  });
}

/* ════════════════════════════
   DELETE — Remove a product (auth required)
   ════════════════════════════ */
async function deleteProduct(id) {
  return apiFetch(`/api/products/${id}`, { method: 'DELETE' });
}

/* ════════════════════════════
   AUTH — Register
   ════════════════════════════ */
async function registerUser(name, email, password) {
  const data = await apiFetch('/api/auth/register', {
    method : 'POST',
    body   : JSON.stringify({ name, email, password }),
  });
  setToken(data.token);
  setUser(data.user);
  return data;
}

/* ════════════════════════════
   AUTH — Login
   ════════════════════════════ */
async function loginUser(email, password) {
  const data = await apiFetch('/api/auth/login', {
    method : 'POST',
    body   : JSON.stringify({ email, password }),
  });
  setToken(data.token);
  setUser(data.user);
  return data;
}

/* ════════════════════════════
   AUTH — Logout (client side)
   ════════════════════════════ */
function logoutUser() {
  removeToken();
  removeUser();
  window.dispatchEvent(new CustomEvent('nexmart:logout'));
}