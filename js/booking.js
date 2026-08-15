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

  function renderSlots(date) {
    state.date = date;
    state.time = "";
    document.getElementById("appointmentTime").value = "";
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
      return ok3;
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
    return String(value).charAt(0).toUpperCase() + String(value).slice(1);
  }

  function resetBooking() {
    state = { step: 1, treatmentId: "", date: CosmicDB.todayIso(), time: "" };
    form.reset();
    form.style.display = "block";
    document.querySelector(".booking-steps").style.display = "flex";
    confirmCard.hidden = true;
    confirmCard.classList.remove("visible");
    document.getElementById("treatmentId").value = "";
    document.getElementById("appointmentTime").value = "";
    ["field-treatment", "field-date", "field-time", "field-name", "field-phone", "field-email"].forEach(clearError);
    renderTreatmentChoices();
    initDatePicker();
    setStep(1);
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
    var next = event.target.getAttribute("data-next");
    var prev = event.target.getAttribute("data-prev");
    if (next) {
      if (validateStep(state.step)) {
        var dest = Number(next);
        setStep(dest, dest === 2 ? "appointmentDate" : dest === 3 ? "patientName" : "");
      }
    }
    if (prev) setStep(Number(prev));
  });

  ["patientName", "patientPhone", "patientEmail"].forEach(function (id) {
    document.getElementById(id).addEventListener("input", function () {
      clearError("field-" + id.replace("patient", "").toLowerCase());
      if (id === "patientName") clearError("field-name");
      if (id === "patientPhone") clearError("field-phone");
      if (id === "patientEmail") clearError("field-email");
    });
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (!validateStep(3)) return;

    var submit = document.getElementById("submitBooking");
    submit.disabled = true;
    submit.textContent = "Reserving…";

    var result = CosmicDB.createAppointment({
      patientName: document.getElementById("patientName").value,
      phone: document.getElementById("patientPhone").value,
      email: document.getElementById("patientEmail").value,
      message: document.getElementById("patientMessage").value,
      treatmentId: state.treatmentId,
      date: dateInput.value,
      time: state.time,
    });

    submit.disabled = false;
    submit.textContent = "Confirm booking";

    if (!result.ok) {
      toast(result.error || "Unable to complete booking.", "error");
      renderSlots(dateInput.value);
      return;
    }

    showConfirmation(result.appointment);
    toast("Appointment requested successfully.");

    if (window.CosmicMail) {
      CosmicMail.sendBookingEmail(result.appointment).then(function (mail) {
        if (mail.ok) toast("Notification sent to the clinic Gmail.");
        else toast(mail.error || "Booked, but the Gmail notification failed.", "error");
      });
    }
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
