const Auth = (() => {
  const TOKEN_KEY = 'matrixgrow_token';
  const USER_KEY = 'matrixgrow_user';

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function getUser() {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  }

  function setSession(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  function isLoggedIn() {
    return !!getToken();
  }

  function authHeaders() {
    const token = getToken();
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  }

  async function fetchWithAuth(url, options = {}) {
    const headers = {
      ...options.headers,
      ...authHeaders()
    };
    return fetch(url, { ...options, headers });
  }

  async function login(email, password) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    setSession(data.token, data.user);
    return data;
  }

  async function register(email, password, displayName) {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, displayName })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registration failed');
    setSession(data.token, data.user);
    return data;
  }

  function logout() {
    clearSession();
    window.location.href = '/';
  }

  function updateUI() {
    const loggedIn = isLoggedIn();
    document.querySelectorAll('.auth-logged-in').forEach(el => {
      el.style.display = loggedIn ? '' : 'none';
    });
    document.querySelectorAll('.auth-logged-out').forEach(el => {
      el.style.display = loggedIn ? 'none' : '';
    });

    const user = getUser();
    if (user) {
      document.querySelectorAll('.auth-user-name').forEach(el => {
        el.textContent = user.displayName || user.email;
      });
    }
  }

  document.addEventListener('DOMContentLoaded', updateUI);

  return {
    getToken,
    getUser,
    isLoggedIn,
    login,
    register,
    logout,
    fetchWithAuth,
    authHeaders,
    updateUI
  };
})();
