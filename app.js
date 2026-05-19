/* ============================================================
   NEXMART — app.js  (Task 7 — Full Stack Edition)
   ============================================================ */

/* ════════════════════════════
   STATE
   ════════════════════════════ */
let PRODUCTS     = [];
let FILTERED     = [];
let CART         = JSON.parse(localStorage.getItem('nexmart_cart') || '[]');
let currentPage  = 1;
const PAGE_SIZE  = 8;
let modalProduct = null;
let modalQty     = 1;

/* ════════════════════════════
   BOOTSTRAP
   ════════════════════════════ */
async function bootstrap() {
  showSpinner(true);
  hideError();

  try {
    const raw = await fetchProducts();
    // Normalize: map name→title, description→desc
    PRODUCTS = raw.map(p => ({
      ...p,
      id: p._id || p.id,
      title: p.title || p.name,
      desc: p.desc || p.description || '',
      image: p.image || 'https://images.unsplash.com/photo-1560343090-f0409e92791a?w=500&q=80',
      rating: p.rating || 4.0,
      reviews: p.reviews || 0,
      originalPrice: p.originalPrice || Math.round(p.price * 1.2),
      badge: p.badge || '',
    }));
    FILTERED = [...PRODUCTS];
    updateAuthUI();
    buildCategoryPills();
    updatePriceRange();
    applyFilters();
    showControls(true);
  } catch (err) {
    showError(err.message || 'Could not reach the API. Is the backend running?');
  } finally {
    showSpinner(false);
  }

  renderCartCount();

  window.addEventListener('nexmart:logout', () => {
    updateAuthUI();
    showToast('Session expired — please log in again', 'warning');
  });
}

window.addEventListener('DOMContentLoaded', bootstrap);

/* ════════════════════════════
   AUTH UI
   ════════════════════════════ */
function updateAuthUI() {
  const user      = getUser();
  const authBtn   = document.getElementById('auth-nav-btn');
  const adminBtn  = document.getElementById('admin-nav-btn');
  const deleteBtn = document.getElementById('modal-delete-btn');

  if (user) {
    authBtn.textContent = `👤 ${user.name.split(' ')[0]}`;
    authBtn.title = 'Click to logout';
    adminBtn.style.display = 'inline-flex';
    if (deleteBtn) deleteBtn.style.display = 'inline-flex';
  } else {
    authBtn.textContent = '🔐 Login';
    authBtn.title = '';
    adminBtn.style.display = 'none';
    if (deleteBtn) deleteBtn.style.display = 'none';
    document.getElementById('admin-panel').classList.remove('open');
  }
}

function handleAuthNavClick() {
  if (isLoggedIn()) {
    logoutUser();
    updateAuthUI();
    showToast('Logged out successfully', 'info');
  } else {
    openAuthModal('login');
  }
}

