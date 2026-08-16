/**
 * Elegancia Dental — Gmail SMTP client
 * Hostinger uses /mail.php. Local python server still accepts /api/mail.
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

  function parseResponse(res, text) {
    var body = null;
    try {
      body = text ? JSON.parse(text) : {};
    } catch (err) {
      var hint;
      if (res.status === 404 || res.status === 403) {
        hint = "NOT_FOUND";
      } else if (res.status === 502 || res.status === 504) {
        hint = "The mail server timed out reaching Gmail. Save the App Password again in Admin → Settings.";
      } else {
        hint = "Mail API failed (HTTP " + res.status + "). Upload mail.php to Hostinger public_html and try again.";
      }
      throw new Error(hint);
    }
    if (!res.ok) {
      throw new Error((body && body.error) || "Mail API error " + res.status);
    }
    return body;
  }

  function postJson(path, payload) {
    return fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload || {}),
    }).then(function (res) {
      return res.text().then(function (text) {
        return parseResponse(res, text);
      });
    });
  }

  function requestMail(route, payload) {
    var data = Object.assign({ route: route }, payload || {});
    return postJson("/mail.php", data).catch(function (err) {
      if (!err || err.message !== "NOT_FOUND") throw err;
      return postJson("/api/mail", data).catch(function (err2) {
        if (!err2 || err2.message !== "NOT_FOUND") throw err2;
        throw new Error(
          "Mail API was not found. Upload mail.php to your Hostinger public_html folder, then open /mail.php in the browser — it should show JSON."
        );
      });
    });
  }

  function saveSmtpConfig(email, appPassword) {
    if (window.CosmicDB) {
      var next = { adminNotifyEmail: String(email || "").trim() };
      if (appPassword) next.smtpAppPassword = String(appPassword).replace(/[\s\u00a0"']+/g, "");
      CosmicDB.updateSettings(next);
    }
    return requestMail("smtp-config", {
      email: String(email || "").trim(),
      appPassword: String(appPassword || "").replace(/[\s\u00a0"']+/g, ""),
    });
  }

  function getStatus() {
    var local = settingsSmtp();
    return requestMail("status", {})
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
    return requestMail("notify", {
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
    return requestMail("patient", {
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
    return requestMail("otp", {
        action: "send",
        patientName: details.patientName,
        phone: details.phone,
        email: details.email,
        treatmentName: details.treatmentName,
        date: details.date,
        time: details.time,
        smtpUser: smtp.email,
        smtpPass: smtp.appPassword,
    })
      .then(function (body) {
        return { ok: true, challenge: body.challenge };
      })
      .catch(function (err) {
        return { ok: false, error: (err && err.message) || "Could not send the verification code." };
      });
  }

  function verifyOtp(details) {
    return requestMail("otp", {
        action: "verify",
        email: details.email,
        phone: details.phone,
        code: details.code,
        challenge: details.challenge,
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
