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
      '<div class="topbar"><div class="topbar-inner">' +
      '<a href="tel:07234001111">072340 01111</a>' +
      "<span>Mon–Sat 10:00 AM – 9:30 PM · Sun 10:30 AM – 4:00 PM</span>" +
      '<a href="https://maps.app.goo.gl/KaGd79G24jRSyYL19" target="_blank" rel="noopener">Khurram Nagar, Lucknow</a>' +
      "</div></div>" +
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
      "<p>Specialist implant and maxillofacial care with calm family dentistry in Khurram Nagar. Founded by Dr. Tasveer Fatima, BDS MDS.</p>" +
      '<div class="footer-contact-row">' +
      '<a href="tel:07234001111">Call clinic</a>' +
      '<a href="https://wa.me/917234001111" target="_blank" rel="noopener">WhatsApp</a>' +
      '<a href="book.html">Book online</a>' +
      "</div></div>" +
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
    var closers = document.querySelectorAll(".nav-link, .header-cta a");
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

  function renderStickyActions() {
    if (document.querySelector(".sticky-actions")) return;
    var message = encodeURIComponent(
      "Hello Elegancia Dental, I would like to book an appointment."
    );
    var bar = document.createElement("div");
    bar.className = "sticky-actions";
    bar.setAttribute("role", "navigation");
    bar.setAttribute("aria-label", "Book by WhatsApp or phone");
    bar.innerHTML =
      '<a class="sticky-action sticky-whatsapp" href="https://wa.me/917234001111?text=' +
      message +
      '" target="_blank" rel="noopener" aria-label="Book on WhatsApp">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M20 11.5A8.5 8.5 0 0 1 7.4 18.7L4 20l1.4-3.3A8.5 8.5 0 1 1 20 11.5zm-8.5 7a7 7 0 1 0-5.9-3.3l.2.3-.8 1.9 2-.8.3.2a7 7 0 0 0 4.2 1.4zm4-5.2c-.2-.1-1.2-.6-1.4-.7-.2-.1-.3-.1-.5.1l-.4.5c-.1.1-.3.2-.5.1s-1-.4-1.9-1.2-.8-1.5-.9-1.7.0-.4.1-.5l.3-.4c.1-.1.1-.2.2-.4s0-.3 0-.4l-.7-1.6c-.2-.4-.4-.4-.5-.4h-.4c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 1.9s.8 2.2.9 2.3c.1.2 1.6 2.5 3.9 3.5 1.4.6 1.9.6 2.6.5.4-.1 1.2-.5 1.4-1 .2-.5.2-.9.1-1 0-.1-.2-.1-.4-.2z"/></svg>' +
      "<span>WhatsApp</span></a>" +
      '<a class="sticky-action sticky-call" href="tel:07234001111" aria-label="Call to book an appointment">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7.5 3.8c.3-.3.8-.4 1.2-.2l2.1 1c.4.2.7.6.7 1.1l-.2 2.1c0 .3-.2.6-.5.8l-1 .7c.8 1.6 2.1 2.9 3.7 3.7l.7-1c.2-.3.5-.5.8-.5l2.1-.2c.5 0 .9.3 1.1.7l1 2.1c.2.4.1.9-.2 1.2l-1.2 1.2c-.4.4-1 .6-1.6.5C10.4 16.8 7.2 13.6 6.8 8.6c-.1-.6.1-1.2.5-1.6L7.5 3.8z"/></svg>' +
      "<span>Call</span></a>";
    document.body.appendChild(bar);
  }

  renderHeader();
  renderFooter();
  renderStickyActions();
  bindNav();
})();
