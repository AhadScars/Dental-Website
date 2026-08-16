/**
 * Elegancia Dental — Appointment booking
 * Multi-step form, slot availability, validation, and confirmation.
 */
(function () {
  "use strict";

  var form = document.getElementById("bookingForm");
  if (!form || !window.CosmicDB) return;

  var state = {
    step: 1,
    treatmentId: "",
    date: "",
    time: "",
    challenge: "",
    otpSentTo: "",
  };

  var treatmentChoices = document.getElementById("treatmentChoices");
  var slotGrid = document.getElementById("slotGrid");
  var dateInput = document.getElementById("appointmentDate");
  var confirmCard = document.getElementById("bookingConfirm");
  var confirmRows = document.getElementById("confirmRows");

  function escapeHtml(value) {
    return window.CosmicUI
      ? CosmicUI.escapeHtml(value)
      : String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function toast(message, type) {
    if (window.CosmicUI) CosmicUI.showToast(message, type);
  }

  function scrollToBooking(focusId) {
    var panel = document.getElementById("book") || form;
    var header = document.getElementById("siteHeader");
    var offset = (header ? header.offsetHeight : 80) + 16;
    var top = panel.getBoundingClientRect().top + window.pageYOffset - offset;
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    if (focusId) {
      setTimeout(function () {
        var field = document.getElementById(focusId);
        if (field && typeof field.focus === "function") field.focus({ preventScroll: true });
      }, 350);
    }
  }

  function setStep(step, focusId) {
    state.step = step;
    var panels = form.querySelectorAll(".step-panel");
    Array.prototype.forEach.call(panels, function (panel) {
      panel.classList.toggle("active", Number(panel.getAttribute("data-step")) === step);
    });
    var bars = document.querySelectorAll(".booking-steps span");
    Array.prototype.forEach.call(bars, function (bar, index) {
      var n = index + 1;
      bar.classList.toggle("active", n === step);
      bar.classList.toggle("done", n < step);
    });
    scrollToBooking(focusId);
  }

  function clearError(fieldId) {
    var field = document.getElementById(fieldId);
    if (field) field.classList.remove("error");
  }

  function showError(fieldId) {
    var field = document.getElementById(fieldId);
    if (field) field.classList.add("error");
  }

  function renderTreatmentChoices(preselect) {
    var treatments = CosmicDB.getTreatments();
    treatmentChoices.innerHTML = treatments
      .map(function (item) {
        var selected = item.id === state.treatmentId ? " selected" : "";
        return (
          '<button class="choice' +
          selected +
          '" type="button" data-id="' +
          escapeHtml(item.id) +
          '">' +
          "<strong>" +
          escapeHtml(item.name) +
          "</strong>" +
          "<small>" +
          escapeHtml(String(item.duration)) +
          " min · " +
          escapeHtml(item.price || "On request") +
          "</small></button>"
        );
      })
      .join("");

    if (preselect) selectTreatment(preselect);
  }

  function selectTreatment(id, advance) {
    state.treatmentId = id;
    document.getElementById("treatmentId").value = id;
    var buttons = treatmentChoices.querySelectorAll(".choice");
    Array.prototype.forEach.call(buttons, function (btn) {
      btn.classList.toggle("selected", btn.getAttribute("data-id") === id);
    });
    clearError("field-treatment");
    if (advance) setStep(2, "appointmentDate");
  }

  function initDatePicker() {
    var today = CosmicDB.todayIso();
    dateInput.min = today;
    if (!dateInput.value) {
      dateInput.value = today;
      state.date = today;
    }
    renderSlots(dateInput.value);
  }

  function paintSlots(date) {
    var slots = CosmicDB.getSlotsForDate(date);
    var day = new Date(date + "T00:00:00").getDay();
    if (day === 0) {
      slots = slots.filter(function (slot) {
        return CosmicDB.timeToMinutes(slot.time) <= CosmicDB.timeToMinutes("03:30 PM");
      });
    }
    if (!slots.length) {
      slotGrid.innerHTML = '<div class="empty-slots">No slots have been published for this date.</div>';
      return;
    }

    slotGrid.innerHTML = slots
      .map(function (slot) {
        var taken = slot.status === "booked" || CosmicDB.isSlotTaken(date, slot.time);
        var unavailable = slot.status === "unavailable";
        var disabled = taken || unavailable;
        var label = taken ? slot.time + " · Booked" : unavailable ? slot.time + " · Closed" : slot.time;
        var cls = "slot-chip";
        if (taken) cls += " booked";
        if (unavailable) cls += " unavailable";
        return (
          '<button class="' +
          cls +
          '" type="button" data-time="' +
          escapeHtml(slot.time) +
          '"' +
          (disabled ? " disabled" : "") +
          ">" +
          escapeHtml(label) +
          "</button>"
        );
      })
      .join("");
  }

  function renderSlots(date) {
    state.date = date;
    state.time = "";
    document.getElementById("appointmentTime").value = "";
    paintSlots(date);
    if (!CosmicDB.pullTakenSlots) return;
    CosmicDB.pullTakenSlots(date).then(function () {
      if (state.date !== date) return;
      paintSlots(date);
    });
  }

  function selectTime(time) {
    state.time = time;
    document.getElementById("appointmentTime").value = time;
    var chips = slotGrid.querySelectorAll(".slot-chip");
    Array.prototype.forEach.call(chips, function (chip) {
      chip.classList.toggle("selected", chip.getAttribute("data-time") === time);
    });
    clearError("field-time");
    if (state.treatmentId && dateInput.value) setStep(3, "patientName");
  }

  function validPhone(value) {
    var digits = String(value).replace(/\D/g, "");
    return digits.length >= 10 && digits.length <= 13;
  }

  function validEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
  }

  function validateStep(step) {
    if (step === 1) {
      if (!state.treatmentId) {
        showError("field-treatment");
        return false;
      }
      return true;
    }
    if (step === 2) {
      var ok = true;
      if (!dateInput.value || dateInput.value < CosmicDB.todayIso()) {
        showError("field-date");
        ok = false;
      }
      if (!state.time) {
        showError("field-time");
        ok = false;
      } else if (CosmicDB.isSlotTaken(dateInput.value, state.time)) {
        showError("field-time");
        toast("That slot was just taken. Please choose another.", "error");
        renderSlots(dateInput.value);
        ok = false;
      }
      return ok;
    }
    if (step === 3) {
      var name = document.getElementById("patientName").value.trim();
      var phone = document.getElementById("patientPhone").value.trim();
      var email = document.getElementById("patientEmail").value.trim();
      var ok3 = true;
      if (!name) {
        showError("field-name");
        ok3 = false;
      }
      if (!validPhone(phone)) {
        showError("field-phone");
        ok3 = false;
      }
      if (!validEmail(email)) {
        showError("field-email");
        ok3 = false;
      }
      if (!document.getElementById("attendPledge").checked) {
        showError("field-pledge");
        ok3 = false;
      }
      if (ok3) {
        var guard = CosmicDB.bookingGuard(phone);
        if (!guard.ok) {
          toast(guard.error, "error");
          ok3 = false;
        }
      }
      return ok3;
    }
    if (step === 4) {
      var code = document.getElementById("otpCode").value.replace(/\D/g, "");
      if (code.length !== 6) {
        showError("field-otp");
        return false;
      }
      return true;
    }
    return true;
  }

  function formatPrettyDate(iso) {
    var parts = iso.split("-");
    if (parts.length !== 3) return iso;
    var date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return date.toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  function showConfirmation(appointment) {
    form.style.display = "none";
    document.querySelector(".booking-steps").style.display = "none";
    confirmCard.hidden = false;
    confirmCard.classList.add("visible");
    var rows = [
      ["Patient", appointment.patientName],
      ["Treatment", appointment.treatmentName],
      ["Date", formatPrettyDate(appointment.date)],
      ["Time", appointment.time],
      ["Clinician", appointment.doctor],
      ["Booking ID", appointment.id],
      ["Status", appointment.status],
    ];
    confirmRows.innerHTML = rows
      .map(function (row) {
        var value =
          row[0] === "Status"
            ? '<span class="status-badge status-' +
              appointment.status +
              '">' +
              capitalize(appointment.status) +
              "</span>"
            : "<strong>" + escapeHtml(row[1]) + "</strong>";
        return "<div><span>" + row[0] + "</span>" + value + "</div>";
      })
      .join("");
    scrollToBooking();
  }

  function capitalize(value) {
    if (value === "noshow") return "No-show";
    return String(value).charAt(0).toUpperCase() + String(value).slice(1);
  }

  function resetBooking() {
    state = { step: 1, treatmentId: "", date: CosmicDB.todayIso(), time: "", challenge: "", otpSentTo: "" };
    form.reset();
    form.style.display = "block";
    document.querySelector(".booking-steps").style.display = "flex";
    confirmCard.hidden = true;
    confirmCard.classList.remove("visible");
    document.getElementById("treatmentId").value = "";
    document.getElementById("appointmentTime").value = "";
    document.getElementById("otpCode").value = "";
    ["field-treatment", "field-date", "field-time", "field-name", "field-phone", "field-email", "field-pledge", "field-otp"].forEach(clearError);
    renderTreatmentChoices();
    initDatePicker();
    setStep(1);
  }

  function bookingDraft() {
    var treatment = CosmicDB.getTreatmentById(state.treatmentId);
    return {
      patientName: document.getElementById("patientName").value.trim(),
      phone: document.getElementById("patientPhone").value.trim(),
      email: document.getElementById("patientEmail").value.trim(),
      treatmentName: treatment ? treatment.name : "Appointment",
      date: dateInput.value,
      time: state.time,
    };
  }

  function sendVerification(done) {
    if (!window.CosmicMail || !CosmicMail.requestOtp) {
      toast("Verification is unavailable. Please call the clinic.", "error");
      return;
    }
    var sendBtn = document.getElementById("sendCodeBtn");
    var resend = document.getElementById("resendOtp");
    if (sendBtn) {
      sendBtn.disabled = true;
      sendBtn.textContent = "Sending code…";
    }
    if (resend) resend.disabled = true;

    var draft = bookingDraft();
    var proceed = function () {
      CosmicMail.requestOtp(draft).then(function (mail) {
      if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.textContent = "Send verification code";
      }
      if (resend) resend.disabled = false;
      if (!mail.ok) {
        toast(mail.error || "Could not send the verification code.", "error");
        return;
      }
      state.challenge = mail.challenge;
      state.otpSentTo = bookingDraft().email;
      document.getElementById("otpHint").textContent =
        "We sent a 6-digit code to " + state.otpSentTo + ". It expires in 10 minutes.";
      toast("Verification code sent to your email.");
      if (done) done();
    });
    };

    if (!CosmicDB.checkServerGuard) {
      proceed();
      return;
    }
    CosmicDB.checkServerGuard(draft.phone).then(function (guard) {
      if (guard && guard.ok === false && !guard.skipped) {
        if (sendBtn) {
          sendBtn.disabled = false;
          sendBtn.textContent = "Send verification code";
        }
        if (resend) resend.disabled = false;
        toast(guard.error || "This number cannot book right now.", "error");
        return;
      }
      proceed();
    });
  }

  treatmentChoices.addEventListener("click", function (event) {
    var button = event.target.closest(".choice");
    if (!button) return;
    selectTreatment(button.getAttribute("data-id"), true);
  });

  slotGrid.addEventListener("click", function (event) {
    var chip = event.target.closest(".slot-chip");
    if (!chip || chip.disabled) return;
    selectTime(chip.getAttribute("data-time"));
  });

  dateInput.addEventListener("change", function () {
    clearError("field-date");
    renderSlots(dateInput.value);
  });

  form.addEventListener("click", function (event) {
    var nextBtn = event.target.closest("[data-next]");
    var prevBtn = event.target.closest("[data-prev]");
    var next = nextBtn && nextBtn.getAttribute("data-next");
    var prev = prevBtn && prevBtn.getAttribute("data-prev");
    if (next) {
      if (!validateStep(state.step)) return;
      var dest = Number(next);
      if (dest === 4) {
        sendVerification(function () {
          setStep(4, "otpCode");
        });
        return;
      }
      setStep(dest, dest === 2 ? "appointmentDate" : dest === 3 ? "patientName" : "");
    }
    if (prev) setStep(Number(prev), prev === "3" ? "patientName" : prev === "2" ? "appointmentDate" : "");
  });

  ["patientName", "patientPhone", "patientEmail"].forEach(function (id) {
    document.getElementById(id).addEventListener("input", function () {
      clearError("field-" + id.replace("patient", "").toLowerCase());
      if (id === "patientName") clearError("field-name");
      if (id === "patientPhone") clearError("field-phone");
      if (id === "patientEmail") clearError("field-email");
    });
  });
  document.getElementById("attendPledge").addEventListener("change", function () {
    clearError("field-pledge");
  });
  document.getElementById("otpCode").addEventListener("input", function () {
    this.value = this.value.replace(/\D/g, "").slice(0, 6);
    clearError("field-otp");
  });
  document.getElementById("resendOtp").addEventListener("click", function () {
    sendVerification();
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (!validateStep(4)) return;
    if (!state.challenge) {
      toast("Request a verification code first.", "error");
      setStep(3, "patientEmail");
      return;
    }

    var submit = document.getElementById("submitBooking");
    submit.disabled = true;
    submit.textContent = "Verifying…";

    var draft = bookingDraft();
    CosmicMail.verifyOtp({
      email: draft.email,
      phone: draft.phone,
      code: document.getElementById("otpCode").value,
      challenge: state.challenge,
    }).then(function (verified) {
      if (!verified.ok) {
        submit.disabled = false;
        submit.textContent = "Verify & book";
        showError("field-otp");
        toast(verified.error || "That code is not valid.", "error");
        return;
      }

      submit.textContent = "Reserving…";
      var result = CosmicDB.createAppointment({
        patientName: draft.patientName,
        phone: draft.phone,
        email: draft.email,
        message: document.getElementById("patientMessage").value,
        treatmentId: state.treatmentId,
        date: dateInput.value,
        time: state.time,
      });

      if (!result.ok) {
        submit.disabled = false;
        submit.textContent = "Verify & book";
        toast(result.error || "Unable to complete booking.", "error");
        renderSlots(dateInput.value);
        if (/already|pending|blocked|cannot book/i.test(result.error || "")) setStep(3, "patientPhone");
        return;
      }

      var finishBooked = function (appointment) {
        submit.disabled = false;
        submit.textContent = "Verify & book";
        showConfirmation(appointment);
        toast("Appointment requested successfully.");
        CosmicMail.sendBookingEmail(appointment).then(function (mail) {
          if (mail.ok) toast("Notification sent to the clinic Gmail.");
          else toast(mail.error || "Booked, but the Gmail notification failed.", "error");
        });
      };

      if (!CosmicDB.pushServerAppointment) {
        finishBooked(result.appointment);
        return;
      }

      CosmicDB.pushServerAppointment(result.appointment).then(function (saved) {
        if (saved && saved.skipped) {
          finishBooked(result.appointment);
          return;
        }
        if (!saved || !saved.ok) {
          CosmicDB.deleteAppointment(result.appointment.id);
          submit.disabled = false;
          submit.textContent = "Verify & book";
          toast(saved && saved.error ? saved.error : "Could not complete this booking. Please try again or call the clinic.", "error");
          renderSlots(dateInput.value);
          if (/already|pending|blocked|cannot book/i.test((saved && saved.error) || "")) setStep(3, "patientPhone");
          return;
        }
        finishBooked(saved.appointment || result.appointment);
      });
    });
  });

  document.getElementById("bookAnother").addEventListener("click", resetBooking);

  renderTreatmentChoices();
  initDatePicker();

  var params = new URLSearchParams(window.location.search);
  var preset = params.get("treatment");
  if (preset && CosmicDB.getTreatmentById(preset)) {
    selectTreatment(preset);
    setStep(2);
  }
})();