/* ── Auth Modal ─────────────────────────────────────────── */
function openAuthModal(tab = 'login') {
  switchAuthTab(tab);
  document.getElementById('auth-backdrop').style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeAuthModal() {
  document.getElementById('auth-backdrop').style.display = 'none';
  document.body.style.overflow = '';
  clearAuthErrors();
}

function handleAuthBackdropClick(e) {
  if (e.target === document.getElementById('auth-backdrop')) closeAuthModal();
}

function switchAuthTab(tab) {
  document.getElementById('auth-login-form').style.display    = tab === 'login'    ? 'block' : 'none';
  document.getElementById('auth-register-form').style.display = tab === 'register' ? 'block' : 'none';
  document.getElementById('tab-login').classList.toggle('active',    tab === 'login');
  document.getElementById('tab-register').classList.toggle('active', tab === 'register');
  clearAuthErrors();
}

function clearAuthErrors() {
  document.getElementById('login-error').textContent = '';
  document.getElementById('reg-error').textContent   = '';
}

async function handleLogin() {
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const btnText  = document.getElementById('login-btn-text');
  const errEl    = document.getElementById('login-error');

  if (!email || !password) { errEl.textContent = 'Please fill all fields'; return; }

  btnText.textContent = 'Logging in…';
  errEl.textContent   = '';

  try {
    const data = await loginUser(email, password);
    closeAuthModal();
    updateAuthUI();
    showToast(`Welcome back, ${data.user.name}! 🎉`, 'success');
  } catch (err) {
    errEl.textContent = err.message || 'Login failed';
  } finally {
    btnText.textContent = 'Login →';
  }
}

async function handleRegister() {
  const name     = document.getElementById('reg-name').value.trim();
  const email    = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const btnText  = document.getElementById('reg-btn-text');
  const errEl    = document.getElementById('reg-error');

  if (!name || !email || !password) { errEl.textContent = 'Please fill all fields'; return; }
  if (password.length < 6)          { errEl.textContent = 'Password must be at least 6 characters'; return; }

  btnText.textContent = 'Creating account…';
  errEl.textContent   = '';

  try {
    const data = await registerUser(name, email, password);
    closeAuthModal();
    updateAuthUI();
    showToast(`Account created! Welcome, ${data.user.name}! 🎉`, 'success');
  } catch (err) {
    errEl.textContent = err.message || 'Registration failed';
  } finally {
    btnText.textContent = 'Create Account →';
  }
}

/* ════════════════════════════
   ADMIN PANEL
   ════════════════════════════ */
function toggleAdminPanel() {
  if (!isLoggedIn()) { openAuthModal('login'); return; }
  document.getElementById('admin-panel').classList.toggle('open');
}

async function handleAddProduct() {
  if (!isLoggedIn()) { openAuthModal('login'); showToast('Please log in to add products', 'warning'); return; }

  const name        = document.getElementById('admin-title').value.trim();
  const price       = parseInt(document.getElementById('admin-price').value);
  const category    = document.getElementById('admin-category').value;
  const image       = document.getElementById('admin-image').value.trim();
  const description = document.getElementById('admin-desc').value.trim();
  const btnText     = document.getElementById('admin-btn-text');

  if (!name || !price || !category) {
    showToast('Title, price and category are required', 'error'); return;
  }

  btnText.textContent = 'Adding…';

  try {
    const newProduct = await addProduct({
      name, price, category,
      image: image || 'https://images.unsplash.com/photo-1560343090-f0409e92791a?w=500&q=80',
      description: description || 'Newly added product.',
      stock: 10,
    });

    // Normalize new product
    const normalized = {
      ...newProduct,
      id: newProduct._id || newProduct.id,
      title: newProduct.name,
      desc: newProduct.description || '',
      image: newProduct.image || 'https://images.unsplash.com/photo-1560343090-f0409e92791a?w=500&q=80',
      rating: 4.0,
      reviews: 0,
      originalPrice: Math.round(newProduct.price * 1.2),
      badge: 'new',
    };

    PRODUCTS.unshift(normalized);
    FILTERED = [...PRODUCTS];
    applyFilters();
    showToast(`✅ "${name}" added successfully!`, 'success');

    ['admin-title','admin-price','admin-image','admin-desc'].forEach(id =>
      (document.getElementById(id).value = '')
    );
  } catch (err) {
    showToast(`Failed to add: ${err.message}`, 'error');
  } finally {
    btnText.textContent = '＋ Add Product';
  }
}

/* ════════════════════════════
   PRODUCT GRID
   ════════════════════════════ */
function applyFilters() {
  const query    = (document.getElementById('search-input')?.value || '').toLowerCase();
  const sort     = document.getElementById('sort-select')?.value || 'default';
  const maxPrice = parseInt(document.getElementById('price-range')?.value || '999999');
  const pills    = document.querySelectorAll('.cat-pill.active');
  const cats     = [...pills].map(p => p.dataset.cat);

  let result = PRODUCTS.filter(p => {
    const inSearch = (p.title||'').toLowerCase().includes(query) || (p.desc||'').toLowerCase().includes(query);
    const inCat    = cats.length === 0 || cats.includes(p.category);
    const inPrice  = p.price <= maxPrice;
    return inSearch && inCat && inPrice;
  });

  const sortFns = {
    'price-asc'  : (a,b) => a.price - b.price,
    'price-desc' : (a,b) => b.price - a.price,
    'name-asc'   : (a,b) => (a.title||'').localeCompare(b.title||''),
    'name-desc'  : (a,b) => (b.title||'').localeCompare(a.title||''),
    'rating'     : (a,b) => (b.rating||0) - (a.rating||0),
  };
  if (sortFns[sort]) result.sort(sortFns[sort]);

  FILTERED    = result;
  currentPage = 1;
  renderGrid();
  renderPagination();
  updateResultsInfo();
}

function renderGrid() {
  const grid  = document.getElementById('product-grid');
  const start = (currentPage - 1) * PAGE_SIZE;
  const page  = FILTERED.slice(start, start + PAGE_SIZE);

  if (!FILTERED.length) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-icon">🔍</div><p>No products found</p></div>`;
    return;
  }

  grid.innerHTML = page.map(p => buildCard(p)).join('');
}

