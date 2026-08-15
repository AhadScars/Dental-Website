/**
 * COSMIC Dental Clinic — Admin calendar
 * Month, week, and day views driven by CosmicDB appointments.
 */
(function (global) {
  "use strict";

  var state = {
    mode: "month",
    cursor: startOfDay(new Date()),
  };

  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function addDays(date, amount) {
    var next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    next.setDate(next.getDate() + amount);
    return next;
  }

  function startOfWeek(date) {
    var day = date.getDay();
    var offset = day === 0 ? -6 : 1 - day;
    return addDays(date, offset);
  }

  function iso(date) {
    return CosmicDB.formatDate(date);
  }

  function prettyMonth(date) {
    return date.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  }

  function prettyDay(date) {
    return date.toLocaleDateString("en-IN", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  function appointmentsOn(dateIso) {
    return CosmicDB.getAppointments()
      .filter(function (item) {
        return item.date === dateIso;
      })
      .sort(function (a, b) {
        return CosmicDB.timeToMinutes(a.time) - CosmicDB.timeToMinutes(b.time);
      });
  }

  function pill(item) {
    return (
      '<button class="cal-pill ' +
      item.status +
      '" type="button" data-open-appt="' +
      item.id +
      '">' +
      item.time +
      " · " +
      item.patientName +
      "</button>"
    );
  }

  function renderMonth(root) {
    var year = state.cursor.getFullYear();
    var month = state.cursor.getMonth();
    var first = new Date(year, month, 1);
    var start = startOfWeek(first);
    var today = iso(new Date());
    var weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    var html = '<div class="month-weekdays">';
    weekdays.forEach(function (day) {
      html += "<span>" + day + "</span>";
    });
    html += '</div><div class="month-days">';

    for (var i = 0; i < 42; i += 1) {
      var day = addDays(start, i);
      var dateIso = iso(day);
      var outside = day.getMonth() !== month;
      var items = appointmentsOn(dateIso);
      html +=
        '<div class="month-day' +
        (outside ? " muted" : "") +
        (dateIso === today ? " today" : "") +
        '">';
      html += '<span class="day-num">' + day.getDate() + "</span>";
      items.slice(0, 3).forEach(function (item) {
        html += pill(item);
      });
      if (items.length > 3) {
        html += '<span class="muted">+' + (items.length - 3) + " more</span>";
      }
      html += "</div>";
    }
    html += "</div>";
    root.innerHTML = html;
  }

  function renderWeek(root) {
    var start = startOfWeek(state.cursor);
    var hours = [];
    for (var h = 9; h <= 18; h += 1) hours.push(h);

    var html = '<table class="week-table"><thead><tr><th></th>';
    for (var d = 0; d < 7; d += 1) {
      var day = addDays(start, d);
      html +=
        "<th>" +
        day.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }) +
        "</th>";
    }
    html += "</tr></thead><tbody>";

    hours.forEach(function (hour) {
      html += '<tr><td class="time-col">' + formatHour(hour) + "</td>";
      for (var col = 0; col < 7; col += 1) {
        var dateIso = iso(addDays(start, col));
        var items = appointmentsOn(dateIso).filter(function (item) {
          var minutes = CosmicDB.timeToMinutes(item.time);
          return Math.floor(minutes / 60) === hour;
        });
        html += "<td>" + items.map(pill).join("") + "</td>";
      }
      html += "</tr>";
    });
    html += "</tbody></table>";
    root.innerHTML = html;
  }

  function renderDay(root) {
    var dateIso = iso(state.cursor);
    var items = appointmentsOn(dateIso);
    var slots = CosmicDB.getSlotsForDate(dateIso);
    if (!slots.length && !items.length) {
      root.innerHTML = '<div class="empty-state"><strong>No schedule</strong>Nothing is booked or published for this day.</div>';
      return;
    }

    var html = '<div class="day-list">';
    if (slots.length) {
      slots.forEach(function (slot) {
        var booked = items.filter(function (item) {
          return CosmicDB.normalizeTime(item.time) === CosmicDB.normalizeTime(slot.time);
        });
        html += '<div class="day-slot"><strong>' + slot.time + "</strong><div>";
        if (booked.length) {
          html += booked.map(pill).join("");
        } else {
          html +=
            '<span class="muted">' +
            (slot.status === "unavailable" ? "Unavailable" : "Open") +
            "</span>";
        }
        html += "</div></div>";
      });
    } else {
      items.forEach(function (item) {
        html += '<div class="day-slot"><strong>' + item.time + "</strong><div>" + pill(item) + "</div></div>";
      });
    }
    html += "</div>";
    root.innerHTML = html;
  }

  function formatHour(hour) {
    var mer = hour >= 12 ? "PM" : "AM";
    var display = hour % 12;
    if (display === 0) display = 12;
    return display + ":00 " + mer;
  }

  function label() {
    if (state.mode === "month") return prettyMonth(state.cursor);
    if (state.mode === "week") {
      var start = startOfWeek(state.cursor);
      var end = addDays(start, 6);
      return (
        start.toLocaleDateString("en-IN", { day: "numeric", month: "short" }) +
        " – " +
        end.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
      );
    }
    return prettyDay(state.cursor);
  }

  function render() {
    var month = document.getElementById("monthGrid");
    var week = document.getElementById("weekGrid");
    var day = document.getElementById("dayGrid");
    var title = document.getElementById("calendarLabel");
    if (!month || !week || !day) return;

    month.classList.toggle("active", state.mode === "month");
    week.classList.toggle("active", state.mode === "week");
    day.classList.toggle("active", state.mode === "day");

    if (state.mode === "month") renderMonth(month);
    if (state.mode === "week") renderWeek(week);
    if (state.mode === "day") renderDay(day);
    if (title) title.textContent = label();
  }

  function setMode(mode) {
    state.mode = mode;
    render();
  }

  function shift(direction) {
    if (state.mode === "month") {
      state.cursor = new Date(state.cursor.getFullYear(), state.cursor.getMonth() + direction, 1);
    } else if (state.mode === "week") {
      state.cursor = addDays(state.cursor, direction * 7);
    } else {
      state.cursor = addDays(state.cursor, direction);
    }
    render();
  }

  function goToday() {
    state.cursor = startOfDay(new Date());
    render();
  }

  function bind() {
    var prev = document.getElementById("calPrev");
    var next = document.getElementById("calNext");
    var today = document.getElementById("calToday");
    if (prev) prev.addEventListener("click", function () { shift(-1); });
    if (next) next.addEventListener("click", function () { shift(1); });
    if (today) today.addEventListener("click", goToday);

    var switches = document.querySelectorAll("[data-cal]");
    Array.prototype.forEach.call(switches, function (button) {
      button.addEventListener("click", function () {
        Array.prototype.forEach.call(switches, function (node) {
          node.classList.remove("active");
        });
        button.classList.add("active");
        setMode(button.getAttribute("data-cal"));
      });
    });
  }

  global.CosmicCalendar = {
    render: render,
    bind: bind,
    setMode: setMode,
    goToday: goToday,
  };
})(window);
