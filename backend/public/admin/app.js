const API = '/v1/admin';
const MERCHANT_API = '/v1/admin/merchant';
const AUTH_KEY = 'chaslay_admin_token';
let currentUser = null;
let currentView = 'dashboard';
let currentTenantId = null;
let lastGeneratedCode = null;
let loginMode = 'merchant';

async function copyText(text, buttonEl) {
  const value = String(text ?? '').trim();
  if (!value) return;
  try {
    await navigator.clipboard.writeText(value);
    if (buttonEl) {
      const prev = buttonEl.textContent;
      buttonEl.textContent = 'Copied!';
      setTimeout(() => { buttonEl.textContent = prev; }, 1500);
    }
  } catch {
    window.prompt('Copy to clipboard:', value);
  }
}

function token() { return sessionStorage.getItem(AUTH_KEY); }
function setToken(value) {
  if (value) sessionStorage.setItem(AUTH_KEY, value);
  else sessionStorage.removeItem(AUTH_KEY);
}

async function api(path, options = {}, base = API) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token()) headers.Authorization = `Bearer ${token()}`;
  const res = await fetch(`${base}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

function showMsg(el, text, ok) {
  el.textContent = text;
  el.className = `msg ${ok ? 'ok' : 'err'}`;
  el.classList.remove('hidden');
}

function fmtDate(v) {
  if (!v) return 'ù';
  const d = typeof v === 'number' ? new Date(v) : new Date(v);
  return d.toLocaleString();
}

function fmtMoney(v) { return Number(v || 0).toFixed(2); }

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

function showLogin() {
  document.getElementById('loginView').classList.remove('hidden');
  document.getElementById('appView').classList.add('hidden');
}

function showApp() {
  document.getElementById('loginView').classList.add('hidden');
  document.getElementById('appView').classList.remove('hidden');
}

document.querySelectorAll('[data-login-mode]').forEach((btn) => {
  btn.onclick = () => {
    loginMode = btn.dataset.loginMode;
    document.querySelectorAll('[data-login-mode]').forEach((b) => b.classList.toggle('active', b === btn));
    document.getElementById('merchantLoginFields').classList.toggle('hidden', loginMode !== 'merchant');
    document.getElementById('superadminLoginFields').classList.toggle('hidden', loginMode !== 'superadmin');
  };
});

document.getElementById('loginBtn').onclick = async () => {
  const msg = document.getElementById('loginMsg');
  try {
    const body = loginMode === 'merchant'
      ? { email: document.getElementById('loginEmail').value.trim(), password: document.getElementById('loginPassword').value }
      : { password: document.getElementById('superadminPassword').value };
    const data = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(async (res) => {
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Login failed');
      return json;
    });
    setToken(data.token);
    currentUser = data.user;
    bootApp();
    msg.classList.add('hidden');
  } catch (e) {
    showMsg(msg, e.message, false);
  }
};

document.getElementById('logoutBtn').onclick = () => {
  setToken(null);
  currentUser = null;
  showLogin();
};

document.getElementById('closeModalBtn').onclick = () => {
  document.getElementById('tenantModal').classList.add('hidden');
  currentTenantId = null;
};

async function tryAutoLogin() {
  if (!token()) return showLogin();
  try {
    const data = await api('/auth/me');
    currentUser = data.user;
    bootApp();
  } catch {
    setToken(null);
    showLogin();
  }
}

function bootApp() {
  showApp();
  const isSuper = currentUser.role === 'SUPERADMIN';
  document.getElementById('roleBadge').textContent = isSuper ? 'Platform admin' : 'Merchant';
  document.getElementById('sidebarBrand').textContent = isSuper ? 'Chaslay Platform' : (currentUser.tenantName || 'My shop');
  document.getElementById('viewSubtitle').textContent = isSuper
    ? 'Manage agencies path: tenants, licenses, all orders'
    : `Shop: shop.chaslay.com/${currentUser.tenantSlug || ''}`;

  const nav = document.getElementById('sidebarNav');
  const items = isSuper
    ? [['dashboard', 'Dashboard'], ['tenants', 'Tenants'], ['orders', 'All orders']]
    : [['dashboard', 'Dashboard'], ['menu', 'Menu'], ['orders', 'Orders'], ['settings', 'Settings']];

  nav.innerHTML = items.map(([id, label]) =>
    `<button class="btn nav-btn${id === 'dashboard' ? ' active' : ''}" data-view="${id}">${label}</button>`
  ).join('');

  nav.querySelectorAll('[data-view]').forEach((btn) => {
    btn.onclick = () => {
      nav.querySelectorAll('[data-view]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentView = btn.dataset.view;
      document.getElementById('viewTitle').textContent = btn.textContent;
      renderView();
    };
  });

  currentView = 'dashboard';
  renderView();
}

async function renderView() {
  const root = document.getElementById('appContent');
  root.innerHTML = '<p class="muted">Loadingù</p>';
  try {
    if (currentUser.role === 'SUPERADMIN') {
      if (currentView === 'dashboard') root.innerHTML = await superDashboardHtml();
      else if (currentView === 'tenants') root.innerHTML = await superTenantsHtml();
      else if (currentView === 'orders') root.innerHTML = await superOrdersHtml();
    } else {
      if (currentView === 'dashboard') root.innerHTML = await merchantDashboardHtml();
      else if (currentView === 'menu') root.innerHTML = await merchantMenuHtml();
      else if (currentView === 'orders') root.innerHTML = await merchantOrdersHtml();
      else if (currentView === 'settings') root.innerHTML = await merchantSettingsHtml();
    }
    bindViewHandlers();
  } catch (e) {
    root.innerHTML = `<div class="msg err">${esc(e.message)}</div>`;
  }
}

async function superDashboardHtml() {
  const stats = await api('/stats');
  const cards = [
    ['Tenants', stats.tenantCount],
    ['Active devices', stats.activeDevices],
    ['Unused codes', stats.unusedCodes],
    ['Orders (7 days)', stats.ordersLast7Days],
  ].map(([lbl, num]) => `<div class="stat"><div class="num">${num}</div><div class="lbl">${lbl}</div></div>`).join('');

  const orders = stats.recentOrders || [];
  const table = orders.length ? `<table><thead><tr><th>Order</th><th>Tenant</th><th>Total</th><th>Status</th><th>When</th></tr></thead><tbody>
    ${orders.map((o) => `<tr><td>${esc(o.orderNumber)}</td><td>${esc(o.tenantName)}</td><td>${fmtMoney(o.total)}</td><td><span class="pill">${esc(o.status)}</span></td><td>${fmtDate(o.createdAt)}</td></tr>`).join('')}
  </tbody></table>` : '<p class="muted">No orders yet.</p>';

  return `<div class="stats">${cards}</div><div class="panel"><h3>Recent online orders</h3>${table}</div>`;
}

async function superTenantsHtml() {
  const { tenants } = await api('/tenants');
  const rows = tenants.map((t) => `
    <tr>
      <td><strong>${esc(t.name)}</strong></td>
      <td><div class="mono">${esc(t.slug)}</div><a href="${esc(t.shopUrl)}" target="_blank">${esc(t.shopUrl)}</a></td>
      <td>${t.activeDeviceCount}/${t.deviceCount}</td>
      <td>${t.unusedCodeCount}</td>
      <td><button class="btn small secondary" data-open-tenant="${t.id}">Manage</button></td>
    </tr>`).join('');

  return `
    <div class="panel"><h3>Create tenant (merchant)</h3>
      <div class="grid2">
        <label>Slug<input id="newSlug" placeholder="acme-burger" /></label>
        <label>Name<input id="newName" placeholder="Acme Burger" /></label>
        <label>Currency<input id="newCurrency" value="CHF" /></label>
      </div>
      <button class="btn" id="createTenantBtn">Create tenant</button>
      <div id="createTenantMsg" class="msg hidden"></div>
    </div>
    <div class="panel"><h3>All tenants</h3>
      <table><thead><tr><th>Name</th><th>Shop</th><th>Devices</th><th>Codes</th><th></th></tr></thead><tbody>${rows}</tbody></table>
    </div>`;
}

async function superOrdersHtml() {
  const { orders } = await api('/orders?limit=100');
  if (!orders.length) return '<div class="panel"><p class="muted">No orders yet.</p></div>';
  return `<div class="panel"><table><thead><tr><th>Order</th><th>Tenant</th><th>Customer</th><th>Total</th><th>Status</th><th>When</th></tr></thead><tbody>
    ${orders.map((o) => `<tr><td>${esc(o.orderNumber)}</td><td>${esc(o.tenantName)}</td><td>${esc(o.customerName || 'ù')}</td><td>${fmtMoney(o.total)}</td><td>${esc(o.status)}</td><td>${fmtDate(o.createdAt)}</td></tr>`).join('')}
  </tbody></table></div>`;
}

async function merchantDashboardHtml() {
  const stats = await api('/stats', {}, MERCHANT_API);
  const cards = [
    ['Categories', stats.category_count],
    ['Products', stats.product_count],
    ['Open orders', stats.open_orders],
    ['Orders (7 days)', stats.orders_7d],
  ].map(([lbl, num]) => `<div class="stat"><div class="num">${num}</div><div class="lbl">${lbl}</div></div>`).join('');
  return `<div class="stats">${cards}</div>
    <div class="panel"><p>Edit your menu, online orders, and shop hours here. POS tablets sync menu when online.</p>
    <p>Advanced features (table plan, KDS, kiosk) will be added in the web panel first ù see ROADMAP.</p></div>`;
}

async function merchantMenuHtml() {
  const [{ categories }, { products }] = await Promise.all([
    api('/menu/categories', {}, MERCHANT_API),
    api('/menu/products', {}, MERCHANT_API),
  ]);
  const catOpts = categories.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
  const catRows = categories.map((c) => `
    <tr><td>${esc(c.name)}</td><td>${c.sortOrder}</td><td>${c.onlineVisible ? 'Yes' : 'No'}</td>
    <td><button class="btn small danger" data-del-cat="${c.id}">Delete</button></td></tr>`).join('');
  const prodRows = products.map((p) => `
    <tr><td>${esc(p.name)}</td><td>${fmtMoney(p.price)}</td><td>${p.inStock ? 'In stock' : 'Out'}</td><td>${p.onlineVisible ? 'Online' : 'Hidden'}</td>
    <td><button class="btn small danger" data-del-prod="${p.id}">Delete</button></td></tr>`).join('');

  return `
    <div class="panel"><h3>Add category</h3>
      <div class="grid2">
        <label>Name<input id="catName" /></label>
        <label>Sort order<input id="catSort" type="number" value="0" /></label>
      </div>
      <button class="btn small" id="addCatBtn">Add category</button>
      <div id="catMsg" class="msg hidden"></div>
    </div>
    <div class="panel"><h3>Categories</h3>
      <table><thead><tr><th>Name</th><th>Sort</th><th>Online</th><th></th></tr></thead><tbody>${catRows || '<tr><td colspan="4">No categories</td></tr>'}</tbody></table>
    </div>
    <div class="panel"><h3>Add product</h3>
      <div class="grid2">
        <label>Name<input id="prodName" /></label>
        <label>Price<input id="prodPrice" type="number" step="0.05" value="0" /></label>
        <label>Category<select id="prodCat"><option value="">ù</option>${catOpts}</select></label>
        <label>Tax %<input id="prodTax" type="number" step="0.1" value="0" /></label>
      </div>
      <button class="btn small" id="addProdBtn">Add product</button>
      <div id="prodMsg" class="msg hidden"></div>
    </div>
    <div class="panel"><h3>Products</h3>
      <table><thead><tr><th>Name</th><th>Price</th><th>Stock</th><th>Online</th><th></th></tr></thead><tbody>${prodRows || '<tr><td colspan="5">No products</td></tr>'}</tbody></table>
    </div>`;
}

async function merchantOrdersHtml() {
  const { orders } = await api('/orders', {}, MERCHANT_API);
  if (!orders.length) return '<div class="panel"><p class="muted">No online orders yet.</p></div>';
  const statuses = ['NEW', 'ACCEPTED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED'];
  return `<div class="panel"><table><thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Status</th><th>When</th><th></th></tr></thead><tbody>
    ${orders.map((o) => `<tr>
      <td>${esc(o.orderNumber)}</td>
      <td>${esc(o.customerName || 'ù')}<br/><span class="mono">${esc(o.customerPhone || '')}</span></td>
      <td>${fmtMoney(o.total)}</td>
      <td><span class="pill">${esc(o.status)}</span></td>
      <td>${fmtDate(o.createdAt)}</td>
      <td><select data-order-status="${o.id}">${statuses.map((s) => `<option value="${s}" ${s === o.status ? 'selected' : ''}>${s}</option>`).join('')}</select></td>
    </tr>`).join('')}
  </tbody></table></div>`;
}

async function merchantSettingsHtml() {
  const { settings } = await api('/settings', {}, MERCHANT_API);
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const hoursRows = days.map((day) => {
    const h = settings.openingHours?.[day] || { open: '09:00', close: '22:00', closed: false };
    return `<tr>
      <td>${day}</td>
      <td><input data-day="${day}" data-field="open" value="${esc(h.open || '09:00')}" /></td>
      <td><input data-day="${day}" data-field="close" value="${esc(h.close || '22:00')}" /></td>
      <td><input type="checkbox" data-day="${day}" data-field="closed" ${h.closed ? 'checked' : ''} /></td>
    </tr>`;
  }).join('');

  return `
    <div class="panel"><h3>Opening hours</h3>
      <table><thead><tr><th>Day</th><th>Open</th><th>Close</th><th>Closed</th></tr></thead><tbody>${hoursRows}</tbody></table>
      <button class="btn small" id="saveHoursBtn" style="margin-top:12px">Save hours</button>
    </div>
    <div class="panel"><h3>Delivery zones</h3>
      <p class="muted">JSON array ù e.g. [{"name":"Zone 1","fee":5,"minOrder":20}]</p>
      <textarea class="code" id="deliveryZones">${esc(JSON.stringify(settings.deliveryZones || [], null, 2))}</textarea>
      <button class="btn small" id="saveZonesBtn" style="margin-top:12px">Save delivery zones</button>
    </div>
    <div class="panel"><h3>Order settings</h3>
      <p class="muted">JSON ù e.g. {"minPrepMinutes":15,"acceptOnlineOrders":true}</p>
      <textarea class="code" id="orderSettings">${esc(JSON.stringify(settings.orderSettings || {}, null, 2))}</textarea>
      <button class="btn small" id="saveOrderSettingsBtn" style="margin-top:12px">Save order settings</button>
    </div>
    <div id="settingsMsg" class="msg hidden"></div>`;
}

function bindViewHandlers() {
  const createBtn = document.getElementById('createTenantBtn');
  if (createBtn) {
    createBtn.onclick = async () => {
      const msg = document.getElementById('createTenantMsg');
      try {
        const { tenant } = await api('/tenants', {
          method: 'POST',
          body: JSON.stringify({
            slug: document.getElementById('newSlug').value.trim(),
            name: document.getElementById('newName').value.trim(),
            currencySymbol: document.getElementById('newCurrency').value.trim() || 'CHF',
          }),
        });
        showMsg(msg, `Created ${tenant.name}. API key: ${tenant.apiKey}`, true);
        renderView();
      } catch (e) { showMsg(msg, e.message, false); }
    };
  }

  document.querySelectorAll('[data-open-tenant]').forEach((btn) => {
    btn.onclick = () => openTenantModal(btn.dataset.openTenant);
  });

  const addCatBtn = document.getElementById('addCatBtn');
  if (addCatBtn) {
    addCatBtn.onclick = async () => {
      const msg = document.getElementById('catMsg');
      try {
        await api('/menu/categories', { method: 'POST', body: JSON.stringify({
          name: document.getElementById('catName').value.trim(),
          sortOrder: Number(document.getElementById('catSort').value || 0),
        }) }, MERCHANT_API);
        showMsg(msg, 'Category added.', true);
        renderView();
      } catch (e) { showMsg(msg, e.message, false); }
    };
  }

  document.querySelectorAll('[data-del-cat]').forEach((btn) => {
    btn.onclick = async () => {
      if (!confirm('Delete this category?')) return;
      await api(`/menu/categories/${btn.dataset.delCat}`, { method: 'DELETE' }, MERCHANT_API);
      renderView();
    };
  });

  const addProdBtn = document.getElementById('addProdBtn');
  if (addProdBtn) {
    addProdBtn.onclick = async () => {
      const msg = document.getElementById('prodMsg');
      try {
        await api('/menu/products', { method: 'POST', body: JSON.stringify({
          name: document.getElementById('prodName').value.trim(),
          price: Number(document.getElementById('prodPrice').value || 0),
          categoryId: document.getElementById('prodCat').value || null,
          taxRate: Number(document.getElementById('prodTax').value || 0),
        }) }, MERCHANT_API);
        showMsg(msg, 'Product added.', true);
        renderView();
      } catch (e) { showMsg(msg, e.message, false); }
    };
  }

  document.querySelectorAll('[data-del-prod]').forEach((btn) => {
    btn.onclick = async () => {
      if (!confirm('Delete this product?')) return;
      await api(`/menu/products/${btn.dataset.delProd}`, { method: 'DELETE' }, MERCHANT_API);
      renderView();
    };
  });

  document.querySelectorAll('[data-order-status]').forEach((sel) => {
    sel.onchange = async () => {
      await api(`/orders/${sel.dataset.orderStatus}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: sel.value }),
      }, MERCHANT_API);
    };
  });

  const saveHoursBtn = document.getElementById('saveHoursBtn');
  if (saveHoursBtn) {
    saveHoursBtn.onclick = async () => {
      const msg = document.getElementById('settingsMsg');
      try {
        const openingHours = {};
        document.querySelectorAll('[data-day][data-field]').forEach((el) => {
          const day = el.dataset.day;
          if (!openingHours[day]) openingHours[day] = {};
          if (el.dataset.field === 'closed') openingHours[day].closed = el.checked;
          else openingHours[day][el.dataset.field] = el.value;
        });
        await api('/settings', { method: 'PATCH', body: JSON.stringify({ openingHours }) }, MERCHANT_API);
        showMsg(msg, 'Opening hours saved.', true);
      } catch (e) { showMsg(msg, e.message, false); }
    };
  }

  const saveZonesBtn = document.getElementById('saveZonesBtn');
  if (saveZonesBtn) {
    saveZonesBtn.onclick = async () => {
      const msg = document.getElementById('settingsMsg');
      try {
        const deliveryZones = JSON.parse(document.getElementById('deliveryZones').value);
        await api('/settings', { method: 'PATCH', body: JSON.stringify({ deliveryZones }) }, MERCHANT_API);
        showMsg(msg, 'Delivery zones saved.', true);
      } catch (e) { showMsg(msg, e.message, false); }
    };
  }

  const saveOrderSettingsBtn = document.getElementById('saveOrderSettingsBtn');
  if (saveOrderSettingsBtn) {
    saveOrderSettingsBtn.onclick = async () => {
      const msg = document.getElementById('settingsMsg');
      try {
        const orderSettings = JSON.parse(document.getElementById('orderSettings').value);
        await api('/settings', { method: 'PATCH', body: JSON.stringify({ orderSettings }) }, MERCHANT_API);
        showMsg(msg, 'Order settings saved.', true);
      } catch (e) { showMsg(msg, e.message, false); }
    };
  }
}

