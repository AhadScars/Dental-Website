/**
 * Elegancia Dental — public page helpers
 * Treatments, FAQs, and clinic details on multi-page site.
 */
(function () {
  "use strict";

  var ICONS = {
    scan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 8V5h3M16 4h4v4M20 16v4h-4M8 20H4v-4"/><circle cx="12" cy="12" r="3.2"/></svg>',
    sparkle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 3l1.4 5.2L18 10l-4.6 1.8L12 17l-1.4-5.2L6 10l4.6-1.8L12 3z"/><path d="M19 15l.6 2 2 .6-2 .6-.6 2-.6-2-2-.6 2-.6.6-2z"/></svg>',
    implant: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 3c3 3.4 4.8 6.4 4.8 9.4a4.8 4.8 0 1 1-9.6 0C7.2 9.4 9 6.4 12 3z"/></svg>',
    root: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 4c3 0 5 2 5 5 0 5-5 11-5 11S7 14 7 9c0-3 2-5 5-5z"/></svg>',
    align: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M8 5v14M16 5v14M5 9h3M16 9h3M5 15h3M16 15h3"/></svg>',
    child: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="8" r="3"/><path d="M6 19c.8-3.2 3-5 6-5s5.2 1.8 6 5"/></svg>',
    veneer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M8 5h8c1 3 1 6-1 11-1.2 3-3.2 4-3 4s-1.8-1-3-4C7 11 7 8 8 5z"/></svg>',
    extract: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M8 4h8l-1 6H9L8 4zM10 10l-1.5 10M14 10l1.5 10"/></svg>',
    leaf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M5 19c8-1 13-7 14-14-7 1-13 6-14 14z"/><path d="M9 15c2-2 4.5-3.5 8-4"/></svg>',
    alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 4l9 16H3L12 4z"/><path d="M12 10v4M12 17h.01"/></svg>',
  };

  function $(selector, root) {
    return (root || document).querySelector(selector);
  }

  function $$(selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  }

  function showToast(message, type) {
    var stack = $("#toastStack");
    if (!stack) return;
    var toast = document.createElement("div");
    toast.className = "toast " + (type || "success");
    toast.textContent = message;
    stack.appendChild(toast);
    setTimeout(function () {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 3200);
  }

  function renderTreatments() {
    var grid = $("#treatmentGrid");
    if (!grid || !window.CosmicDB) return;
    var treatments = CosmicDB.getTreatments();
    var limit = Number(grid.getAttribute("data-limit")) || 0;
    if (limit > 0) treatments = treatments.slice(0, limit);
    if (!treatments.length) {
      grid.innerHTML = '<div class="empty-state"><strong>Treatments coming soon</strong><span>Please check back shortly.</span></div>';
      return;
    }
    grid.innerHTML = treatments
      .map(function (item, index) {
        var image = item.image || "assets/images/treatments/default.jpg";
        return (
          '<article class="treatment-card tone-' +
          (index % 6) +
          '">' +
          '<div class="treatment-photo"><img src="' +
          escapeHtml(image) +
          '" alt="' +
          escapeHtml(item.name) +
          '" /></div>' +
          '<div class="treatment-body">' +
          '<div class="treatment-icon">' + (ICONS[item.icon] || ICONS.sparkle) + "</div>" +
          "<h3>" + escapeHtml(item.name) + "</h3>" +
          "<p>" + escapeHtml(item.description) + "</p>" +
          '<div class="treatment-meta">' +
          "<span>" + escapeHtml(String(item.duration)) + " min</span>" +
          "<strong>" + escapeHtml(item.price || "On request") + "</strong>" +
          "</div>" +
          '<div class="treatment-cta"><a class="btn btn-outline" href="book.html?treatment=' +
          escapeHtml(item.id) +
          '">Book this</a></div>' +
          "</div></article>"
        );
      })
      .join("");
  }

  function hydrateClinicDetails() {
    if (!window.CosmicDB) return;
    var settings = CosmicDB.getSettings();
    var address = $("#contactAddress");
    var phone = $("#contactPhone");
    var email = $("#contactEmail");
    var hours = $("#contactHours");
    if (address) address.textContent = settings.address;
    if (phone) {
      phone.textContent = settings.phone;
      phone.href = "tel:" + settings.phone.replace(/\s+/g, "");
    }
    if (email) {
      email.textContent = settings.email;
      email.href = "mailto:" + settings.email;
    }
    if (hours) hours.textContent = settings.hoursWeekday;
  }

  function bindFaqs() {
    $$("#faqList .faq-item button").forEach(function (button) {
      button.addEventListener("click", function () {
        var item = button.parentElement;
        var willOpen = !item.classList.contains("open");
        $$("#faqList .faq-item").forEach(function (node) {
          node.classList.remove("open");
          var mark = node.querySelector("button span");
          if (mark) mark.textContent = "+";
        });
        if (willOpen) {
          item.classList.add("open");
          var span = button.querySelector("span");
          if (span) span.textContent = "−";
        }
      });
    });
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  var year = $("#year");
  if (year) year.textContent = String(new Date().getFullYear());

  bindFaqs();
  renderTreatments();
  hydrateClinicDetails();

  window.CosmicUI = {
    showToast: showToast,
    escapeHtml: escapeHtml,
    icons: ICONS,
    renderTreatments: renderTreatments,
  };
})();