function buildCard(p) {
  const id       = p.id || p._id;
  const badge    = p.badge ? `<div class="badge badge-${p.badge}">${p.badge.toUpperCase()}</div>` : '';
  const stars    = renderStars(p.rating || 4);
  const loggedIn = isLoggedIn();

  return `
  <div class="card" onclick="openModal('${id}')">
    <div class="card-img-wrap">
      <img src="${p.image}" alt="${p.title}" loading="lazy"
           onerror="this.src='https://images.unsplash.com/photo-1560343090-f0409e92791a?w=500&q=80'">
      ${badge}
    </div>
    <div class="card-body">
      <div class="card-cat">${p.category}</div>
      <div class="card-title">${p.title}</div>
      <div class="card-stars">${stars} <span class="card-reviews">(${p.reviews || 0})</span></div>
      <div class="card-pricing">
        <span class="card-price">₹${p.price.toLocaleString('en-IN')}</span>
        ${p.originalPrice > p.price
          ? `<span class="card-original">₹${p.originalPrice.toLocaleString('en-IN')}</span>
             <span class="card-discount">${Math.round((1 - p.price / p.originalPrice) * 100)}% off</span>`
          : ''}
      </div>
      <div class="card-actions">
        <button class="card-add-btn" onclick="event.stopPropagation(); quickAddToCart('${id}')">
          Add to Cart
        </button>
        ${loggedIn
          ? `<button class="card-del-btn" onclick="event.stopPropagation(); handleDeleteCard('${id}')" title="Delete">🗑</button>`
          : ''}
      </div>
    </div>
  </div>`;
}

function renderStars(r) {
  const full  = Math.floor(r);
  const half  = r % 1 >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(empty);
}

/* ════════════════════════════
   DELETE
   ════════════════════════════ */
async function handleDeleteCard(id) {
  if (!isLoggedIn()) { openAuthModal('login'); return; }
  if (!confirm('Delete this product permanently from the database?')) return;

  try {
    await deleteProduct(id);
    PRODUCTS = PRODUCTS.filter(p => String(p.id || p._id) !== String(id));
    FILTERED = FILTERED.filter(p => String(p.id || p._id) !== String(id));
    renderGrid();
    renderPagination();
    updateResultsInfo();
    showToast('Product deleted from database', 'success');
  } catch (err) {
    showToast(`Delete failed: ${err.message}`, 'error');
  }
}

async function handleDeleteFromModal() {
  if (!modalProduct) return;
  const id = modalProduct.id || modalProduct._id;
  closeModal();
  await handleDeleteCard(id);
}

/* ════════════════════════════
   MODAL
   ════════════════════════════ */
