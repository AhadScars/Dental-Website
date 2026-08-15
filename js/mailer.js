/**
 * Elegancia Dental — Vercel Gmail SMTP client
 * Always calls same-origin /api. Never uses localhost or mail-server.py.
 */
(function (global) {
  "use strict";

  function settingsSmtp() {
    var settings = window.CosmicDB ? CosmicDB.getSettings() : {};
    return {
      email: String(settings.adminNotifyEmail || "").trim(),
      appPassword: String(settings.smtpAppPassword || "").replace(/\s+/g, ""),
    };
  }

  function request(path, options) {
    return fetch(path, options).then(function (res) {
      return res
        .json()
        .catch(function () {
          return { ok: false, error: "Mail API returned an invalid response." };
        })
        .then(function (body) {
          if (!res.ok) {
            throw new Error((body && body.error) || "Mail API error " + res.status);
          }
          return body;
        });
    });
  }

  function saveSmtpConfig(email, appPassword) {
    if (window.CosmicDB) {
      var next = { adminNotifyEmail: String(email || "").trim() };
      if (appPassword) next.smtpAppPassword = String(appPassword).replace(/\s+/g, "");
      CosmicDB.updateSettings(next);
    }
    return request("/api/smtp-config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: String(email || "").trim(),
        appPassword: String(appPassword || "").replace(/\s+/g, ""),
      }),
    });
  }

  function getStatus() {
    var local = settingsSmtp();
    return request("/api/smtp-status")
      .then(function (status) {
        status.running = true;
        status.configured = !!(status.configured || (local.email && local.appPassword));
        if (!status.email) status.email = local.email;
        return status;
      })
      .catch(function () {
        return {
          ok: true,
          running: true,
          configured: !!(local.email && local.appPassword),
          email: local.email,
        };
      });
  }

  function sendBookingEmail(appointment) {
    var smtp = settingsSmtp();
    return request("/api/notify-appointment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: appointment.id,
        booking_id: appointment.id,
        patientName: appointment.patientName,
        phone: appointment.phone,
        email: appointment.email,
        treatmentName: appointment.treatmentName,
        date: appointment.date,
        time: appointment.time,
        doctor: appointment.doctor,
        status: appointment.status,
        message: appointment.message,
        smtpUser: smtp.email,
        smtpPass: smtp.appPassword,
        subject:
          "New appointment · " +
          (appointment.patientName || "Patient") +
          " · " +
          (appointment.date || "") +
          " " +
          (appointment.time || ""),
      }),
    })
      .then(function () {
        return { ok: true };
      })
      .catch(function (err) {
        return {
          ok: false,
          error: (err && err.message) || "Gmail SMTP send failed.",
        };
      });
  }

  global.CosmicMail = {
    getStatus: getStatus,
    saveSmtpConfig: saveSmtpConfig,
    sendBookingEmail: sendBookingEmail,
    isConfigured: function () {
      var smtp = settingsSmtp();
      return !!(smtp.email && smtp.appPassword);
    },
  };
})(window);
