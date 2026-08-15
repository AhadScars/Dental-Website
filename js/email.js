/**
 * Compatibility stub. The live mailer is js/mailer.js.
 * This file must never mention localhost or mail-server.py.
 */
(function (global) {
  "use strict";
  if (global.CosmicMail && global.CosmicMail.sendBookingEmail) return;
  function fail() {
    return Promise.resolve({
      ok: false,
      error: "Mailer is not loaded. Upload js/mailer.js and redeploy.",
    });
  }
  global.CosmicMail = {
    getStatus: function () {
      return Promise.resolve({ running: true, configured: false, email: "" });
    },
    saveSmtpConfig: function (email, appPassword) {
      if (window.CosmicDB) {
        var next = { adminNotifyEmail: String(email || "").trim() };
        if (appPassword) next.smtpAppPassword = String(appPassword).replace(/\s+/g, "");
        CosmicDB.updateSettings(next);
        return Promise.resolve({ ok: true });
      }
      return fail();
    },
    sendBookingEmail: fail,
    isConfigured: function () {
      return false;
    },
  };
})(window);