function openModal(id) {
  const p = PRODUCTS.find(x => String(x.id || x._id) === String(id));
  if (!p) return;
  modalProduct = p;
  modalQty     = 1;

  document.getElementById('modal-img').src             = p.image || '';
  document.getElementById('modal-cat').textContent     = p.category;
  document.getElementById('modal-title').textContent   = p.title;
  document.getElementById('modal-stars').innerHTML     = renderStars(p.rating || 4);
  document.getElementById('modal-reviews').textContent = `(${p.reviews || 0} reviews)`;
  document.getElementById('modal-price').textContent   = `₹${p.price.toLocaleString('en-IN')}`;
  document.getElementById('modal-desc').textContent    = p.desc || 'No description available.';
  document.getElementById('modal-qty').textContent     = 1;

  const delBtn = document.getElementById('modal-delete-btn');
  delBtn.style.display = isLoggedIn() ? 'inline-flex' : 'none';

  document.getElementById('modal-backdrop').style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('modal-backdrop').style.display = 'none';
  document.body.style.overflow = '';
  modalProduct = null;
}

function handleModalClick(e) {
  if (e.target === document.getElementById('modal-backdrop')) closeModal();
}

function changeQty(delta) {
  modalQty = Math.max(1, modalQty + delta);
  document.getElementById('modal-qty').textContent = modalQty;
}

function addModalToCart() {
  if (!modalProduct) return;
  const id = modalProduct.id || modalProduct._id;
  for (let i = 0; i < modalQty; i++) addToCartById(String(id));
  showToast(`${modalQty}× ${modalProduct.title} added to cart`, 'success');
  closeModal();
}

/* ════════════════════════════
   CART
   ════════════════════════════ */
function quickAddToCart(id) {
  addToCartById(String(id));
  const p = PRODUCTS.find(x => String(x.id || x._id) === String(id));
  if (p) showToast(`${p.title} added to cart 🛒`, 'success');
}

function addToCartById(id) {
  const p = PRODUCTS.find(x => String(x.id || x._id) === String(id));
  if (!p) return;
  const item = CART.find(c => c.id === String(id));
  if (item) item.qty++;
  else CART.push({ id: String(id), title: p.title, price: p.price, image: p.image, qty: 1 });
  saveCart();
}

function saveCart() {
  localStorage.setItem('nexmart_cart', JSON.stringify(CART));
  renderCartCount();
}

function renderCartCount() {
  const count = CART.reduce((s, c) => s + c.qty, 0);
  document.getElementById('cart-count').textContent = count;
}

function toggleCart() {
  const backdrop = document.getElementById('cart-backdrop');
  const open = backdrop.style.display === 'flex';
  backdrop.style.display = open ? 'none' : 'flex';
  if (!open) { renderCartItems(); document.body.style.overflow = 'hidden'; }
  else        { document.body.style.overflow = ''; }
}

function handleCartClick(e) {
  if (e.target === document.getElementById('cart-backdrop')) toggleCart();
}

function renderCartItems() {
  const el      = document.getElementById('cart-items');
  const summary = document.getElementById('cart-summary');
  if (!CART.length) {
    el.innerHTML = `<div class="cart-empty"><p>Your cart is empty 🛒</p></div>`;
    summary.innerHTML = '';
    return;
  }
  el.innerHTML = CART.map(c => `
    <div class="cart-item">
      <img src="${c.image}" alt="${c.title}"
           onerror="this.src='https://via.placeholder.com/60'">
      <div class="cart-item-info">
        <div class="cart-item-title">${c.title}</div>
        <div class="cart-item-price">₹${c.price.toLocaleString('en-IN')}</div>
      </div>
      <div class="cart-qty-wrap">
        <button onclick="updateCartQty('${c.id}',-1)">−</button>
        <span>${c.qty}</span>
        <button onclick="updateCartQty('${c.id}',1)">+</button>
      </div>
      <button class="cart-item-remove" onclick="removeFromCart('${c.id}')">✕</button>
    </div>`).join('');

  const total = CART.reduce((s,c) => s + c.price * c.qty, 0);
  const items = CART.reduce((s,c) => s + c.qty, 0);
  summary.innerHTML = `
    <span>${items} item${items !== 1 ? 's' : ''}</span>
    <span>Total: <strong>₹${total.toLocaleString('en-IN')}</strong></span>`;
}

