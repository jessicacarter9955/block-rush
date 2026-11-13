(function () {
  "use strict";
  const C = window.FrequencyCalc;
  const el = function (id) { return document.getElementById(id); };
  const state = { level: "third", custom: null, period: "month", mode: "time" };
  const periodTitles = { day: "24 ore", week: "7 giorni", fortnight: "14 giorni", month: "30 giorni", quarter: "90 giorni", year: "365 giorni" };
  function percent() {
    return state.level === "custom" ? state.custom : C.getLevel(state.level).p;
  }
  function save() {
    try { localStorage.setItem("frequency-atlas-v1", JSON.stringify(state)); } catch (e) {}
  }
  function restore() {
    try {
      const s = JSON.parse(localStorage.getItem("frequency-atlas-v1") || "null");
      if (!s) return;
      if (s.level === "custom" && Number.isFinite(s.custom) && s.custom >= 0 && s.custom <= 1) { state.level = "custom"; state.custom = s.custom; }
      else if (C.getLevel(s.level)) { state.level = s.level; }
      if (C.PERIODS.some(function (p) { return p.id === s.period; })) state.period = s.period;
      if (s.mode === "time" || s.mode === "days") state.mode = s.mode;
    } catch (e) {}
  }
  function selectedLabel() {
    return state.level === "custom" ? "Percentuale personalizzata" : C.getLevel(state.level).label;
  }
  function prettyPct(p) {
    return Math.abs(p - 1 / 3) < 1e-9 ? "33⅓%" : C.fmt(p * 100) + "%";
  }
  function makeLevels() {
    el("level-buttons").innerHTML = C.LEVELS.map(function (l) {
      const t = l.id === "third" ? "33⅓" : String(Math.round(l.p * 100));
      return '<button type="button" data-level="' + l.id + '" class="level-button" aria-pressed="false">' + t + '<small>%</small></button>';
    }).join("");
    el("level-buttons").addEventListener("click", function (evt) {
      const b = evt.target.closest("button[data-level]");
      if (!b) return;
      state.level = b.dataset.level; state.custom = null; render(); save();
    });
    el("custom-range").addEventListener("input", function (evt) {
      const n = Number(evt.target.value);
      if (!Number.isFinite(n)) return;
      state.level = "custom"; state.custom = n / 100; render(); save();
    });
  }
  function makePeriods() {
    el("period-tabs").innerHTML = C.PERIODS.map(function (p) {
      return '<button type="button" data-period="' + p.id + '" aria-pressed="false">' + p.short + '</button>';
    }).join("");
    el("period-tabs").addEventListener("click", function (evt) {
      const b = evt.target.closest("button[data-period]");
      if (!b) return;
      state.period = b.dataset.period; render(); save();
    });
  }
  function renderLevel() {
    const p = percent();
    const ptext = prettyPct(p);
    el("level-pct").textContent = ptext;
    el("selection-name").textContent = selectedLabel();
    el("range-readout").textContent = C.fmt(p * 100) + "%";
    el("custom-range").value = Math.round(p * 100);
    el("hero-rate").innerHTML = (Math.abs(p - 1 / 3) < 1e-9 ? "33⅓" : C.fmt(p * 100)) + "<small>%</small>";
    const deg = p * 360;
    const circle = document.querySelector(".hero-circle.inner");
    circle.style.background = "conic-gradient(#25825e 0deg " + deg + "deg, #d5e8db " + deg + "deg 360deg)";
    document.querySelectorAll("[data-level]").forEach(function (b) {
      const active = b.dataset.level === state.level;
      b.classList.toggle("active", active);
      b.setAttribute("aria-pressed", String(active));
    });
    if (state.level === "custom") {
      el("adverb-list").innerHTML = "<strong>Percentuale personalizzata.</strong> Le traduzioni degli avverbi non hanno una percentuale matematica universale.";
    } else {
      const level = C.getLevel(state.level);
      el("adverb-list").innerHTML = "<strong>" + level.english + ":</strong> " + level.words.join(" · ") + ". <span>" + level.italian + ".</span>";
    }
  }
  function renderPeriod() {
    const p = percent();
    const period = C.PERIODS.find(function (x) { return x.id === state.period; });
    const r = C.split(period.days, p);
    document.querySelectorAll("[data-period]").forEach(function (b) {
      const active = b.dataset.period === period.id;
      b.classList.toggle("active", active);
      b.setAttribute("aria-pressed", String(active));
    });
    const day = period.id === "day";
    el("active-days").textContent = day ? C.fmt(r.activeHours) : C.fmt(r.activeDays);
    el("inactive-days").textContent = day ? C.fmt(r.inactiveHours) : C.fmt(r.inactiveDays);
    el("active-days-unit").textContent = day ? "ore equivalenti" : "giorni equivalenti";
    el("inactive-days-unit").textContent = day ? "ore equivalenti" : "giorni equivalenti";
    el("active-hours").textContent = day ? C.fmt(r.activeDays) + " giorni" : C.fmt(r.activeHours) + " ore · " + C.fmtTime(r.activeHours);
    el("inactive-hours").textContent = day ? C.fmt(r.inactiveDays) + " giorni" : C.fmt(r.inactiveHours) + " ore · " + C.fmtTime(r.inactiveHours);
    const track = el("split-active");
    track.style.width = (p * 100) + "%";
    track.style.borderRadius = p >= 0.99999 ? "99px" : "99px 0 0 99px";
    el("split-track").setAttribute("aria-label", C.fmt(p * 100) + "% di tempo attivo, " + C.fmt((1 - p) * 100) + "% inattivo");
    el("split-text").textContent = C.fmt(p * 100) + "% attivo";
    el("split-rest").textContent = C.fmt((1 - p) * 100) + "% inattivo";
    const blocks = period.id === "day" ? 24 : (period.days <= 30 ? period.days : 30);
    el("period-blocks").style.gridTemplateColumns = "repeat(" + blocks + ", minmax(0, 1fr))";
    el("period-blocks").innerHTML = Array.from({ length: blocks }, function (_, i) {
      return '<span class="' + (i < Math.round(blocks * p) ? "on" : "") + '"></span>';
    }).join("");
    renderMode(period, r);
  }
  function renderMode(period, r) {
    const p = percent();
    document.querySelectorAll("#mode-switch button").forEach(function (b) {
      b.classList.toggle("active", b.dataset.mode === state.mode);
      b.setAttribute("aria-pressed", String(b.dataset.mode === state.mode));
    });
    const blocks = state.mode === "days" ? Math.min(period.days, 30) : 24;
    const activeBlocks = Math.round(blocks * p);
    el("mode-illustration").innerHTML = '<div class="mode-day-row">' + Array.from({ length: blocks }, function (_, i) {
      return '<span class="day-box' + (i < activeBlocks ? " active" : "") + '"></span>';
    }).join("") + '</div><small>' + (state.mode === "days" ? "Giornate con almeno una sessione (arrotondate)" : "Quota temporale proporzionale, non un orario reale") + '</small>';
    if (state.mode === "days") {
      const d = Math.round(period.days * p);
      el("mode-result").innerHTML = "Su <strong>" + period.days + " giorni</strong>: circa <strong>" + d + " giorni con attività</strong> e <strong>" + (period.days - d) + " senza</strong>.";
      el("mode-note").textContent = "Ipotesi: al massimo una giornata attiva al giorno. Una giornata attiva può contenere una sessione di qualsiasi durata.";
    } else {
      el("mode-result").innerHTML = "Nel periodo: <strong>" + C.fmt(r.activeDays) + " giorni equivalenti</strong> = <strong>" + C.fmt(r.activeHours) + " ore</strong> di attività.";
      el("mode-note").textContent = "Questa modalità somma il tempo. Non indica quante sessioni svolgi: 8 ore al giorno e 10 giorni interi al mese sono esempi differenti.";
    }
  }
  function renderReference() {
    const id = state.level;
    const rows = C.LEVELS.map(function (l) {
      const cells = C.PERIODS.map(function (period) {
        const s = C.split(period.days, l.p);
        const main = period.id === "day" ? C.fmt(s.activeHours) + " h" : C.fmt(s.activeDays) + " gg";
        const sub = period.id === "day" ? C.fmt(s.activeDays) + " gg" : C.fmt(s.activeHours) + " h";
        return '<td><div class="cell-main">' + main + '</div><div class="cell-sub">' + sub + '</div></td>';
      }).join("");
      return '<tr class="' + (l.id === id ? "active-row" : "") + '"><td class="frequency-cell">' + prettyPct(l.p) + '</td>' + cells + '</tr>';
    });
    el("reference-rows").innerHTML = rows.join("");
    document.querySelectorAll("#all-adverbs .word-card").forEach(function (card) { card.classList.toggle("active", card.dataset.level === id); });
  }
  function renderAdverbs() {
    el("all-adverbs").innerHTML = C.LEVELS.map(function (l) {
      return '<article class="word-card" data-level="' + l.id + '"><div class="word-percent">' + prettyPct(l.p) + '<span aria-hidden="true"></span></div><p>' + l.words.join(" · ") + '</p><div class="word-it">' + l.italian + '</div></article>';
    }).join("");
  }
  function renderRecurrence() {
    const n = Number(el("every-hours").value);
    const valid = Number.isFinite(n) && n >= 0.01 && n <= 8760;
    el("interval-error").hidden = valid;
    if (!valid) {
      el("recurrence-average").textContent = "—";
      el("example-strip").textContent = "Inserisci un intervallo da 0,01 a 8760 ore.";
      el("recurrence-rows").innerHTML = "";
      return;
    }
    const now = document.querySelector('input[name="first-event"]:checked').value === "now";
    el("recurrence-average").textContent = C.fmt(C.averageOccurrences(24, n));
    el("recurrence-rows").innerHTML = C.PERIODS.map(function (period) {
      const hours = period.days * 24;
      return '<tr><td>' + periodTitles[period.id] + '</td><td><strong>' + C.fmt(C.occurrences(hours, n, now), 0) + '</strong></td><td>' + C.fmt(C.averageOccurrences(hours, n)) + '</td></tr>';
    }).join("");
    const today = C.occurrences(24, n, now);
    const starts = now ? 0 : n;
    const first = Array.from({ length: Math.min(today, 6) }, function (_, i) { return C.fmt(starts + i * n); });
    const times = today > 0 ? " (ore " + first.join(", ") + (today > 6 ? ", …" : "") + ")" : "";
    el("example-strip").textContent = "Ogni " + C.fmt(n) + " ore, " + (now ? "da subito" : "dopo il primo intervallo") + " → " + C.fmt(today, 0) + " occorrenze nelle prime 24 ore" + times + ".";
  }
  function csv() {
    const header = ["Frequenza", "Periodo", "Attivo giorni", "Attivo ore", "Inattivo giorni", "Inattivo ore"];
    const rows = [header].concat(C.LEVELS.flatMap(function (l) {
      return C.PERIODS.map(function (period) {
        const s = C.split(period.days, l.p);
        return [prettyPct(l.p), period.label, C.fmt(s.activeDays, 5), C.fmt(s.activeHours, 5), C.fmt(s.inactiveDays, 5), C.fmt(s.inactiveHours, 5)];
      });
    }));
    const str = "\uFEFF" + rows.map(function (r) { return r.map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(";"); }).join("\r\n");
    const blob = new Blob([str], { type: "text/csv;charset=utf-8" });
    const uri = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = uri; a.download = "frequency-atlas-tabella.csv"; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(uri); }, 1000);
  }
  function render() { renderLevel(); renderPeriod(); renderReference(); }
  function init() {
    restore(); makeLevels(); makePeriods(); renderAdverbs();
    el("mode-switch").addEventListener("click", function (evt) {
      const b = evt.target.closest("button[data-mode]");
      if (!b) return;
      state.mode = b.dataset.mode; renderPeriod(); save();
    });
    el("every-hours").addEventListener("input", renderRecurrence);
    document.querySelectorAll('input[name="first-event"]').forEach(function (input) { input.addEventListener("change", renderRecurrence); });
    el("download-csv").addEventListener("click", csv);
    render(); renderRecurrence();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();