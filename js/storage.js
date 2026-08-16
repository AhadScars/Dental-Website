/**
 * COSMIC Dental Clinic — Storage Layer
 * --------------------------------------------------------------------------
 * Local cache for treatments, slots, and settings. Appointments also save
 * to Hostinger MySQL through appointments.php so every device sees them.
 */
(function (global) {
  "use strict";

  var KEYS = {
    APPOINTMENTS: "cosmicAppointments",
    TREATMENTS: "cosmicTreatments",
    SLOTS: "cosmicSlots",
    SETTINGS: "cosmicSettings",
    SEEDED: "cosmicSeeded",
  };

  var DEFAULT_TIMES = [
    "10:30 AM",
    "11:00 AM",
    "11:30 AM",
    "12:00 PM",
    "12:30 PM",
    "01:00 PM",
    "01:30 PM",
    "02:00 PM",
    "02:30 PM",
    "03:00 PM",
    "03:30 PM",
    "04:00 PM",
    "04:30 PM",
    "05:00 PM",
    "05:30 PM",
    "06:00 PM",
    "06:30 PM",
    "07:00 PM",
    "07:30 PM",
    "08:00 PM",
    "08:30 PM",
    "09:00 PM",
  ];

  var DEFAULT_SETTINGS = {
    version: 3,
    clinicName: "Elegancia Dental, Implant & Maxillofacial Centre",
    shortName: "Elegancia Dental",
    doctorName: "Dr. Tasveer Fatima",
    doctorTitle: "BDS, MDS — Oral & Maxillofacial Surgeon",
    tagline: "Best Dentist In Lucknow",
    taglineHi: "एलिगेंसिया डेंटल, इंप्लांट & मैक्सिलोफेशियल सेंटर - बेस्ट डेंटिस्ट इन लखनऊ",
    phone: "072340 01111",
    phoneAlt: "81750 53711",
    phoneThird: "78600 11222",
    email: "",
    address: "Ibrahim Masjid, Picnic Spot Rd, opp. BPF, Matinpurwa, Sector 8, Khurram Nagar, Lucknow, Uttar Pradesh 226022",
    plusCode: "VXR9+6Q Lucknow, Uttar Pradesh",
    mapsUrl: "https://maps.app.goo.gl/KaGd79G24jRSyYL19",
    hoursWeekday: "Monday – Saturday · 10:00 AM – 9:30 PM",
    hoursSunday: "Sunday · 10:30 AM – 4:00 PM",
    rating: "4.8",
    reviewCount: "237",
    defaultTimes: DEFAULT_TIMES.slice(),
    slotDuration: 30,
    adminNotifyEmail: "",
    smtpAppPassword: "",
    dashboardKey: "elg-7f3a9c2e4b81d06f5a12c8e9b4d7f0a3",
    blockedPhones: [],
    noShowCounts: {},
    emailProvider: "none",
    emailjsPublicKey: "",
    emailjsServiceId: "",
    emailjsTemplateId: "",
    appsScriptUrl: "",
  };

  var DEFAULT_TREATMENTS = [
    {
      id: "trt-checkup",
      name: "General Check-up",
      description: "A thorough oral examination, digital x-rays when needed, and a personalised care plan.",
      duration: 30,
      price: "₹800",
      enabled: true,
      icon: "scan",
      image: "assets/images/treatments/checkup.jpg",
    },
    {
      id: "trt-whitening",
      name: "Teeth Whitening",
      description: "In-clinic whitening that lifts stains safely and leaves a naturally brighter smile.",
      duration: 60,
      price: "₹8,500",
      enabled: true,
      icon: "sparkle",
      image: "assets/images/treatments/whitening.jpg",
    },
    {
      id: "trt-implants",
      name: "Dental Implants",
      description: "Titanium implants that restore missing teeth with lasting strength and a natural look.",
      duration: 90,
      price: "₹35,000",
      enabled: true,
      icon: "implant",
      image: "assets/images/treatments/implants.jpg",
    },
    {
      id: "trt-rootcanal",
      name: "Root Canal",
      description: "Gentle, microscope-assisted endodontics that save an infected tooth and ease pain.",
      duration: 75,
      price: "₹6,500",
      enabled: true,
      icon: "root",
      image: "assets/images/treatments/rootcanal.jpg",
    },
    {
      id: "trt-aligners",
      name: "Braces & Aligners",
      description: "Clear aligners and discreet braces planned digitally for a confident, even smile.",
      duration: 45,
      price: "₹45,000",
      enabled: true,
      icon: "align",
      image: "assets/images/treatments/aligners.jpg",
    },
    {
      id: "trt-pediatric",
      name: "Pediatric Dentistry",
      description: "Calm, child-first visits that build healthy habits and keep little smiles bright.",
      duration: 40,
      price: "₹1,200",
      enabled: true,
      icon: "child",
      image: "assets/images/treatments/pediatric.jpg",
    },
    {
      id: "trt-veneers",
      name: "Cosmetic Veneers",
      description: "Ultra-thin porcelain veneers designed to refine shape, colour, and symmetry.",
      duration: 90,
      price: "₹18,000",
      enabled: true,
      icon: "veneer",
      image: "assets/images/treatments/veneers.jpg",
    },
    {
      id: "trt-extraction",
      name: "Tooth Extraction",
      description: "Careful, minimally invasive extractions with clear aftercare and follow-up.",
      duration: 45,
      price: "₹2,500",
      enabled: true,
      icon: "extract",
      image: "assets/images/treatments/extraction.jpg",
    },
    {
      id: "trt-gum",
      name: "Gum Treatment",
      description: "Periodontal care that treats inflammation and protects the foundation of your smile.",
      duration: 50,
      price: "₹3,800",
      enabled: true,
      icon: "leaf",
      image: "assets/images/treatments/gum.jpg",
    },
    {
      id: "trt-emergency",
      name: "Emergency Care",
      description: "Same-day attention for toothache, trauma, swelling, or a broken restoration.",
      duration: 40,
      price: "₹1,500",
      enabled: true,
      icon: "alert",
      image: "assets/images/treatments/emergency.jpg",
    },
    {
      id: "trt-maxillo",
      name: "Oral & Maxillofacial Surgery",
      description: "Specialist surgery for jaw, face, cysts, trauma, and complex oral conditions by Dr. Tasveer Fatima.",
      duration: 90,
      price: "On consultation",
      enabled: true,
      icon: "implant",
      image: "assets/images/treatments/implants.jpg",
    },
    {
      id: "trt-wisdom",
      name: "Wisdom Tooth Surgery",
      description: "Comfortable surgical removal of impacted wisdom teeth with clear aftercare and follow-up.",
      duration: 60,
      price: "₹4,500",
      enabled: true,
      icon: "extract",
      image: "assets/images/treatments/extraction.jpg",
    },
  ];

  /* ------------------------------------------------------------------ */
  /* Low-level helpers                                                   */
  /* ------------------------------------------------------------------ */

  function read(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (raw === null || raw === undefined) return fallback;
      return JSON.parse(raw);
    } catch (err) {
      return fallback;
    }
  }

  function write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function uid(prefix) {
    var alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    var out = "";
    for (var i = 0; i < 6; i += 1) {
      out += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
    }
    return (prefix || "CDC") + "-" + out;
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function todayIso() {
    return formatDate(new Date());
  }

  function formatDate(date) {
    var d = date instanceof Date ? date : new Date(date);
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeTime(time) {
    return String(time || "").trim().replace(/\s+/g, " ").toUpperCase();
  }

  /* ------------------------------------------------------------------ */
  /* Settings                                                            */
  /* ------------------------------------------------------------------ */

  function getSettings() {
    var stored = read(KEYS.SETTINGS, null);
    if (!stored || !stored.version || stored.version < 3) {
      write(KEYS.SETTINGS, DEFAULT_SETTINGS);
      return clone(DEFAULT_SETTINGS);
    }
    var merged = Object.assign({}, DEFAULT_SETTINGS, stored);
    if (!String(merged.dashboardKey || "").trim()) {
      merged.dashboardKey = DEFAULT_SETTINGS.dashboardKey;
    }
    if (!merged.defaultTimes || !merged.defaultTimes.length) {
      merged.defaultTimes = DEFAULT_TIMES.slice();
    }
    if (!Array.isArray(merged.blockedPhones)) merged.blockedPhones = [];
    if (!merged.noShowCounts || typeof merged.noShowCounts !== "object") merged.noShowCounts = {};
    return merged;
  }

  function updateSettings(partial) {
    var next = Object.assign({}, getSettings(), partial || {});
    write(KEYS.SETTINGS, next);
    return clone(next);
  }

  /* ------------------------------------------------------------------ */
  /* Treatments                                                          */
  /* ------------------------------------------------------------------ */

  function defaultImageFor(id) {
    var match = DEFAULT_TREATMENTS.filter(function (item) {
      return item.id === id;
    })[0];
    return (match && match.image) || "assets/images/treatments/default.jpg";
  }

  function hydrateTreatmentImages(list) {
    var changed = false;
    var next = list.map(function (item) {
      if (item.image) return item;
      changed = true;
      return Object.assign({}, item, { image: defaultImageFor(item.id) });
    });
    if (changed) write(KEYS.TREATMENTS, next);
    return next;
  }

  function mergeMissingTreatments(list) {
    var have = {};
    list.forEach(function (item) {
      have[item.id] = true;
    });
    var added = false;
    DEFAULT_TREATMENTS.forEach(function (item) {
      if (!have[item.id]) {
        list.push(clone(item));
        added = true;
      }
    });
    if (added) write(KEYS.TREATMENTS, list);
    return list;
  }

  function getTreatments(includeDisabled) {
    var list = read(KEYS.TREATMENTS, null);
    if (!list || !list.length) {
      write(KEYS.TREATMENTS, DEFAULT_TREATMENTS);
      list = clone(DEFAULT_TREATMENTS);
    } else {
      list = hydrateTreatmentImages(list);
      list = mergeMissingTreatments(list);
    }
    if (includeDisabled) return list;
    return list.filter(function (t) {
      return t.enabled !== false;
    });
  }

  function getAllTreatments() {
    return getTreatments(true);
  }

  function getTreatmentById(id) {
    return (
      getAllTreatments().filter(function (t) {
        return t.id === id;
      })[0] || null
    );
  }

  function createTreatment(data) {
    var list = getAllTreatments();
    var item = {
      id: data.id || uid("TRT"),
      name: String(data.name || "").trim(),
      description: String(data.description || "").trim(),
      duration: Number(data.duration) || 30,
      price: String(data.price || "").trim() || "On request",
      enabled: data.enabled !== false,
      icon: data.icon || "sparkle",
      image: data.image || "assets/images/treatments/default.jpg",
    };
    list.push(item);
    write(KEYS.TREATMENTS, list);
    return clone(item);
  }

  function updateTreatment(id, partial) {
    var list = getAllTreatments();
    var found = null;
    list = list.map(function (item) {
      if (item.id !== id) return item;
      found = Object.assign({}, item, partial, { id: item.id });
      return found;
    });
    if (!found) return null;
    write(KEYS.TREATMENTS, list);
    return clone(found);
  }

  function deleteTreatment(id) {
    var list = getAllTreatments().filter(function (item) {
      return item.id !== id;
    });
    write(KEYS.TREATMENTS, list);
    return true;
  }

  function setTreatmentEnabled(id, enabled) {
    return updateTreatment(id, { enabled: !!enabled });
  }

  /* ------------------------------------------------------------------ */
  /* Time slots                                                          */
  /* ------------------------------------------------------------------ */

  function getSlotStore() {
    return read(KEYS.SLOTS, {}) || {};
  }

  function saveSlotStore(store) {
    write(KEYS.SLOTS, store);
  }

  function buildDefaultSlots(date) {
    var settings = getSettings();
    var times = settings.defaultTimes && settings.defaultTimes.length
      ? settings.defaultTimes
      : DEFAULT_TIMES;
    return times.map(function (time) {
      return {
        date: date,
        time: time,
        status: "available",
        appointmentId: null,
      };
    });
  }

  function getSlotsForDate(date, persistIfMissing) {
    var store = getSlotStore();
    if (store[date] && store[date].length) {
      return clone(store[date]);
    }
    var generated = buildDefaultSlots(date);
    if (persistIfMissing) {
      store[date] = generated;
      saveSlotStore(store);
    }
    return clone(generated);
  }

  function saveSlotsForDate(date, slots) {
    var store = getSlotStore();
    store[date] = slots.map(function (slot) {
      return {
        date: date,
        time: normalizeTime(slot.time),
        status: slot.status || "available",
        appointmentId: slot.appointmentId || null,
      };
    });
    saveSlotStore(store);
    return getSlotsForDate(date);
  }

  function findSlot(date, time) {
    var slots = getSlotsForDate(date);
    var wanted = normalizeTime(time);
    for (var i = 0; i < slots.length; i += 1) {
      if (normalizeTime(slots[i].time) === wanted) return slots[i];
    }
    return null;
  }

  function upsertSlot(date, time, updates) {
    var slots = getSlotsForDate(date, true);
    var wanted = normalizeTime(time);
    var found = false;
    slots = slots.map(function (slot) {
      if (normalizeTime(slot.time) !== wanted) return slot;
      found = true;
      return Object.assign({}, slot, updates, { date: date, time: wanted });
    });
    if (!found) {
      slots.push(
        Object.assign(
          { date: date, time: wanted, status: "available", appointmentId: null },
          updates
        )
      );
      slots.sort(function (a, b) {
        return timeToMinutes(a.time) - timeToMinutes(b.time);
      });
    }
    return saveSlotsForDate(date, slots);
  }

  function addTimeSlot(date, time) {
    var wanted = normalizeTime(time);
    if (!wanted) return { ok: false, error: "Please enter a valid time." };
    var existing = findSlot(date, wanted);
    if (existing) return { ok: false, error: "That time slot already exists." };
    upsertSlot(date, wanted, { status: "available", appointmentId: null });
    return { ok: true, slots: getSlotsForDate(date) };
  }

  function removeTimeSlot(date, time) {
    var slots = getSlotsForDate(date, true).filter(function (slot) {
      return normalizeTime(slot.time) !== normalizeTime(time);
    });
    saveSlotsForDate(date, slots);
    return { ok: true, slots: getSlotsForDate(date) };
  }

  function setSlotUnavailable(date, time, unavailable) {
    var slot = findSlot(date, time);
    if (slot && slot.status === "booked") {
      return { ok: false, error: "A booked slot cannot be marked unavailable." };
    }
    upsertSlot(date, time, {
      status: unavailable ? "unavailable" : "available",
      appointmentId: null,
    });
    return { ok: true, slots: getSlotsForDate(date) };
  }

  function markSlotBooked(date, time, appointmentId) {
    upsertSlot(date, time, { status: "booked", appointmentId: appointmentId || null });
  }

  function releaseSlot(date, time) {
    var slot = findSlot(date, time);
    if (!slot) return;
    upsertSlot(date, time, { status: "available", appointmentId: null });
  }

  function getAvailableSlots(date) {
    return getSlotsForDate(date).filter(function (slot) {
      return slot.status === "available" && !isSlotTaken(date, slot.time);
    });
  }

  function timeToMinutes(time) {
    var match = String(time)
      .trim()
      .match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return 0;
    var hours = parseInt(match[1], 10);
    var minutes = parseInt(match[2], 10);
    var mer = match[3].toUpperCase();
    if (mer === "PM" && hours !== 12) hours += 12;
    if (mer === "AM" && hours === 12) hours = 0;
    return hours * 60 + minutes;
  }

  function minutesToTime(total) {
    var hours = Math.floor(total / 60);
    var minutes = total % 60;
    var mer = hours >= 12 ? "PM" : "AM";
    var display = hours % 12;
    if (display === 0) display = 12;
    return String(display).padStart(2, "0") + ":" + String(minutes).padStart(2, "0") + " " + mer;
  }

  /* ------------------------------------------------------------------ */
  /* Appointments                                                        */
  /* ------------------------------------------------------------------ */

  function getAppointments() {
    var list = read(KEYS.APPOINTMENTS, []);
    return Array.isArray(list) ? list : [];
  }

  function saveAppointments(list) {
    write(KEYS.APPOINTMENTS, list);
  }

  function getAppointmentById(id) {
    return (
      getAppointments().filter(function (item) {
        return item.id === id;
      })[0] || null
    );
  }

  function generateBookingId() {
    var existing = {};
    getAppointments().forEach(function (item) {
      existing[item.id] = true;
    });
    var id = uid("CDC");
    var guard = 0;
    while (existing[id] && guard < 20) {
      id = uid("CDC");
      guard += 1;
    }
    return id;
  }

  function normalizePhone(phone) {
    var digits = String(phone || "").replace(/\D/g, "");
    if (digits.length > 10) digits = digits.slice(-10);
    return digits;
  }

  function isClosedStatus(status) {
    return status === "cancelled" || status === "rejected" || status === "noshow";
  }

  function isPhoneBlocked(phone) {
    var key = normalizePhone(phone);
    if (!key) return false;
    return getSettings().blockedPhones.indexOf(key) !== -1;
  }

  function blockPhone(phone) {
    var key = normalizePhone(phone);
    if (!key) return { ok: false, error: "Enter a valid phone number." };
    var settings = getSettings();
    var list = settings.blockedPhones.slice();
    if (list.indexOf(key) === -1) list.push(key);
    updateSettings({ blockedPhones: list });
    return { ok: true, phone: key };
  }

  function unblockPhone(phone) {
    var key = normalizePhone(phone);
    var settings = getSettings();
    updateSettings({
      blockedPhones: settings.blockedPhones.filter(function (item) {
        return item !== key;
      }),
    });
    return { ok: true, phone: key };
  }

  function markPhoneVerified(phone, email) {
    try {
      sessionStorage.setItem(
        "cosmicVerified",
        JSON.stringify({
          phone: normalizePhone(phone),
          email: normalizeEmail(email),
          until: Date.now() + 15 * 60 * 1000,
        })
      );
    } catch (err) {
      /* ignore */
    }
  }

  function isPhoneVerified(phone, email) {
    try {
      var raw = sessionStorage.getItem("cosmicVerified");
      if (!raw) return false;
      var data = JSON.parse(raw);
      if (!data || Date.now() > Number(data.until || 0)) return false;
      return data.phone === normalizePhone(phone) && data.email === normalizeEmail(email);
    } catch (err) {
      return false;
    }
  }

  function bookingGuard(phone) {
    var key = normalizePhone(phone);
    if (!key) return { ok: false, error: "Enter a valid 10-digit phone number." };
    if (isPhoneBlocked(key)) {
      return {
        ok: false,
        error: "This number cannot book online. Please call the clinic.",
      };
    }
    var open = getAppointments().filter(function (item) {
      return normalizePhone(item.phone) === key && (item.status === "pending" || item.status === "confirmed");
    });
    var pending = open.filter(function (item) {
      return item.status === "pending";
    });
    if (pending.length >= 1) {
      return {
        ok: false,
        error: "This number already has a pending request. Wait for the clinic to confirm or call 072340 01111.",
      };
    }
    if (open.length >= 2) {
      return {
        ok: false,
        error: "This number already has two open appointments. Please attend or cancel one first.",
      };
    }
    return { ok: true };
  }

  function isSlotTaken(date, time, ignoreId) {
    var wanted = normalizeTime(time);
    return getAppointments().some(function (item) {
      if (ignoreId && item.id === ignoreId) return false;
      if (item.date !== date) return false;
      if (normalizeTime(item.time) !== wanted) return false;
      return !isClosedStatus(item.status);
    });
  }

  function createAppointment(payload) {
    var settings = getSettings();
    var treatment = payload.treatmentId ? getTreatmentById(payload.treatmentId) : null;
    var appointment = {
      id: payload.id || generateBookingId(),
      patientName: String(payload.patientName || "").trim(),
      phone: String(payload.phone || "").trim(),
      email: String(payload.email || "").trim(),
      message: String(payload.message || "").trim(),
      treatmentId: payload.treatmentId || (treatment && treatment.id) || "",
      treatmentName:
        payload.treatmentName || (treatment && treatment.name) || "Consultation",
      date: payload.date,
      time: normalizeTime(payload.time),
      doctor: payload.doctor || settings.doctorName,
      status: payload.status || "pending",
      createdAt: payload.createdAt || nowIso(),
      updatedAt: nowIso(),
    };

    if (!appointment.patientName) return { ok: false, error: "Patient name is required." };
    if (!appointment.phone) return { ok: false, error: "Phone number is required." };
    if (!appointment.email) return { ok: false, error: "Email is required." };
    if (!appointment.date) return { ok: false, error: "Please select a date." };
    if (!appointment.time) return { ok: false, error: "Please select a time slot." };

    if (!payload.internal) {
      if (!isPhoneVerified(appointment.phone, appointment.email)) {
        return { ok: false, error: "Please verify the code sent to your email first." };
      }
      var guard = bookingGuard(appointment.phone);
      if (!guard.ok) return guard;
    }

    if (isSlotTaken(appointment.date, appointment.time)) {
      return {
        ok: false,
        error: "That date and time is already booked. Please choose another slot.",
      };
    }

    var slot = findSlot(appointment.date, appointment.time);
    if (slot && slot.status === "unavailable") {
      return { ok: false, error: "That time slot is unavailable." };
    }

    var list = getAppointments();
    list.push(appointment);
    saveAppointments(list);
    if (!isClosedStatus(appointment.status)) {
      markSlotBooked(appointment.date, appointment.time, appointment.id);
    }
    return { ok: true, appointment: clone(appointment) };
  }

  function updateAppointment(id, partial) {
    var list = getAppointments();
    var updated = null;
    list = list.map(function (item) {
      if (item.id !== id) return item;
      updated = Object.assign({}, item, partial, { id: item.id, updatedAt: nowIso() });
      return updated;
    });
    if (!updated) return { ok: false, error: "Appointment not found." };
    saveAppointments(list);
    return { ok: true, appointment: clone(updated) };
  }

  function changeAppointmentStatus(id, status) {
    var current = getAppointmentById(id);
    if (!current) return { ok: false, error: "Appointment not found." };

    var result = updateAppointment(id, { status: status });
    if (!result.ok) return result;

    if (isClosedStatus(status)) {
      releaseSlot(current.date, current.time);
    } else if (isClosedStatus(current.status) && !isClosedStatus(status)) {
      if (isSlotTaken(current.date, current.time, id)) {
        updateAppointment(id, { status: current.status });
        return { ok: false, error: "That slot is no longer available." };
      }
      markSlotBooked(current.date, current.time, id);
    }
    return { ok: true, appointment: getAppointmentById(id) };
  }

  function rescheduleAppointment(id, date, time) {
    var current = getAppointmentById(id);
    if (!current) return { ok: false, error: "Appointment not found." };

    var nextDate = date;
    var nextTime = normalizeTime(time);
    if (!nextDate || !nextTime) {
      return { ok: false, error: "Please choose a new date and time." };
    }
    if (isSlotTaken(nextDate, nextTime, id)) {
      return { ok: false, error: "That date and time is already booked." };
    }
    var slot = findSlot(nextDate, nextTime);
    if (slot && slot.status === "unavailable") {
      return { ok: false, error: "That time slot is unavailable." };
    }

    releaseSlot(current.date, current.time);
    var result = updateAppointment(id, {
      date: nextDate,
      time: nextTime,
      status: isClosedStatus(current.status) ? "pending" : current.status,
    });
    if (!result.ok) return result;
    markSlotBooked(nextDate, nextTime, id);
    return { ok: true, appointment: getAppointmentById(id) };
  }

  function deleteAppointment(id) {
    var current = getAppointmentById(id);
    if (!current) return { ok: false, error: "Appointment not found." };
    if (!isClosedStatus(current.status)) {
      releaseSlot(current.date, current.time);
    }
    saveAppointments(
      getAppointments().filter(function (item) {
        return item.id !== id;
      })
    );
    return { ok: true };
  }

  function markNoShow(id) {
    var current = getAppointmentById(id);
    if (!current) return { ok: false, error: "Appointment not found." };
    var result = changeAppointmentStatus(id, "noshow");
    if (!result.ok) return result;
    var key = normalizePhone(current.phone);
    var counts = Object.assign({}, getSettings().noShowCounts);
    counts[key] = (Number(counts[key]) || 0) + 1;
    updateSettings({ noShowCounts: counts });
    if (counts[key] >= 2) blockPhone(key);
    return {
      ok: true,
      appointment: getAppointmentById(id),
      noShows: counts[key],
      blocked: counts[key] >= 2,
    };
  }

  /* ------------------------------------------------------------------ */
  /* Patients (derived from appointments)                                */
  /* ------------------------------------------------------------------ */

  function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
  }

  function getPatients() {
    var map = {};
    getAppointments().forEach(function (item) {
      var key = normalizeEmail(item.email) || item.phone || item.patientName;
      if (!key) return;
      if (!map[key]) {
        map[key] = {
          id: key,
          name: item.patientName,
          phone: item.phone,
          email: item.email,
          appointments: [],
        };
      }
      map[key].appointments.push(item);
      if (item.createdAt > (map[key].latestCreated || "")) {
        map[key].name = item.patientName;
        map[key].phone = item.phone;
        map[key].email = item.email;
        map[key].latestCreated = item.createdAt;
      }
    });

    return Object.keys(map)
      .map(function (key) {
        var patient = map[key];
        var sorted = patient.appointments.slice().sort(function (a, b) {
          return (b.date + b.time).localeCompare(a.date + a.time);
        });
        var last = sorted[0];
        var hasUpcoming = sorted.some(function (item) {
          return item.status === "pending" || item.status === "confirmed";
        });
        return {
          id: patient.id,
          name: patient.name,
          phone: patient.phone,
          email: patient.email,
          totalAppointments: sorted.length,
          lastAppointment: last ? last.date : "",
          lastTreatment: last ? last.treatmentName : "",
          status: hasUpcoming ? "Active" : "Past",
          appointments: sorted,
        };
      })
      .sort(function (a, b) {
        return (b.lastAppointment || "").localeCompare(a.lastAppointment || "");
      });
  }

  function getPatientById(id) {
    return (
      getPatients().filter(function (item) {
        return item.id === id;
      })[0] || null
    );
  }

  /* ------------------------------------------------------------------ */
  /* Dashboard stats                                                     */
  /* ------------------------------------------------------------------ */

  function getStats(referenceDate) {
    var day = referenceDate || todayIso();
    var appointments = getAppointments();
    var patients = getPatients();
    function count(status) {
      return appointments.filter(function (item) {
        return item.status === status;
      }).length;
    }
    return {
      today: appointments.filter(function (item) {
        return item.date === day && item.status !== "cancelled" && item.status !== "rejected" && item.status !== "noshow";
      }).length,
      pending: count("pending"),
      confirmed: count("confirmed"),
      completed: count("completed"),
      cancelled: count("cancelled") + count("rejected"),
      patients: patients.length,
      total: appointments.length,
    };
  }

  /* ------------------------------------------------------------------ */
  /* Demo seed                                                           */
  /* ------------------------------------------------------------------ */

  function addDays(base, amount) {
    var d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
    d.setDate(d.getDate() + amount);
    return formatDate(d);
  }

  function seedIfNeeded() {
    if (read(KEYS.SEEDED, false)) {
      getSettings();
      getAllTreatments();
      return;
    }

    getSettings();
    getAllTreatments();

    var today = new Date();
    var samples = [
      {
        patientName: "Aanya Mehta",
        phone: "+91 98200 11420",
        email: "aanya.mehta@email.com",
        treatmentId: "trt-whitening",
        date: addDays(today, 0),
        time: "10:00 AM",
        status: "confirmed",
        message: "Prefer a morning slot if possible.",
      },
      {
        patientName: "Rohan Kapoor",
        phone: "+91 98712 44011",
        email: "rohan.kapoor@email.com",
        treatmentId: "trt-checkup",
        date: addDays(today, 0),
        time: "02:30 PM",
        status: "pending",
        message: "",
      },
      {
        patientName: "Sara Fernandes",
        phone: "+91 97654 22190",
        email: "sara.f@email.com",
        treatmentId: "trt-aligners",
        date: addDays(today, 1),
        time: "11:00 AM",
        status: "confirmed",
        message: "Second review for aligners.",
      },
      {
        patientName: "Vikram Shah",
        phone: "+91 99301 88765",
        email: "vikram.shah@email.com",
        treatmentId: "trt-implants",
        date: addDays(today, 2),
        time: "03:00 PM",
        status: "pending",
        message: "Consultation for a missing molar.",
      },
      {
        patientName: "Neha Joshi",
        phone: "+91 98111 33440",
        email: "neha.joshi@email.com",
        treatmentId: "trt-veneers",
        date: addDays(today, -3),
        time: "04:00 PM",
        status: "completed",
        message: "",
      },
      {
        patientName: "Kabir Ali",
        phone: "+91 90040 55661",
        email: "kabir.ali@email.com",
        treatmentId: "trt-emergency",
        date: addDays(today, -1),
        time: "09:30 AM",
        status: "cancelled",
        message: "Pain has subsided.",
      },
      {
        patientName: "Aanya Mehta",
        phone: "+91 98200 11420",
        email: "aanya.mehta@email.com",
        treatmentId: "trt-checkup",
        date: addDays(today, -20),
        time: "11:30 AM",
        status: "completed",
        message: "",
      },
    ];

    samples.forEach(function (sample) {
      sample.internal = true;
      createAppointment(sample);
    });

    write(KEYS.SEEDED, true);
  }

  function resetDemoData() {
    var key = String((getSettings().dashboardKey || "")).trim();
    localStorage.removeItem(KEYS.APPOINTMENTS);
    localStorage.removeItem(KEYS.TREATMENTS);
    localStorage.removeItem(KEYS.SLOTS);
    localStorage.removeItem(KEYS.SETTINGS);
    localStorage.removeItem(KEYS.SEEDED);
    seedIfNeeded();
    if (key) updateSettings({ dashboardKey: key });
  }

  /* ------------------------------------------------------------------ */
  /* Hostinger MySQL                                                     */
  /* ------------------------------------------------------------------ */

  var APPOINTMENTS_URL = "/appointments.php";

  function getDashboardKey() {
    return String((getSettings().dashboardKey || DEFAULT_SETTINGS.dashboardKey || "")).trim();
  }

  function appointmentTimestamp(item) {
    var value = item && item.updatedAt ? Date.parse(item.updatedAt) : 0;
    return isNaN(value) ? 0 : value;
  }

  function pickNewerAppointment(local, remote) {
    if (!local) return Object.assign({ fromServer: true }, remote);
    if (!remote) return local;
    var newer = appointmentTimestamp(remote) >= appointmentTimestamp(local) ? remote : local;
    return Object.assign({}, local, remote, newer, { fromServer: true, id: local.id || remote.id });
  }

  function mergeRemoteAppointments(remote) {
    var remoteList = Array.isArray(remote) ? remote : [];
    var remoteById = {};
    remoteList.forEach(function (item) {
      if (item && item.id) remoteById[item.id] = item;
    });

    var next = [];
    var seen = {};
    getAppointments().forEach(function (item) {
      if (!item || !item.id) return;
      if (remoteById[item.id]) {
        next.push(pickNewerAppointment(item, remoteById[item.id]));
        seen[item.id] = true;
        return;
      }
      if (item.internal || !item.fromServer) next.push(item);
    });
    remoteList.forEach(function (item) {
      if (item && item.id && !seen[item.id]) {
        next.push(Object.assign({ fromServer: true }, item));
      }
    });

    saveAppointments(next);
    next.forEach(function (item) {
      if (isClosedStatus(item.status)) {
        if (!isSlotTaken(item.date, item.time, item.id)) releaseSlot(item.date, item.time);
      } else {
        markSlotBooked(item.date, item.time, item.id);
      }
    });
    return next;
  }

  function applyTakenSlots(date, times) {
    (times || []).forEach(function (entry) {
      var time = typeof entry === "string" ? entry : entry && entry.time;
      if (!time) return;
      markSlotBooked(date, time, entry && entry.id ? entry.id : null);
    });
  }

  function postAppointments(payload) {
    return fetch(APPOINTMENTS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload || {}),
    }).then(function (res) {
      return res.text().then(function (text) {
        var data = null;
        try {
          data = text ? JSON.parse(text) : null;
        } catch (err) {
          data = null;
        }
        if (res.status === 404) {
          var missing = new Error("NOT_FOUND");
          missing.status = 404;
          throw missing;
        }
        if (!res.ok) {
          var fail = new Error((data && data.error) || "Appointments API failed (HTTP " + res.status + ").");
          fail.status = res.status;
          fail.payload = data;
          throw fail;
        }
        return data || { ok: false };
      });
    });
  }

  function getServerStatus() {
    return fetch(APPOINTMENTS_URL, { method: "GET", cache: "no-store" })
      .then(function (res) {
        if (res.status === 404) return { ok: false, configured: false, missing: true };
        return res.json().catch(function () {
          return { ok: false, configured: false };
        });
      })
      .catch(function () {
        return { ok: false, configured: false };
      });
  }

  function pullTakenSlots(date) {
    if (!date) return Promise.resolve({ ok: false, skipped: true });
    return postAppointments({ route: "taken", date: date })
      .then(function (data) {
        if (data && data.ok) applyTakenSlots(date, data.times || []);
        return data || { ok: false };
      })
      .catch(function (err) {
        if (err && err.message === "NOT_FOUND") return { ok: false, skipped: true };
        return { ok: false, error: (err && err.message) || "Could not load booked slots." };
      });
  }

  function checkServerGuard(phone) {
    return postAppointments({ route: "guard", phone: phone })
      .then(function (data) {
        return data || { ok: true };
      })
      .catch(function (err) {
        if (err && (err.message === "NOT_FOUND" || (err.payload && err.payload.configured === false))) {
          return { ok: true, skipped: true };
        }
        return { ok: false, error: (err && err.message) || "Could not check this number." };
      });
  }

  function pushServerAppointment(appointment) {
    if (!appointment || appointment.internal) return Promise.resolve({ ok: true, skipped: true });
    return postAppointments({ route: "create", appointment: appointment })
      .then(function (data) {
        if (data && data.ok && data.appointment) {
          var current = getAppointmentById(appointment.id) || appointment;
          updateAppointment(appointment.id, Object.assign({}, data.appointment, { fromServer: true }));
          return { ok: true, appointment: getAppointmentById(appointment.id) || current };
        }
        return data || { ok: false, error: "Could not save the booking on the server." };
      })
      .catch(function (err) {
        if (err && err.message === "NOT_FOUND") return { ok: false, skipped: true };
        if (err && err.payload && err.payload.configured === false) return { ok: false, skipped: true };
        return { ok: false, error: (err && err.message) || "Could not save the booking on the server." };
      });
  }

  function pullServerAppointments() {
    var key = getDashboardKey();
    if (!key) return Promise.resolve({ ok: false, skipped: true });
    return postAppointments({ route: "list", dashboardKey: key })
      .then(function (data) {
        if (data && data.ok && Array.isArray(data.appointments)) {
          mergeRemoteAppointments(data.appointments);
          return { ok: true, appointments: data.appointments };
        }
        return data || { ok: false };
      })
      .catch(function (err) {
        if (err && err.message === "NOT_FOUND") return { ok: false, skipped: true };
        return { ok: false, error: (err && err.message) || "Could not load clinic bookings." };
      });
  }

  function syncServerAppointment(appointment) {
    var key = getDashboardKey();
    if (!key || !appointment || appointment.internal) return Promise.resolve({ ok: true, skipped: true });
    return postAppointments({ route: "update", dashboardKey: key, appointment: appointment })
      .then(function (data) {
        if (data && data.ok && data.appointment) {
          updateAppointment(appointment.id, Object.assign({}, data.appointment, { fromServer: true }));
        }
        return data || { ok: false };
      })
      .catch(function (err) {
        if (err && err.message === "NOT_FOUND") return { ok: false, skipped: true };
        return { ok: false, error: (err && err.message) || "Could not update the booking." };
      });
  }

  function deleteServerAppointment(id) {
    var key = getDashboardKey();
    if (!key || !id) return Promise.resolve({ ok: true, skipped: true });
    return postAppointments({ route: "delete", dashboardKey: key, id: id })
      .then(function (data) {
        return data || { ok: false };
      })
      .catch(function (err) {
        if (err && err.message === "NOT_FOUND") return { ok: false, skipped: true };
        return { ok: false, error: (err && err.message) || "Could not delete the booking." };
      });
  }

  seedIfNeeded();

  global.CosmicDB = {
    KEYS: KEYS,
    DEFAULT_TIMES: DEFAULT_TIMES,
    getSettings: getSettings,
    updateSettings: updateSettings,
    getTreatments: getTreatments,
    getAllTreatments: getAllTreatments,
    getTreatmentById: getTreatmentById,
    createTreatment: createTreatment,
    updateTreatment: updateTreatment,
    deleteTreatment: deleteTreatment,
    setTreatmentEnabled: setTreatmentEnabled,
    getSlotsForDate: getSlotsForDate,
    getAvailableSlots: getAvailableSlots,
    addTimeSlot: addTimeSlot,
    removeTimeSlot: removeTimeSlot,
    setSlotUnavailable: setSlotUnavailable,
    markSlotBooked: markSlotBooked,
    releaseSlot: releaseSlot,
    findSlot: findSlot,
    getAppointments: getAppointments,
    getAppointmentById: getAppointmentById,
    createAppointment: createAppointment,
    updateAppointment: updateAppointment,
    deleteAppointment: deleteAppointment,
    changeAppointmentStatus: changeAppointmentStatus,
    rescheduleAppointment: rescheduleAppointment,
    generateBookingId: generateBookingId,
    isSlotTaken: isSlotTaken,
    getPatients: getPatients,
    getPatientById: getPatientById,
    getStats: getStats,
    formatDate: formatDate,
    todayIso: todayIso,
    timeToMinutes: timeToMinutes,
    minutesToTime: minutesToTime,
    normalizeTime: normalizeTime,
    resetDemoData: resetDemoData,
    normalizePhone: normalizePhone,
    isPhoneBlocked: isPhoneBlocked,
    blockPhone: blockPhone,
    unblockPhone: unblockPhone,
    bookingGuard: bookingGuard,
    markPhoneVerified: markPhoneVerified,
    isPhoneVerified: isPhoneVerified,
    markNoShow: markNoShow,
    getServerStatus: getServerStatus,
    pullTakenSlots: pullTakenSlots,
    checkServerGuard: checkServerGuard,
    pushServerAppointment: pushServerAppointment,
    pullServerAppointments: pullServerAppointments,
    syncServerAppointment: syncServerAppointment,
    deleteServerAppointment: deleteServerAppointment,
  };
})(window);