function updateCartQty(id, delta) {
  const item = CART.find(c => c.id === id);
  if (!item) return;
  item.qty = Math.max(0, item.qty + delta);
  if (item.qty === 0) CART = CART.filter(c => c.id !== id);
  saveCart();
  renderCartItems();
}

function removeFromCart(id) {
  CART = CART.filter(c => c.id !== id);
  saveCart();
  renderCartItems();
}

function checkout() {
  if (!CART.length) { showToast('Your cart is empty!', 'warning'); return; }
  const total = CART.reduce((s,c) => s + c.price * c.qty, 0);
  CART = [];
  saveCart();
  toggleCart();
  showToast(`🎉 Order placed! Total: ₹${total.toLocaleString('en-IN')}`, 'success');
}

/* ════════════════════════════
   PAGINATION
   ════════════════════════════ */
function renderPagination() {
  const pages = Math.ceil(FILTERED.length / PAGE_SIZE);
  const el    = document.getElementById('pagination');
  if (pages <= 1) { el.innerHTML = ''; return; }

  let html = '';
  if (currentPage > 1)
    html += `<button onclick="goPage(${currentPage-1})">‹ Prev</button>`;
  for (let i = 1; i <= pages; i++)
    html += `<button class="${i===currentPage?'active':''}" onclick="goPage(${i})">${i}</button>`;
  if (currentPage < pages)
    html += `<button onclick="goPage(${currentPage+1})">Next ›</button>`;
  el.innerHTML = html;
}

function goPage(n) {
  currentPage = n;
  renderGrid();
  renderPagination();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ════════════════════════════
   CATEGORY PILLS
   ════════════════════════════ */
function buildCategoryPills() {
  const cats = [...new Set(PRODUCTS.map(p => p.category))].sort();
  const el   = document.getElementById('cat-pills');
  el.innerHTML =
    `<button class="cat-pill active" data-cat="" onclick="togglePill(this)">All</button>` +
    cats.map(c => `<button class="cat-pill" data-cat="${c}" onclick="togglePill(this)">${c}</button>`).join('');
}

function togglePill(btn) {
  if (btn.dataset.cat === '') {
    document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
  } else {
    document.querySelector('.cat-pill[data-cat=""]').classList.remove('active');
    btn.classList.toggle('active');
    if (!document.querySelectorAll('.cat-pill.active').length)
      document.querySelector('.cat-pill[data-cat=""]').classList.add('active');
  }
  applyFilters();
}

/* ════════════════════════════
   HELPERS
   ════════════════════════════ */
function updatePriceRange() {
  const max = Math.max(...PRODUCTS.map(p => p.price), 999);
  const el  = document.getElementById('price-range');
  el.max    = max;
  el.value  = max;
  updatePriceLabel();
}

function updatePriceLabel() {
  const val = parseInt(document.getElementById('price-range').value);
  document.getElementById('price-label').textContent = `≤ ₹${val.toLocaleString('en-IN')}`;
  applyFilters();
}

function updateResultsInfo() {
  const el = document.getElementById('results-info');
  el.textContent = `${FILTERED.length} product${FILTERED.length !== 1 ? 's' : ''} found`;
  document.getElementById('results-bar').style.display = 'flex';
}

function showSpinner(show) {
  document.getElementById('spinner').style.display = show ? 'flex' : 'none';
}

function showControls(show) {
  document.getElementById('controls-bar').style.display = show ? 'flex' : 'none';
}

function showError(msg) {
  document.getElementById('error-msg').style.display    = 'flex';
  document.getElementById('error-detail').textContent   = msg;
  document.getElementById('controls-bar').style.display = 'none';
  document.getElementById('results-bar').style.display  = 'none';
}

function hideError() {
  document.getElementById('error-msg').style.display = 'none';
}

function retryLoad() { hideError(); bootstrap(); }

function showToast(msg, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast     = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.classList.add('visible'), 10);
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}