async function openTenantModal(tenantId) {
  currentTenantId = tenantId;
  lastGeneratedCode = null;
  document.getElementById('tenantModal').classList.remove('hidden');
  await renderTenantDetail();
}

async function renderTenantDetail() {
  const root = document.getElementById('tenantDetail');
  root.innerHTML = '<p class="muted">Loadingù</p>';
  const [{ tenant }, { devices }, { codes }, { users }] = await Promise.all([
    api(`/tenants/${currentTenantId}`),
    api(`/tenants/${currentTenantId}/devices`),
    api(`/tenants/${currentTenantId}/codes`),
    api(`/tenants/${currentTenantId}/users`),
  ]);
  document.getElementById('modalTitle').textContent = tenant.name;

  root.innerHTML = `
    <div class="panel"><h3>Tenant settings</h3>
      <div class="grid2">
        <label>Name<input id="editName" value="${esc(tenant.name)}" /></label>
        <label>Currency<input id="editCurrency" value="${esc(tenant.currencySymbol)}" /></label>
        <label>Shop enabled<select id="editShopEnabled"><option value="true" ${tenant.shopEnabled ? 'selected' : ''}>Yes</option><option value="false" ${!tenant.shopEnabled ? 'selected' : ''}>No</option></select></label>
      </div>
      <p><strong>Shop:</strong> <a href="${esc(tenant.shopUrl)}" target="_blank">${esc(tenant.shopUrl)}</a></p>
      <p><strong>POS API key:</strong> <span class="mono" id="apiKeyText">${esc(tenant.apiKey)}</span></p>
      <div class="row"><button class="btn small" id="saveTenantBtn">Save</button><button class="btn small secondary" id="regenKeyBtn">Regenerate API key</button></div>
      <div id="tenantSaveMsg" class="msg hidden"></div>
    </div>
    <div class="panel"><h3>Merchant portal login</h3>
      <div class="grid2">
        <label>Email<input id="userEmail" type="email" /></label>
        <label>Password (min 8)<input id="userPassword" type="password" /></label>
        <label>Display name<input id="userName" value="${esc(tenant.name)}" /></label>
      </div>
      <button class="btn small" id="createUserBtn">Create merchant login</button>
      <div id="createUserMsg" class="msg hidden"></div>
      ${users.length ? `<table style="margin-top:12px"><thead><tr><th>Email</th><th>Name</th><th>Last login</th></tr></thead><tbody>
        ${users.map((u) => `<tr><td>${esc(u.email)}</td><td>${esc(u.name)}</td><td>${fmtDate(u.lastLoginAt)}</td></tr>`).join('')}
      </tbody></table>` : '<p class="muted">No merchant logins yet.</p>'}
    </div>
    <div class="panel"><h3>Generate activation code</h3>
      <p class="muted">Leave Device ID blank unless you want the code to work on one tablet only. Ask the merchant for their short Device ID from the POS (e.g. AB12-CD34).</p>
      <div class="grid2">
        <label>Label<input id="codeLabel" value="Annual license" /></label>
        <label>Valid days<input id="codeDays" type="number" value="365" /></label>
        <label>Device ID (optional)<input id="codeDeviceId" placeholder="AB12-CD34" /></label>
      </div>
      <button class="btn small" id="genCodeBtn">Generate code</button>
      <div id="genCodeMsg" class="msg hidden"></div>
      ${lastGeneratedCode ? `
        <div class="code-result">
          <p><strong>Activation code ù send this to the merchant:</strong></p>
          <div class="row code-row">
            <span class="mono code-display">${esc(lastGeneratedCode)}</span>
            <button type="button" class="btn small" id="copyLastCodeBtn">Copy code</button>
          </div>
        </div>` : ''}
    </div>
    <div class="panel"><h3>Devices (${devices.length})</h3>
      ${devices.length ? `<table><thead><tr><th>Device ID</th><th>Status</th><th>Expires</th><th></th></tr></thead><tbody>
        ${devices.map((d) => `<tr><td class="mono">${esc(d.deviceId)}</td><td>${esc(d.status)}</td><td>${fmtDate(d.expiresAt)}</td>
        <td class="row"><button type="button" class="btn small secondary" data-copy-device="${esc(d.deviceId)}">Copy</button>
        <button class="btn small secondary" data-extend="${d.id}">+365d</button></td></tr>`).join('')}
      </tbody></table>` : '<p class="muted">No devices.</p>'}
    </div>
    <div class="panel"><h3>Activation codes</h3>
      ${codes.length ? `<table><thead><tr><th>Label</th><th>Days</th><th>Bound device</th><th>Used</th></tr></thead><tbody>
        ${codes.map((c) => `<tr><td>${esc(c.label)}</td><td>${c.validDays}</td><td class="mono">${esc(c.boundDeviceId || 'ù')}</td><td>${c.isUsed ? 'Yes' : 'No'}</td></tr>`).join('')}
      </tbody></table>` : '<p class="muted">No codes.</p>'}
    </div>`;

  document.getElementById('saveTenantBtn').onclick = async () => {
    const msg = document.getElementById('tenantSaveMsg');
    try {
      await api(`/tenants/${currentTenantId}`, { method: 'PATCH', body: JSON.stringify({
        name: document.getElementById('editName').value.trim(),
        currencySymbol: document.getElementById('editCurrency').value.trim(),
        shopEnabled: document.getElementById('editShopEnabled').value === 'true',
      }) });
      showMsg(msg, 'Saved.', true);
    } catch (e) { showMsg(msg, e.message, false); }
  };

  document.getElementById('regenKeyBtn').onclick = async () => {
    if (!confirm('Regenerate API key? Update POS tablets.')) return;
    const msg = document.getElementById('tenantSaveMsg');
    try {
      const { tenant: t } = await api(`/tenants/${currentTenantId}/regenerate-api-key`, { method: 'POST' });
      document.getElementById('apiKeyText').textContent = t.apiKey;
      showMsg(msg, 'New API key generated.', true);
    } catch (e) { showMsg(msg, e.message, false); }
  };

  document.getElementById('createUserBtn').onclick = async () => {
    const msg = document.getElementById('createUserMsg');
    try {
      await api(`/tenants/${currentTenantId}/users`, { method: 'POST', body: JSON.stringify({
        email: document.getElementById('userEmail').value.trim(),
        password: document.getElementById('userPassword').value,
        name: document.getElementById('userName').value.trim(),
      }) });
      showMsg(msg, 'Merchant login created. They can sign in at admin.chaslay.com', true);
      await renderTenantDetail();
    } catch (e) { showMsg(msg, e.message, false); }
  };

  document.getElementById('genCodeBtn').onclick = async () => {
    const msg = document.getElementById('genCodeMsg');
    try {
      const data = await api(`/tenants/${currentTenantId}/codes`, { method: 'POST', body: JSON.stringify({
        label: document.getElementById('codeLabel').value.trim(),
        validDays: Number(document.getElementById('codeDays').value || 365),
        deviceId: document.getElementById('codeDeviceId').value.trim() || null,
      }) });
      lastGeneratedCode = data.code;
      showMsg(msg, 'Code generated. Copy it below and send it to the merchant.', true);
      await renderTenantDetail();
    } catch (e) { showMsg(msg, e.message, false); }
  };

  const copyLastCodeBtn = document.getElementById('copyLastCodeBtn');
  if (copyLastCodeBtn) {
    copyLastCodeBtn.onclick = () => copyText(lastGeneratedCode, copyLastCodeBtn);
  }

  root.querySelectorAll('[data-copy-device]').forEach((btn) => {
    btn.onclick = () => copyText(btn.dataset.copyDevice, btn);
  });

  root.querySelectorAll('[data-extend]').forEach((btn) => {
    btn.onclick = async () => {
      await api(`/tenants/${currentTenantId}/devices/${btn.dataset.extend}/extend`, {
        method: 'POST', body: JSON.stringify({ extraDays: 365 }),
      });
      await renderTenantDetail();
    };
  });
}

['loginPassword', 'superadminPassword'].forEach((id) => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('keydown', (e) => { if (e.key === 'Enter') document.getElementById('loginBtn').click(); });
});

tryAutoLogin();
