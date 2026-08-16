/**
 * COSMIC Dental Clinic — Admin dashboard
 * Views, appointment actions, patients, treatments, slots, and settings.
 */
(function () {
  "use strict";

  if (!window.CosmicAuth || !CosmicAuth.requireAuth("admin-login.html")) return;
  if (!window.CosmicDB) return;

  var pendingDeleteId = null;
  var pendingRescheduleId = null;
  var pendingRescheduleTime = "";

  var TITLES = {
    dashboard: ["Dashboard", "A clear view of today’s clinic."],
    appointments: ["Appointments", "Review, confirm, reschedule, or close visits."],
    calendar: ["Calendar", "Month, week, and day — colour-coded by status."],
    patients: ["Patients", "Everyone who has booked a chair at Elegancia."],
    treatments: ["Treatments", "The public list is generated from this catalogue."],
    slots: ["Time slots", "Open, close, or add chairs for a chosen date."],
    settings: ["Settings", "Clinic identity used across the public site."],
  };

  function afterLocalChange(result) {
    if (!result || !result.ok || !result.appointment || !CosmicDB.syncServerAppointment) {
      refreshCurrent();
      return;
    }
    CosmicDB.syncServerAppointment(result.appointment).then(function () {
      refreshCurrent();
    });
  }

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function toast(message, type) {
    var stack = $("toastStack");
    if (!stack) return;
    var node = document.createElement("div");
    node.className = "toast " + (type || "success");
    node.textContent = message;
    stack.appendChild(node);
    setTimeout(function () {
      if (node.parentNode) node.parentNode.removeChild(node);
    }, 3000);
  }

  function prettyDate(iso) {
    if (!iso) return "—";
    var parts = iso.split("-");
    var date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  }

  function badge(status) {
    return '<span class="status-badge status-' + status + '">' + capitalize(status) + "</span>";
  }

  function capitalize(value) {
    if (value === "noshow") return "No-show";
    return String(value).charAt(0).toUpperCase() + String(value).slice(1);
  }

  function initials(name) {
    return String(name || "P")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map(function (part) {
        return part.charAt(0).toUpperCase();
      })
      .join("");
  }

  /* ------------------------------------------------------------------ */
  /* Navigation                                                          */
  /* ------------------------------------------------------------------ */

  function showView(name) {
    var views = document.querySelectorAll(".view");
    Array.prototype.forEach.call(views, function (view) {
      view.classList.toggle("active", view.id === "view-" + name);
    });
    var links = document.querySelectorAll(".side-link");
    Array.prototype.forEach.call(links, function (link) {
      link.classList.toggle("active", link.getAttribute("data-view") === name);
    });
    var meta = TITLES[name] || TITLES.dashboard;
    $("viewTitle").textContent = meta[0];
    $("viewSubtitle").textContent = meta[1];
    document.body.classList.remove("sidebar-open");
    refreshView(name);
  }

  function refreshView(name) {
    if (name === "dashboard") renderDashboard();
    if (name === "appointments") renderAppointments();
    if (name === "calendar") CosmicCalendar.render();
    if (name === "patients") renderPatients();
    if (name === "treatments") renderTreatments();
    if (name === "slots") renderSlots();
    if (name === "settings") fillSettings();
  }

  function currentView() {
    var active = document.querySelector(".side-link.active");
    return active ? active.getAttribute("data-view") : "dashboard";
  }

  function refreshCurrent() {
    refreshView(currentView());
  }

  /* ------------------------------------------------------------------ */
  /* Dashboard                                                           */
  /* ------------------------------------------------------------------ */

  function renderDashboard() {
    var stats = CosmicDB.getStats();
    var cards = [
      [stats.today, "Today’s appointments", "Live on the chair list"],
      [stats.pending, "Pending requests", "Awaiting confirmation"],
      [stats.confirmed, "Confirmed appointments", "Ready to see"],
      [stats.completed, "Completed appointments", "Closed visits"],
      [stats.cancelled, "Cancelled appointments", "Includes rejected"],
      [stats.patients, "Total patients", "Unique records"],
    ];
    $("statGrid").innerHTML = cards
      .map(function (card) {
        return (
          '<article class="stat-card"><span>' +
          card[1] +
          "</span><strong>" +
          card[0] +
          "</strong><em>" +
          card[2] +
          "</em></article>"
        );
      })
      .join("");

    var today = CosmicDB.todayIso();
    var list = CosmicDB.getAppointments()
      .filter(function (item) {
        return item.date === today;
      })
      .sort(function (a, b) {
        return CosmicDB.timeToMinutes(a.time) - CosmicDB.timeToMinutes(b.time);
      });

    if (!list.length) {
      $("todayList").innerHTML =
        '<div class="empty-state"><strong>A quiet day</strong>No appointments are scheduled for today.</div>';
      return;
    }
    $("todayList").innerHTML = list
      .map(function (item) {
        return (
          '<div class="history-item" style="display:flex;justify-content:space-between;gap:12px;align-items:center;">' +
          "<div><strong>" +
          escapeHtml(item.patientName) +
          "</strong><div class='muted'>" +
          escapeHtml(item.treatmentName) +
          " · " +
          escapeHtml(item.time) +
          "</div></div>" +
          badge(item.status) +
          "</div>"
        );
      })
      .join("");
  }

  /* ------------------------------------------------------------------ */
  /* Appointments                                                        */
  /* ------------------------------------------------------------------ */

  function appointmentActions(item) {
    var html = "";
    if (item.status === "pending") {
      html += '<button class="mini-btn confirm" data-action="confirm" data-id="' + item.id + '">Accept</button>';
      html += '<button class="mini-btn reject" data-action="reject" data-id="' + item.id + '">Reject</button>';
    }
    if (item.status === "confirmed") {
      html += '<button class="mini-btn complete" data-action="complete" data-id="' + item.id + '">Complete</button>';
      html += '<button class="mini-btn danger" data-action="noshow" data-id="' + item.id + '">No-show</button>';
    }
    if (item.status !== "completed" && item.status !== "noshow") {
      html += '<button class="mini-btn" data-action="reschedule" data-id="' + item.id + '">Reschedule</button>';
    }
    if (item.status !== "cancelled" && item.status !== "rejected" && item.status !== "completed" && item.status !== "noshow") {
      html += '<button class="mini-btn danger" data-action="cancel" data-id="' + item.id + '">Cancel</button>';
    }
    if (item.phone) {
      html += '<button class="mini-btn danger" data-action="block" data-id="' + item.id + '">Block number</button>';
    }
    html += '<button class="mini-btn danger" data-action="delete" data-id="' + item.id + '">Delete</button>';
    return html;
  }

  function filteredAppointments() {
    var query = ($("apptSearch").value || "").trim().toLowerCase();
    var status = $("apptFilter").value;
    return CosmicDB.getAppointments()
      .slice()
      .sort(function (a, b) {
        return (b.date + b.time).localeCompare(a.date + a.time);
      })
      .filter(function (item) {
        if (status !== "all" && item.status !== status) return false;
        if (!query) return true;
        var blob = [item.patientName, item.email, item.phone, item.treatmentName, item.id]
          .join(" ")
          .toLowerCase();
        return blob.indexOf(query) !== -1;
      });
  }

  function renderAppointments() {
    var rows = filteredAppointments();
    var body = $("apptTableBody");
    var cards = $("apptCardList");

    if (!rows.length) {
      body.innerHTML = '<tr><td colspan="6"><div class="empty-state"><strong>No appointments</strong>Nothing matches this filter.</div></td></tr>';
      cards.innerHTML = '<div class="empty-state"><strong>No appointments</strong>Nothing matches this filter.</div>';
      return;
    }

    body.innerHTML = rows
      .map(function (item) {
        return (
          "<tr>" +
          '<td class="patient-cell"><strong>' +
          escapeHtml(item.patientName) +
          "</strong><span>" +
          escapeHtml(item.phone) +
          "</span></td>" +
          "<td>" +
          escapeHtml(item.treatmentName) +
          "</td>" +
          "<td>" +
          prettyDate(item.date) +
          "</td>" +
          "<td>" +
          escapeHtml(item.time) +
          "</td>" +
          "<td>" +
          badge(item.status) +
          "</td>" +
          '<td><div class="action-row">' +
          appointmentActions(item) +
          "</div></td>" +
          "</tr>"
        );
      })
      .join("");

    cards.innerHTML = rows
      .map(function (item) {
        return (
          '<article class="appt-card">' +
          '<div class="appt-card-top"><strong>' +
          escapeHtml(item.patientName) +
          "</strong>" +
          badge(item.status) +
          "</div>" +
          '<div class="muted">' +
          escapeHtml(item.treatmentName) +
          " · " +
          prettyDate(item.date) +
          " · " +
          escapeHtml(item.time) +
          "</div>" +
          '<div class="action-row" style="margin-top:12px">' +
          appointmentActions(item) +
          "</div></article>"
        );
      })
      .join("");
  }

  function notifyPatient(action, appointment) {
    if (!appointment || !window.CosmicMail || !CosmicMail.notifyPatientStatus) return;
    if (!appointment.email) {
      toast("Updated, but this booking has no email to notify.", "error");
      return;
    }
    CosmicMail.notifyPatientStatus(action, appointment).then(function (mail) {
      if (mail.ok) toast("Patient emailed at " + (mail.to || appointment.email) + ".");
      else toast(mail.error || "Updated, but the patient email failed.", "error");
    });
  }

  function handleAction(action, id) {
    var result;
    if (action === "confirm") {
      result = CosmicDB.changeAppointmentStatus(id, "confirmed");
      if (result.ok) {
        toast("Appointment confirmed successfully.");
        notifyPatient("confirmed", result.appointment);
        afterLocalChange(result);
        return;
      }
    } else if (action === "reject") {
      result = CosmicDB.changeAppointmentStatus(id, "rejected");
      if (result.ok) {
        toast("Appointment rejected.");
        notifyPatient("rejected", result.appointment);
        afterLocalChange(result);
        return;
      }
    } else if (action === "complete") {
      result = CosmicDB.changeAppointmentStatus(id, "completed");
      if (result.ok) toast("Appointment marked completed.");
    } else if (action === "cancel") {
      result = CosmicDB.changeAppointmentStatus(id, "cancelled");
      if (result.ok) toast("Appointment cancelled.");
    } else if (action === "noshow") {
      result = CosmicDB.markNoShow(id);
      if (result.ok) {
        toast(
          result.blocked
            ? "Marked no-show. This number is now blocked from online booking."
            : "Marked no-show. Two no-shows will block this number."
        );
      }
    } else if (action === "block") {
      var appt = CosmicDB.getAppointmentById(id);
      result = appt ? CosmicDB.blockPhone(appt.phone) : { ok: false, error: "Appointment not found." };
      if (result.ok) toast("This number can no longer book online.");
    } else if (action === "delete") {
      pendingDeleteId = id;
      openModal("deleteModal");
      return;
    } else if (action === "reschedule") {
      openReschedule(id);
      return;
    }
    if (result && !result.ok) toast(result.error || "Unable to update appointment.", "error");
    if (result && result.ok && result.appointment) afterLocalChange(result);
    else refreshCurrent();
  }

  /* ------------------------------------------------------------------ */
  /* Patients                                                            */
  /* ------------------------------------------------------------------ */

  function renderPatients() {
    var query = ($("patientSearch").value || "").trim().toLowerCase();
    var patients = CosmicDB.getPatients().filter(function (item) {
      if (!query) return true;
      return [item.name, item.phone, item.email].join(" ").toLowerCase().indexOf(query) !== -1;
    });

    if (!patients.length) {
      $("patientGrid").innerHTML =
        '<div class="empty-state"><strong>No patients yet</strong>New bookings will appear here automatically.</div>';
      return;
    }

    $("patientGrid").innerHTML = patients
      .map(function (item) {
        return (
          '<button class="patient-card" type="button" data-patient="' +
          escapeHtml(item.id) +
          '">' +
          '<div class="appt-card-top"><div style="display:flex;gap:12px;align-items:center">' +
          '<div class="avatar">' +
          initials(item.name) +
          "</div><div><strong>" +
          escapeHtml(item.name) +
          '</strong><div class="muted">' +
          escapeHtml(item.phone) +
          "</div></div></div>" +
          '<span class="status-badge status-' +
          (item.status === "Active" ? "confirmed" : "completed") +
          '">' +
          escapeHtml(item.status) +
          "</span>" +
          "</div>" +
          '<div class="muted" style="margin-top:12px">' +
          escapeHtml(item.email) +
          "</div>" +
          '<div class="muted">Visits: ' +
          item.totalAppointments +
          " · Last: " +
          prettyDate(item.lastAppointment) +
          "</div></button>"
        );
      })
      .join("");
  }

  function openPatient(id) {
    var patient = CosmicDB.getPatientById(id);
    if (!patient) return;
    $("detailTitle").textContent = patient.name;
    $("detailBody").innerHTML =
      "<p>" +
      escapeHtml(patient.email) +
      " · " +
      escapeHtml(patient.phone) +
      "</p>" +
      patient.appointments
        .map(function (item) {
          return (
            '<div class="history-item"><strong>' +
            escapeHtml(item.treatmentName) +
            "</strong><div class='muted'>" +
            prettyDate(item.date) +
            " · " +
            escapeHtml(item.time) +
            " · " +
            escapeHtml(item.id) +
            "</div>" +
            badge(item.status) +
            "</div>"
          );
        })
        .join("");
    openModal("detailModal");
  }

  /* ------------------------------------------------------------------ */
  /* Treatments                                                          */
  /* ------------------------------------------------------------------ */

  function renderTreatments() {
    var list = CosmicDB.getAllTreatments();
    $("treatAdminGrid").innerHTML = list
      .map(function (item) {
        return (
          '<article class="treat-admin-card' +
          (item.enabled ? "" : " disabled") +
          '">' +
          '<div class="treat-admin-photo"><img src="' +
          escapeHtml(item.image || "assets/images/treatments/default.jpg") +
          '" alt="" /></div>' +
          '<div class="appt-card-top"><h3 class="treat-name">' +
          escapeHtml(item.name) +
          "</h3>" +
          '<label class="toggle"><input type="checkbox" data-enable="' +
          item.id +
          '"' +
          (item.enabled ? " checked" : "") +
          " /><span></span></label></div>" +
          "<p class='muted'>" +
          escapeHtml(item.description) +
          "</p>" +
          '<div class="muted" style="margin:10px 0 14px">' +
          escapeHtml(String(item.duration)) +
          " min · " +
          escapeHtml(item.price || "On request") +
          "</div>" +
          '<div class="action-row">' +
          '<button class="mini-btn" data-edit-treat="' +
          item.id +
          '">Edit</button>' +
          '<button class="mini-btn danger" data-del-treat="' +
          item.id +
          '">Delete</button>' +
          "</div></article>"
        );
      })
      .join("");
  }

  function openTreatmentModal(id) {
    var form = $("treatmentForm");
    form.reset();
    $("treatId").value = "";
    $("treatmentModalTitle").textContent = "Add treatment";
    if (id) {
      var item = CosmicDB.getTreatmentById(id);
      if (!item) return;
      $("treatmentModalTitle").textContent = "Edit treatment";
      $("treatId").value = item.id;
      $("treatName").value = item.name;
      $("treatDesc").value = item.description;
      $("treatDuration").value = item.duration;
      $("treatPrice").value = item.price;
      $("treatImage").value = item.image || "";
    }
    openModal("treatmentModal");
  }

  /* ------------------------------------------------------------------ */
  /* Slots                                                               */
  /* ------------------------------------------------------------------ */

  function renderSlots() {
    var dateInput = $("slotDate");
    if (!dateInput.value) dateInput.value = CosmicDB.todayIso();
    var date = dateInput.value;
    var slots = CosmicDB.getSlotsForDate(date, true);
    $("slotAdminGrid").innerHTML = slots
      .map(function (slot) {
        var booked = slot.status === "booked" || CosmicDB.isSlotTaken(date, slot.time);
        var statusLabel = booked ? "Booked" : slot.status === "unavailable" ? "Unavailable" : "Available";
        var cls = booked ? "booked" : slot.status === "unavailable" ? "unavailable" : "";
        return (
          '<div class="slot-admin-row ' +
          cls +
          '"><strong>' +
          escapeHtml(slot.time) +
          "</strong><span>" +
          statusLabel +
          '</span><div class="action-row">' +
          (booked
            ? ""
            : '<button class="mini-btn" data-toggle-slot="' +
              escapeHtml(slot.time) +
              '">' +
              (slot.status === "unavailable" ? "Mark available" : "Mark unavailable") +
              "</button>") +
          '<button class="mini-btn danger" data-remove-slot="' +
          escapeHtml(slot.time) +
          '">Remove</button>' +
          "</div></div>"
        );
      })
      .join("");
  }

  /* ------------------------------------------------------------------ */
  /* Settings                                                            */
  /* ------------------------------------------------------------------ */

  function refreshSmtpStatus() {
    var box = $("smtpStatus");
    if (!box || !window.CosmicMail) return;
    CosmicMail.getStatus().then(function (status) {
      if (status.configured) {
        box.textContent = "Connected" + (status.email ? " · " + status.email : "");
        if (status.email && $("setNotifyEmail") && !$("setNotifyEmail").value) {
          $("setNotifyEmail").value = status.email;
        }
        return;
      }
      box.textContent = "Not connected";
    });
  }

  function refreshDbStatus() {
    var box = $("dbStatus");
    if (!box || !CosmicDB.getServerStatus) return;
    CosmicDB.getServerStatus().then(function (status) {
      if (status.missing || !status.configured || status.connected === false) {
        box.textContent = "Not connected";
        return;
      }
      if (!status.keyReady || !(CosmicDB.getSettings().dashboardKey || "").trim()) {
        box.textContent = "Key required";
        return;
      }
      box.textContent = "Connected";
    });
  }

  function fillSettings() {
    var settings = CosmicDB.getSettings();
    $("setClinic").value = settings.clinicName;
    $("setDoctor").value = settings.doctorName;
    $("setPhone").value = settings.phone;
    $("setEmail").value = settings.email;
    $("setAddress").value = settings.address;
    $("setHours").value = settings.hoursWeekday;
    $("setSunday").value = settings.hoursSunday;
    $("setNotifyEmail").value = settings.adminNotifyEmail || "";
    $("setAppPassword").value = "";
    if ($("setDashboardKey")) $("setDashboardKey").value = settings.dashboardKey || "";
    refreshSmtpStatus();
    refreshDbStatus();
    renderBlockedList();
  }

  function renderBlockedList() {
    var box = $("blockedList");
    if (!box) return;
    var phones = CosmicDB.getSettings().blockedPhones || [];
    var counts = CosmicDB.getSettings().noShowCounts || {};
    if (!phones.length) {
      box.innerHTML = '<p class="muted">No numbers are blocked.</p>';
      return;
    }
    box.innerHTML = phones
      .map(function (phone) {
        var noshows = Number(counts[phone]) || 0;
        return (
          '<div class="slot-admin-row"><strong>' +
          escapeHtml(phone) +
          "</strong><span class='muted'>" +
          (noshows ? noshows + " no-show" + (noshows === 1 ? "" : "s") : "Blocked by staff") +
          '</span><button class="mini-btn" data-unblock="' +
          escapeHtml(phone) +
          '" type="button">Unblock</button></div>'
        );
      })
      .join("");
  }

  /* ------------------------------------------------------------------ */
  /* Modals                                                              */
  /* ------------------------------------------------------------------ */

  function openModal(id) {
    $(id).classList.add("open");
  }

  function closeModals() {
    var nodes = document.querySelectorAll(".modal-backdrop");
    Array.prototype.forEach.call(nodes, function (node) {
      node.classList.remove("open");
    });
  }

  function openAppointmentDetail(id) {
    var item = CosmicDB.getAppointmentById(id);
    if (!item) return;
    $("detailTitle").textContent = item.patientName;
    $("detailBody").innerHTML =
      '<div class="confirm-rows">' +
      row("Booking ID", item.id) +
      row("Treatment", item.treatmentName) +
      row("Date", prettyDate(item.date)) +
      row("Time", item.time) +
      row("Doctor", item.doctor) +
      row("Phone", item.phone) +
      row("Email", item.email) +
      row("Status", capitalize(item.status)) +
      row("Message", item.message || "—") +
      "</div>";
    openModal("detailModal");
  }

  function row(label, value) {
    return (
      "<div><span>" +
      escapeHtml(label) +
      "</span><strong>" +
      escapeHtml(value) +
      "</strong></div>"
    );
  }

  function openReschedule(id) {
    pendingRescheduleId = id;
    pendingRescheduleTime = "";
    var item = CosmicDB.getAppointmentById(id);
    $("rescheduleDate").value = item ? item.date : CosmicDB.todayIso();
    $("rescheduleDate").min = CosmicDB.todayIso();
    renderRescheduleSlots();
    openModal("rescheduleModal");
  }

  function renderRescheduleSlots() {
    var date = $("rescheduleDate").value;
    var slots = CosmicDB.getSlotsForDate(date);
    $("rescheduleSlots").innerHTML = slots
      .map(function (slot) {
        var taken = slot.status === "booked" || CosmicDB.isSlotTaken(date, slot.time, pendingRescheduleId);
        var unavailable = slot.status === "unavailable";
        var disabled = (taken || unavailable) && CosmicDB.normalizeTime(slot.time) !== CosmicDB.normalizeTime(pendingRescheduleTime);
        if (taken && !unavailable) disabled = true;
        var current = CosmicDB.getAppointmentById(pendingRescheduleId);
        if (current && current.date === date && CosmicDB.normalizeTime(current.time) === CosmicDB.normalizeTime(slot.time)) {
          disabled = false;
        }
        return (
          '<button class="slot-chip' +
          (pendingRescheduleTime === slot.time ? " selected" : "") +
          (taken ? " booked" : "") +
          '" type="button" data-reslot="' +
          escapeHtml(slot.time) +
          '"' +
          (disabled ? " disabled" : "") +
          ">" +
          escapeHtml(slot.time) +
          "</button>"
        );
      })
      .join("");
  }

  /* ------------------------------------------------------------------ */
  /* Bindings                                                            */
  /* ------------------------------------------------------------------ */

  function bind() {
    var session = CosmicAuth.getSession();
    if (session) {
      $("adminName").textContent = session.displayName;
      $("adminEmail").textContent = session.email;
    }

    Array.prototype.forEach.call(document.querySelectorAll(".side-link"), function (link) {
      link.addEventListener("click", function () {
        showView(link.getAttribute("data-view"));
      });
    });

    $("sidebarToggle").addEventListener("click", function () {
      document.body.classList.toggle("sidebar-open");
    });
    $("sidebarBackdrop").addEventListener("click", function () {
      document.body.classList.remove("sidebar-open");
    });
    $("logoutBtn").addEventListener("click", function () {
      CosmicAuth.logout();
      window.location.replace("admin-login.html");
    });

    $("apptSearch").addEventListener("input", renderAppointments);
    $("apptFilter").addEventListener("change", renderAppointments);
    $("patientSearch").addEventListener("input", renderPatients);
    $("slotDate").addEventListener("change", renderSlots);

    document.addEventListener("click", function (event) {
      var actionBtn = event.target.closest("[data-action]");
      if (actionBtn) {
        handleAction(actionBtn.getAttribute("data-action"), actionBtn.getAttribute("data-id"));
        return;
      }
      if (event.target.closest("[data-close-modal]")) {
        closeModals();
        return;
      }
      var openAppt = event.target.closest("[data-open-appt]");
      if (openAppt) {
        openAppointmentDetail(openAppt.getAttribute("data-open-appt"));
        return;
      }
      var patient = event.target.closest("[data-patient]");
      if (patient) {
        openPatient(patient.getAttribute("data-patient"));
        return;
      }
      var editTreat = event.target.closest("[data-edit-treat]");
      if (editTreat) {
        openTreatmentModal(editTreat.getAttribute("data-edit-treat"));
        return;
      }
      var delTreat = event.target.closest("[data-del-treat]");
      if (delTreat) {
        CosmicDB.deleteTreatment(delTreat.getAttribute("data-del-treat"));
        toast("Treatment deleted.");
        renderTreatments();
        return;
      }
      var enable = event.target.closest("[data-enable]");
      if (enable && event.target.matches("input")) {
        CosmicDB.setTreatmentEnabled(enable.getAttribute("data-enable"), enable.checked);
        toast(enable.checked ? "Treatment enabled." : "Treatment hidden from the website.");
        renderTreatments();
        return;
      }
      var removeSlot = event.target.closest("[data-remove-slot]");
      if (removeSlot) {
        CosmicDB.removeTimeSlot($("slotDate").value, removeSlot.getAttribute("data-remove-slot"));
        toast("Time slot removed.");
        renderSlots();
        return;
      }
      var toggleSlot = event.target.closest("[data-toggle-slot]");
      if (toggleSlot) {
        var time = toggleSlot.getAttribute("data-toggle-slot");
        var current = CosmicDB.findSlot($("slotDate").value, time);
        var result = CosmicDB.setSlotUnavailable(
          $("slotDate").value,
          time,
          !(current && current.status === "unavailable")
        );
        if (!result.ok) toast(result.error, "error");
        else toast("Slot updated.");
        renderSlots();
        return;
      }
      var reslot = event.target.closest("[data-reslot]");
      if (reslot && !reslot.disabled) {
        pendingRescheduleTime = reslot.getAttribute("data-reslot");
        renderRescheduleSlots();
      }
    });

    $("confirmDelete").addEventListener("click", function () {
      if (!pendingDeleteId) return;
      var id = pendingDeleteId;
      var result = CosmicDB.deleteAppointment(id);
      pendingDeleteId = null;
      closeModals();
      if (!result.ok) {
        toast(result.error || "Unable to delete appointment.", "error");
        return;
      }
      toast("Appointment deleted.");
      if (CosmicDB.deleteServerAppointment) {
        CosmicDB.deleteServerAppointment(id).then(function () {
          refreshCurrent();
        });
        return;
      }
      refreshCurrent();
    });

    $("rescheduleDate").addEventListener("change", renderRescheduleSlots);
    $("confirmReschedule").addEventListener("click", function () {
      if (!pendingRescheduleId || !pendingRescheduleTime) {
        toast("Please choose a new time.", "error");
        return;
      }
      var result = CosmicDB.rescheduleAppointment(
        pendingRescheduleId,
        $("rescheduleDate").value,
        pendingRescheduleTime
      );
      if (!result.ok) {
        toast(result.error || "Unable to reschedule.", "error");
        return;
      }
      closeModals();
      toast("Appointment rescheduled.");
      notifyPatient("rescheduled", result.appointment);
      afterLocalChange(result);
    });

    $("addTreatmentBtn").addEventListener("click", function () {
      openTreatmentModal();
    });

    $("treatmentForm").addEventListener("submit", function (event) {
      event.preventDefault();
      var payload = {
        name: $("treatName").value.trim(),
        description: $("treatDesc").value.trim(),
        duration: Number($("treatDuration").value) || 30,
        price: $("treatPrice").value.trim(),
        image: $("treatImage").value.trim() || "assets/images/treatments/default.jpg",
      };
      if (!payload.name) {
        toast("Treatment name is required.", "error");
        return;
      }
      var id = $("treatId").value;
      if (id) CosmicDB.updateTreatment(id, payload);
      else CosmicDB.createTreatment(payload);
      closeModals();
      toast(id ? "Treatment updated." : "Treatment added.");
      renderTreatments();
    });

    $("addSlotBtn").addEventListener("click", function () {
      var result = CosmicDB.addTimeSlot($("slotDate").value, $("newSlotTime").value);
      if (!result.ok) {
        toast(result.error, "error");
        return;
      }
      $("newSlotTime").value = "";
      toast("Time slot added.");
      renderSlots();
    });

    $("settingsForm").addEventListener("submit", function (event) {
      event.preventDefault();
      CosmicDB.updateSettings({
        clinicName: $("setClinic").value,
        doctorName: $("setDoctor").value,
        phone: $("setPhone").value,
        email: $("setEmail").value,
        address: $("setAddress").value,
        hoursWeekday: $("setHours").value,
        hoursSunday: $("setSunday").value,
      });
      toast("Settings saved.");
    });

    $("emailForm").addEventListener("submit", function (event) {
      event.preventDefault();
      var email = $("setNotifyEmail").value.trim();
      var password = $("setAppPassword").value.replace(/[\s\u00a0"']+/g, "");
      if (!email || email.indexOf("@") === -1) {
        toast("Enter the clinic Gmail address.", "error");
        return;
      }
      if (password && !/^[a-zA-Z0-9]{16}$/.test(password)) {
        toast("Enter a valid App Password.", "error");
        return;
      }
      if (!password && !((CosmicDB.getSettings().smtpAppPassword) || "")) {
        toast("Enter the App Password.", "error");
        return;
      }
      var saveBtn = $("saveSmtpBtn");
      if (saveBtn) saveBtn.disabled = true;
      CosmicMail.saveSmtpConfig(
        email,
        password ? password.replace(/\s+/g, "") : CosmicDB.getSettings().smtpAppPassword || ""
      )
        .then(function (saved) {
          if (saveBtn) saveBtn.disabled = false;
          $("setAppPassword").value = "";
          if (saved && saved.ok === false) {
            toast(saved.error || "Could not save Gmail SMTP on the server.", "error");
            refreshSmtpStatus();
            return;
          }
          toast("Gmail SMTP saved. New bookings will email the clinic.");
          refreshSmtpStatus();
        })
        .catch(function (err) {
          if (saveBtn) saveBtn.disabled = false;
          toast((err && err.message) || "Could not save Gmail SMTP on the server.", "error");
          refreshSmtpStatus();
        });
    });

    $("testEmailBtn").addEventListener("click", function () {
      var settings = CosmicDB.getSettings();
      $("testEmailBtn").disabled = true;
      CosmicMail.sendBookingEmail({
        id: "TEST-EMAIL",
        patientName: "Test Patient",
        phone: settings.phone || "072340 01111",
        email: $("setNotifyEmail").value.trim() || settings.adminNotifyEmail,
        treatmentName: "Email configuration test",
        date: CosmicDB.todayIso(),
        time: "10:30 AM",
        doctor: settings.doctorName,
        status: "pending",
        message: "This is a test from the Elegancia admin desk.",
      }).then(function (mail) {
        $("testEmailBtn").disabled = false;
        if (mail.ok) toast("Test email sent through Gmail SMTP.");
        else toast(mail.error || "Test email failed.", "error");
      });
    });

    $("passwordForm").addEventListener("submit", function (event) {
      event.preventDefault();
      var result = CosmicAuth.changePassword(
        $("currentPassword").value,
        $("newPassword").value,
        $("confirmPassword").value
      );
      if (!result.ok) {
        toast(result.error || "Unable to update password.", "error");
        return;
      }
      $("passwordForm").reset();
      toast("Password updated successfully.");
    });

    $("resetDemo").addEventListener("click", function () {
      CosmicDB.resetDemoData();
      toast("Demo data restored.");
      refreshCurrent();
    });

    $("blockPhoneBtn").addEventListener("click", function () {
      var result = CosmicDB.blockPhone($("blockPhoneInput").value);
      if (!result.ok) {
        toast(result.error || "Could not block that number.", "error");
        return;
      }
      $("blockPhoneInput").value = "";
      toast("Number blocked from online booking.");
      renderBlockedList();
    });
    $("blockedList").addEventListener("click", function (event) {
      var btn = event.target.closest("[data-unblock]");
      if (!btn) return;
      CosmicDB.unblockPhone(btn.getAttribute("data-unblock"));
      toast("Number can book online again.");
      renderBlockedList();
    });

    if ($("dbForm")) {
      $("dbForm").addEventListener("submit", function (event) {
        event.preventDefault();
        var key = ($("setDashboardKey").value || "").trim();
        CosmicDB.updateSettings({ dashboardKey: key });
        if (!key) {
          toast("Enter the dashboard key.", "error");
          refreshDbStatus();
          return;
        }
        CosmicDB.pullServerAppointments().then(function (pulled) {
          if (pulled && pulled.ok) toast("Clinic database connected. Bookings from other phones will appear here.");
          else syncNote(pulled, "Saved the key, but could not load bookings yet.");
          refreshDbStatus();
          refreshCurrent();
        });
      });
    }

    if ($("syncDbBtn")) {
      $("syncDbBtn").addEventListener("click", function () {
        loadRemoteBookings(true);
      });
    }

    CosmicCalendar.bind();
    showView("dashboard");
    loadRemoteBookings(false);
  }

  function syncNote(result, fallback) {
    if (!result || result.skipped || result.needsKey) return;
    if (result.ok === false && result.error) toast(result.error, "error");
    else if (result.ok === false) toast(fallback || "Clinic database update failed.", "error");
  }

  function loadRemoteBookings(manual) {
    if (!CosmicDB.pullServerAppointments) return;
    CosmicDB.pullServerAppointments().then(function (pulled) {
      if (pulled && pulled.ok) {
        if (manual) toast("Bookings refreshed from the clinic database.");
        refreshCurrent();
        return;
      }
      if (manual) syncNote(pulled, "Could not refresh bookings from the clinic database.");
    });
  }

  bind();
})();
