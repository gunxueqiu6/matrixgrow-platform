/* ==========================================================================
   MatrixGrow Shared UI Components v2.0
   ========================================================================== */

const MatrixGrow = (() => {
  'use strict';

  const API_BASE = '/api';

  /* --- Toast System ------------------------------------------------ */
  class Toast {
    constructor() {
      this.container = document.getElementById('toast-container');
      if (!this.container) {
        this.container = document.createElement('div');
        this.container.id = 'toast-container';
        this.container.className = 'toast-container';
        document.body.appendChild(this.container);
      }
    }

    show(message, type = 'info', duration = 4000) {
      const icons = {
        success: '✓',
        error: '✗',
        warning: '⚠',
        info: 'ℹ'
      };

      const el = document.createElement('div');
      el.className = `toast toast-${type}`;
      el.innerHTML = `
        <span class="toast-icon">${icons[type] || 'i'}</span>
        <span class="toast-message">${this._escape(message)}</span>
        <button class="toast-close" onclick="this.closest('.toast').remove()">&times;</button>
      `;
      this.container.appendChild(el);

      if (duration > 0) {
        setTimeout(() => {
          el.classList.add('toast-leaving');
          setTimeout(() => el.remove(), 200);
        }, duration);
      }
    }

    success(msg, duration) { this.show(msg, 'success', duration); }
    error(msg, duration) { this.show(msg, 'error', duration || 6000); }
    warning(msg, duration) { this.show(msg, 'warning', duration); }
    info(msg, duration) { this.show(msg, 'info', duration); }

    _escape(str) {
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    }
  }

  /* --- Confirm Dialog ---------------------------------------------- */
  class ConfirmDialog {
    constructor() {
      this.backdrop = document.getElementById('confirm-backdrop');
      if (!this.backdrop) {
        this.backdrop = document.createElement('div');
        this.backdrop.id = 'confirm-backdrop';
        this.backdrop.className = 'modal-backdrop';
        this.backdrop.innerHTML = `
          <div class="modal-panel confirm-dialog">
            <div class="confirm-icon" id="confirm-icon">${this._icon('warning')}</div>
            <h2 id="confirm-title">确认操作</h2>
            <p id="confirm-message">确定要执行此操作吗？</p>
            <div class="modal-footer" style="justify-content: center;">
              <button class="btn btn-secondary" id="confirm-cancel">取消</button>
              <button class="btn btn-primary" id="confirm-ok">确定</button>
            </div>
          </div>
        `;
        document.body.appendChild(this.backdrop);
        this.backdrop.querySelector('#confirm-cancel').onclick = () => this._close();
        this.backdrop.querySelector('#confirm-ok').onclick = () => {
          this._close();
          if (this._resolve) this._resolve(true);
        };
        this.backdrop.addEventListener('click', (e) => {
          if (e.target === this.backdrop) this._close();
        });
      }
    }

    confirm(title, message, options = {}) {
      return new Promise((resolve) => {
        this._resolve = resolve;
        document.getElementById('confirm-title').textContent = title;
        document.getElementById('confirm-message').textContent = message;
        document.getElementById('confirm-icon').textContent = this._icon(options.icon || 'warning');
        const okBtn = this.backdrop.querySelector('#confirm-ok');
        okBtn.textContent = options.confirmText || '确定';
        okBtn.className = `btn ${options.danger ? 'btn-danger' : 'btn-primary'}`;
        this.backdrop.classList.add('open');
      });
    }

    _close() {
      this.backdrop.classList.remove('open');
      if (this._resolve) this._resolve(false);
    }

    _icon(type) {
      const icons = {
        warning: '⚠️',
        question: '❓',
        delete: '⛔',
        info: 'ℹ️'
      };
      return icons[type] || '⚠️';
    }
  }

  /* --- Skeleton Builder -------------------------------------------- */
  function renderSkeleton(count = 4, type = 'card') {
    if (type === 'card') {
      return `<div class="skeleton-grid">${Array(count).fill(0).map(() => `
        <div class="skeleton-card">
          <div class="skeleton-title"></div>
          <div class="skeleton-line"></div>
          <div class="skeleton-line"></div>
          <div class="skeleton-line" style="width: 50%;"></div>
        </div>
      `).join('')}</div>`;
    }
    if (type === 'list') {
      return Array(count).fill(0).map(() => `
        <div class="skeleton-card" style="display:flex; gap:12px; align-items:center;">
          <div class="skeleton" style="width:36px; height:36px; border-radius:50%; flex-shrink:0;"></div>
          <div style="flex:1;">
            <div class="skeleton-line" style="width:60%;"></div>
            <div class="skeleton-line" style="width:30%; margin-bottom:0;"></div>
          </div>
        </div>
      `).join('');
    }
    return `<div class="loading-state"><div class="spinner"></div><p>加载中...</p></div>`;
  }

  function renderEmpty(icon, title, message, actionHtml = '') {
    return `
      <div class="empty-state">
        <div class="empty-icon">${icon}</div>
        <h3>${title}</h3>
        <p>${message}</p>
        ${actionHtml}
      </div>
    `;
  }

  function renderError(message, onRetry) {
    const retryBtn = onRetry
      ? `<button class="btn btn-primary" onclick="(${onRetry.toString()})()">重试</button>`
      : '';
    return `
      <div class="error-state">
        <div class="error-icon">&#x26A0;</div>
        <h3>加载失败</h3>
        <p>${message || '请检查网络连接后重试'}</p>
        ${retryBtn}
      </div>
    `;
  }

  function showMessage(text, type = 'info') {
    const container = document.getElementById('message-container');
    if (!container) {
      // Fallback to toast
      return MatrixGrow.toast.info(text);
    }
    const classMap = { success: 'message-success', error: 'message-error', warning: 'message-warning', info: 'message-info' };
    container.innerHTML = `<div class="message ${classMap[type] || 'message-info'}">${text}</div>`;
    setTimeout(() => container.innerHTML = '', 4000);
  }

  /* --- Auth Helpers ------------------------------------------------ */
  function getToken() {
    return localStorage.getItem('token');
  }

  function authHeaders(extra = {}) {
    const token = getToken();
    if (token) {
      return { ...extra, Authorization: `Bearer ${token}` };
    }
    return extra;
  }

  async function checkAuth() {
    const token = getToken();
    if (!token) {
      window.location.href = '/login.html';
      return false;
    }
    try {
      const res = await fetch(`${API_BASE}/auth/me`, { headers: authHeaders() });
      if (!res.ok) throw new Error('Unauthorized');
      return true;
    } catch {
      localStorage.removeItem('token');
      window.location.href = '/login.html';
      return false;
    }
  }

  async function fetchJSON(url, options = {}) {
    const headers = authHeaders(options.headers || {});
    if (!headers['Content-Type'] && options.method !== 'GET' && options.method !== undefined) {
      headers['Content-Type'] = 'application/json';
    }
    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error(err.error || `Request failed: ${res.status}`);
    }
    return res.json();
  }

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('agent-messages');
    window.location.href = '/login.html';
  }

  /* --- Tier Helpers ------------------------------------------------ */
  function updateBadge(tier) {
    const badge = document.getElementById('tier-badge');
    if (!badge) return;
    badge.className = `tier-badge tier-${tier}`;
    const names = { free: 'Free', pro: 'Pro', promax: 'ProMax' };
    badge.textContent = names[tier] || tier;
  }

  async function loadTierBadge() {
    try {
      const data = await fetchJSON(`${API_BASE}/subscription`);
      updateBadge(data.tier);
    } catch (e) {
      // ignore badge errors
    }
  }

  /* --- Format Helpers ---------------------------------------------- */
  function formatDate(dateStr) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('zh-CN');
  }

  function formatDateTime(dateStr) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('zh-CN');
  }

  function formatNumber(n) {
    if (n == null) return '0';
    if (n >= 10000) return (n / 10000).toFixed(1) + '万';
    return n.toLocaleString();
  }

  /* --- Init ------------------------------------------------------- */
  const toast = new Toast();
  const confirm = new ConfirmDialog();

  return {
    API_BASE,
    toast,
    confirm,
    renderSkeleton,
    renderEmpty,
    renderError,
    showMessage,
    getToken,
    authHeaders,
    checkAuth,
    fetchJSON,
    logout,
    updateBadge,
    loadTierBadge,
    formatDate,
    formatDateTime,
    formatNumber
  };
})();

/* --- Quick Modal Builder ---------------------------------------- */
function showModal(html, title = '') {
  const backdrop = document.getElementById('modal-backdrop');
  const panel = backdrop ? backdrop.querySelector('.modal-panel') : null;
  if (backdrop && panel) {
    panel.innerHTML = title ? `<h2>${title}</h2>${html}` : html;
    backdrop.classList.add('open');
    return;
  }
  const bd = document.createElement('div');
  bd.id = 'modal-backdrop';
  bd.className = 'modal-backdrop open';
  bd.innerHTML = `<div class="modal-panel">${title ? `<h2>${title}</h2>` : ''}${html}</div>`;
  bd.addEventListener('click', (e) => { if (e.target === bd) closeModal(); });
  document.body.appendChild(bd);
}

function closeModal() {
  const el = document.getElementById('modal-backdrop');
  if (el) {
    el.classList.remove('open');
    setTimeout(() => el.remove(), 200);
  }
}
