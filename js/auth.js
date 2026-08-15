/**
 * COSMIC Dental Clinic — Admin Authentication
 * --------------------------------------------------------------------------
 * Frontend-only demo login. Credentials and the session live in the browser
 * so the admin pages can be opened without a server.
 *
 * To swap this for a real backend later:
 *   1. Replace AUTH_CONFIG / verifyCredentials with an API call.
 *   2. Keep login(), logout(), isAuthenticated(), and requireAuth() as the
 *      public surface used by admin-login.html and admin.html.
 */
(function (global) {
  "use strict";

  var SESSION_KEY = "cosmicAdminSession";
  var REMEMBER_KEY = "cosmicAdminRemember";
  var CREDENTIALS_KEY = "cosmicAdminCredentials";

  /**
   * Default demo credentials. After the first visit they are copied into
   * localStorage so the admin can change the password from Settings.
   * Swap getCredentials() / changePassword() for a real identity API later.
   */
  var AUTH_CONFIG = {
    email: "admin@cosmic.com",
    password: "cosmic123",
    displayName: "Clinic Admin",
    role: "Administrator",
  };

  function getCredentials() {
    try {
      var raw = localStorage.getItem(CREDENTIALS_KEY);
      if (raw) {
        var stored = JSON.parse(raw);
        return {
          email: stored.email || AUTH_CONFIG.email,
          password: stored.password || AUTH_CONFIG.password,
          displayName: stored.displayName || AUTH_CONFIG.displayName,
          role: stored.role || AUTH_CONFIG.role,
        };
      }
    } catch (err) {}
    var defaults = {
      email: AUTH_CONFIG.email,
      password: AUTH_CONFIG.password,
      displayName: AUTH_CONFIG.displayName,
      role: AUTH_CONFIG.role,
    };
    localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(defaults));
    return defaults;
  }

  function saveCredentials(next) {
    localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(next));
  }

  function usesDefaultPassword() {
    var creds = getCredentials();
    return creds.email === AUTH_CONFIG.email && creds.password === AUTH_CONFIG.password;
  }

  function readSession() {
    try {
      var raw = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }

  function writeSession(session, remember) {
    var payload = JSON.stringify(session);
    sessionStorage.setItem(SESSION_KEY, payload);
    if (remember) {
      localStorage.setItem(SESSION_KEY, payload);
      localStorage.setItem(REMEMBER_KEY, "1");
    } else {
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(REMEMBER_KEY);
    }
  }

  function clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(REMEMBER_KEY);
  }

  function isAuthenticated() {
    var session = readSession();
    return !!(session && session.authenticated && session.email);
  }

  function getSession() {
    return isAuthenticated() ? readSession() : null;
  }

  /**
   * Credential check. Isolated so it can become `fetch('/api/login')`.
   */
  function verifyCredentials(email, password) {
    var creds = getCredentials();
    var expectedEmail = String(creds.email).trim().toLowerCase();
    var givenEmail = String(email || "").trim().toLowerCase();
    return givenEmail === expectedEmail && String(password) === creds.password;
  }

  function login(email, password, remember) {
    var cleanEmail = String(email || "").trim();
    if (!cleanEmail) return { ok: false, error: "Email is required." };
    if (!password) return { ok: false, error: "Password is required." };
    if (!verifyCredentials(cleanEmail, password)) {
      return { ok: false, error: "Invalid email or password." };
    }

    var creds = getCredentials();
    var session = {
      authenticated: true,
      email: creds.email,
      displayName: creds.displayName,
      role: creds.role,
      token: "demo-" + Date.now().toString(36),
      loggedInAt: new Date().toISOString(),
    };
    writeSession(session, !!remember);
    return { ok: true, session: session };
  }

  function changePassword(currentPassword, newPassword, confirmPassword) {
    var creds = getCredentials();
    if (!currentPassword) return { ok: false, error: "Enter your current password." };
    if (currentPassword !== creds.password) {
      return { ok: false, error: "Current password is incorrect." };
    }
    if (!newPassword || String(newPassword).length < 6) {
      return { ok: false, error: "New password must be at least 6 characters." };
    }
    if (newPassword !== confirmPassword) {
      return { ok: false, error: "New passwords do not match." };
    }
    if (newPassword === currentPassword) {
      return { ok: false, error: "Choose a password that is different from the current one." };
    }
    saveCredentials(Object.assign({}, creds, { password: String(newPassword) }));
    return { ok: true };
  }

  function logout() {
    clearSession();
  }

  function requireAuth(loginPath) {
    if (isAuthenticated()) return true;
    var target = loginPath || "admin-login.html";
    window.location.replace(target);
    return false;
  }

  function redirectIfAuthenticated(adminPath) {
    if (!isAuthenticated()) return false;
    window.location.replace(adminPath || "admin.html");
    return true;
  }

  global.CosmicAuth = {
    AUTH_CONFIG: AUTH_CONFIG,
    login: login,
    logout: logout,
    changePassword: changePassword,
    getCredentials: getCredentials,
    usesDefaultPassword: usesDefaultPassword,
    isAuthenticated: isAuthenticated,
    getSession: getSession,
    requireAuth: requireAuth,
    redirectIfAuthenticated: redirectIfAuthenticated,
    verifyCredentials: verifyCredentials,
  };
})(window);
