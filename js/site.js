/**
 * Elegancia Dental — shared multi-page chrome
 * Injects the header and footer on every public page.
 */
(function () {
  "use strict";

  function pageName() {
    var file = (window.location.pathname.split("/").pop() || "index.html").toLowerCase();
    if (!file || file === "/") return "index.html";
    if (file.indexOf(".html") === -1) file += ".html";
    return file;
  }

  function isActive(href, current) {
    if (href === current) return true;
    if (href === "index.html" && (current === "" || current === "/" || current === "index.html")) return true;
    return href.replace(".html", "") === current.replace(".html", "");
  }

  function renderHeader() {
    var header = document.getElementById("siteHeader");
    if (!header) return;
    var current = pageName();
    var links = [
      ["index.html", "Home"],
      ["about.html", "About"],
      ["treatments.html", "Treatments"],
      ["gallery.html", "Gallery"],
      ["reviews.html", "Reviews"],
      ["faq.html", "FAQ"],
      ["contact.html", "Contact"],
    ];
    var nav = links
      .map(function (item) {
        return (
          '<a class="nav-link' +
          (isActive(item[0], current) ? " active" : "") +
          '" href="' +
          item[0] +
          '">' +
          item[1] +
          "</a>"
        );
      })
      .join("");

    header.innerHTML =
      '<div class="header-inner">' +
      '<a class="brand" href="index.html" aria-label="Elegancia Dental">' +
      '<img class="brand-mark" src="assets/icons/logo.jpg" alt="Elegancia Dental Clinic" />' +
      '<span class="brand-text"><span class="brand-name">ELEGANCIA</span>' +
      '<span class="brand-sub">Dental Clinic</span></span></a>' +
      '<nav class="nav" id="siteNav" aria-label="Primary">' +
      nav +
      "</nav>" +
      '<div class="header-cta">' +
      '<a class="btn btn-primary" href="book.html">Book Appointment</a>' +
      '<button class="menu-toggle" id="menuToggle" type="button" aria-label="Open menu" aria-expanded="false">' +
      "<span></span><span></span><span></span></button></div></div>" +
      '<div class="nav-overlay" id="navOverlay" hidden></div>';
  }

  function renderFooter() {
    var footer = document.getElementById("siteFooter");
    if (!footer) return;
    var year = new Date().getFullYear();
    footer.innerHTML =
      '<div class="container footer-grid">' +
      "<div><a class=\"brand\" href=\"index.html\">" +
      '<img class="brand-mark" src="assets/icons/logo.jpg" alt="Elegancia Dental Clinic" />' +
      '<span class="brand-text"><span class="brand-name">ELEGANCIA</span>' +
      '<span class="brand-sub">Dental Clinic</span></span></a>' +
      "<p>Elegancia Dental, Implant &amp; Maxillofacial Centre — best dentist in Lucknow. Founded by Dr. Tasveer Fatima, MDS Oral &amp; Maxillofacial Surgeon.</p></div>" +
      "<div><h4>Visit</h4><ul>" +
      '<li><a href="about.html">About the clinic</a></li>' +
      '<li><a href="treatments.html">Treatments</a></li>' +
      '<li><a href="gallery.html">Smile gallery</a></li>' +
      '<li><a href="reviews.html">Patient reviews</a></li>' +
      "</ul></div>" +
      "<div><h4>Clinic</h4><ul>" +
      '<li><a href="book.html">Book appointment</a></li>' +
      '<li><a href="faq.html">FAQs</a></li>' +
      '<li><a href="contact.html">Emergency care</a></li>' +
      '<li><a href="admin-login.html">Staff login</a></li>' +
      "</ul></div>" +
      "<div><h4>Reach us</h4><ul>" +
      '<li><a href="tel:07234001111">072340 01111</a></li>' +
      '<li><a href="tel:8175053711">81750 53711</a></li>' +
      "<li>Picnic Spot Rd, opp. BPF, Khurram Nagar, Lucknow 226022</li>" +
      '<li><a href="https://maps.app.goo.gl/KaGd79G24jRSyYL19" target="_blank" rel="noopener">Open in Google Maps</a></li>' +
      "</ul></div></div>" +
      '<div class="container footer-bottom">' +
      "<span>© " +
      year +
      " Elegancia Dental, Implant &amp; Maxillofacial Centre. All rights reserved.</span>" +
      "<span>Women-owned · LGBTQ+ friendly · Khurram Nagar, Lucknow</span></div>";
  }

  function closeNav() {
    var toggle = document.getElementById("menuToggle");
    var overlay = document.getElementById("navOverlay");
    document.body.classList.remove("nav-open");
    if (toggle) toggle.setAttribute("aria-expanded", "false");
    if (overlay) overlay.hidden = true;
  }

  function bindNav() {
    var toggle = document.getElementById("menuToggle");
    var header = document.getElementById("siteHeader");
    var overlay = document.getElementById("navOverlay");
    var closers = document.querySelectorAll(".nav-link, .header-cta a, .sticky-book");
    Array.prototype.forEach.call(closers, function (link) {
      link.addEventListener("click", closeNav);
    });
    if (toggle) {
      toggle.addEventListener("click", function () {
        var open = document.body.classList.toggle("nav-open");
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
        if (overlay) overlay.hidden = !open;
      });
    }
    if (overlay) {
      overlay.addEventListener("click", closeNav);
    }
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeNav();
    });
    window.addEventListener("resize", function () {
      if (window.innerWidth > 1100) closeNav();
    });
    window.addEventListener("scroll", function () {
      if (!header) return;
      header.classList.toggle("scrolled", window.scrollY > 12);
    });
  }

  renderHeader();
  renderFooter();
  bindNav();
})();
