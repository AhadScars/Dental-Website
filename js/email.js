/**
 * Elegancia Dental — Gmail SMTP notifications
 * --------------------------------------------------------------------------
 * The browser cannot open smtp.gmail.com. CosmicMail talks to the local
 * mail-server.py process, which logs into Gmail with the App Password.
 *
 * Start the server, then use the site at http://127.0.0.1:8787
 */
(function (global) {
  "use strict";

  var DEFAULT_ORIGIN = "http://127.0.0.1:8787";

  function mailOrigin() {
    if (window.location.protocol === "http:" || window.location.protocol === "https:") {
      if (window.location.port === "8787" || window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost") {
        return window.location.origin;
      }
    }
    return DEFAULT_ORIGIN;
  }

  function api(path, options) {
    return fetch(mailOrigin() + path, options).then(function (res) {
      return res.json().catch(function () {
        return { ok: false, error: "Mail server returned an invalid response." };
      }).then(function (body) {
        if (!res.ok) {
          var err = new Error((body && body.error) || "Mail server error " + res.status);
          err.payload = body;
          throw err;
        }
        return body;
      });
    });
  }

  function getStatus() {
    return api("/api/smtp-status").catch(function () {
      return { ok: false, running: false, configured: false, email: "" };
    });
  }

  function isConfigured() {
    return true;
  }

  function saveSmtpConfig(email, appPassword) {
    return api("/api/smtp-config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email, appPassword: appPassword }),
    });
  }

  function sendBookingEmail(appointment) {
    var payload = {
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
      subject: "New appointment · " + (appointment.patientName || "Patient") + " · " + (appointment.date || "") + " " + (appointment.time || ""),
    };

    return getStatus()
      .then(function (status) {
        if (!status.running) {
          return {
            ok: false,
            error: "Start mail-server.py so Gmail SMTP can send. Open http://127.0.0.1:8787",
          };
        }
        if (!status.configured) {
          return {
            ok: false,
            error: "Save the clinic Gmail and App Password in Admin → Settings.",
          };
        }
        return api("/api/notify-appointment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }).then(function () {
          return { ok: true };
        });
      })
      .catch(function (err) {
        return {
          ok: false,
          error: err && err.message ? err.message : "Gmail SMTP send failed.",
        };
      });
  }

  global.CosmicMail = {
    mailOrigin: mailOrigin,
    getStatus: getStatus,
    isConfigured: isConfigured,
    saveSmtpConfig: saveSmtpConfig,
    sendBookingEmail: sendBookingEmail,
  };
})(window);
