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
      appPassword: String(settings.smtpAppPassword || "").replace(/[\s\u00a0"']+/g, ""),
    };
  }

  function request(path, options) {
    return fetch(path, options).then(function (res) {
      return res.text().then(function (text) {
        var body = null;
        try {
          body = text ? JSON.parse(text) : {};
        } catch (err) {
          var hint;
          if (res.status === 404) {
            hint = "Mail API was not found on Vercel. Redeploy from the project root (the folder that contains api/, package.json, and vercel.json). Then open /api/health to confirm.";
          } else if (res.status === 502 || res.status === 504) {
            hint = "Vercel timed out reaching Gmail. Add GMAIL_USER and GMAIL_APP_PASSWORD in Vercel → Settings → Environment Variables, then redeploy.";
          } else {
            hint = "Mail API failed (HTTP " + res.status + "). On Vercel set GMAIL_USER and GMAIL_APP_PASSWORD, then redeploy.";
          }
          throw new Error(hint);
        }
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
      if (appPassword) next.smtpAppPassword = String(appPassword).replace(/[\s\u00a0"']+/g, "");
      CosmicDB.updateSettings(next);
    }
    return request("/api/smtp-config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: String(email || "").trim(),
        appPassword: String(appPassword || "").replace(/[\s\u00a0"']+/g, ""),
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

  function notifyPatientStatus(action, appointment) {
    var smtp = settingsSmtp();
    var email = String((appointment && appointment.email) || "").trim();
    if (!email || email.indexOf("@") === -1) {
      return Promise.resolve({ ok: false, error: "This booking has no patient email." });
    }
    return request("/api/notify-appointment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "patient-status",
        action: action,
        id: appointment.id,
        booking_id: appointment.id,
        patientName: appointment.patientName,
        phone: appointment.phone,
        patientEmail: email,
        to: email,
        treatmentName: appointment.treatmentName,
        date: appointment.date,
        time: appointment.time,
        doctor: appointment.doctor,
        status: appointment.status || action,
        smtpUser: smtp.email,
        smtpPass: smtp.appPassword,
      }),
    })
      .then(function (body) {
        var sentTo = (body && body.to) || email;
        if (body && body.kind === "clinic") {
          return { ok: false, error: "Mail API sent to the clinic inbox instead of the patient." };
        }
        return { ok: true, to: sentTo };
      })
      .catch(function (err) {
        return {
          ok: false,
          error: (err && err.message) || "Could not email the patient.",
        };
      });
  }

  function requestOtp(details) {
    var smtp = settingsSmtp();
    return request("/api/booking-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "send",
        patientName: details.patientName,
        phone: details.phone,
        email: details.email,
        treatmentName: details.treatmentName,
        date: details.date,
        time: details.time,
        smtpUser: smtp.email,
        smtpPass: smtp.appPassword,
      }),
    })
      .then(function (body) {
        return { ok: true, challenge: body.challenge };
      })
      .catch(function (err) {
        return { ok: false, error: (err && err.message) || "Could not send the verification code." };
      });
  }

  function verifyOtp(details) {
    return request("/api/booking-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "verify",
        email: details.email,
        phone: details.phone,
        code: details.code,
        challenge: details.challenge,
      }),
    })
      .then(function () {
        if (window.CosmicDB) CosmicDB.markPhoneVerified(details.phone, details.email);
        return { ok: true };
      })
      .catch(function (err) {
        return { ok: false, error: (err && err.message) || "That code is not valid." };
      });
  }

  global.CosmicMail = {
    getStatus: getStatus,
    saveSmtpConfig: saveSmtpConfig,
    sendBookingEmail: sendBookingEmail,
    notifyPatientStatus: notifyPatientStatus,
    requestOtp: requestOtp,
    verifyOtp: verifyOtp,
    isConfigured: function () {
      var smtp = settingsSmtp();
      return !!(smtp.email && smtp.appPassword);
    },
  };
})(window);
