(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.FrequencyCalc = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const LEVELS = Object.freeze([
    { id: "100", p: 1, label: "Sempre", english: "Always / Constantly", words: ["Always", "Constantly", "Continually"], italian: "Sempre, costantemente, continuamente" },
    { id: "90", p: 0.9, label: "Quasi sempre", english: "Usually / Normally", words: ["Almost always", "Nearly always", "Usually", "Normally", "Generally"], italian: "Quasi sempre, di solito, normalmente, generalmente" },
    { id: "75", p: 0.75, label: "Spesso", english: "Often / Frequently", words: ["Regularly", "Frequently", "Often"], italian: "Regolarmente, frequentemente, spesso" },
    { id: "50", p: 0.5, label: "A volte", english: "Sometimes", words: ["Sometimes"], italian: "A volte" },
    { id: "third", p: 1 / 3, label: "Un terzo del tempo", english: "One third of the time", words: ["One third of the time"], italian: "Un terzo del tempo (livello aggiunto)" },
    { id: "25", p: 0.25, label: "Occasionalmente", english: "Occasionally", words: ["Occasionally", "From time to time", "Now and then", "Every so often"], italian: "Occasionalmente, di tanto in tanto, ogni tanto" },
    { id: "10", p: 0.1, label: "Raramente", english: "Rarely / Seldom", words: ["Once in a while", "Infrequently", "Seldom", "Rarely"], italian: "Una volta ogni tanto, poco frequentemente, raramente" },
    { id: "0", p: 0, label: "Mai", english: "Never / Hardly ever", words: ["Hardly ever", "Scarcely ever", "Almost never", "Never"], italian: "Quasi mai, mai" }
  ]);
  const PERIODS = Object.freeze([
    { id: "day", label: "24 ore", short: "24h", days: 1 },
    { id: "week", label: "7 giorni", short: "7 gg", days: 7 },
    { id: "fortnight", label: "14 giorni", short: "14 gg", days: 14 },
    { id: "month", label: "30 giorni", short: "30 gg", days: 30 },
    { id: "quarter", label: "90 giorni", short: "90 gg", days: 90 },
    { id: "year", label: "365 giorni", short: "365 gg", days: 365 }
  ]);
  function getLevel(id) {
    return LEVELS.find(function (x) { return x.id === id; }) || null;
  }
  function split(days, portion) {
    if (!Number.isFinite(days) || days < 0 || !Number.isFinite(portion) || portion < 0 || portion > 1) throw new RangeError("Periodo o percentuale non validi");
    return { activeDays: days * portion, inactiveDays: days * (1 - portion), activeHours: days * 24 * portion, inactiveHours: days * 24 * (1 - portion) };
  }
  function occurrences(hours, interval, startNow) {
    if (!(hours >= 0) || !(interval > 0) || !Number.isFinite(hours) || !Number.isFinite(interval)) throw new RangeError("Ore e intervallo non validi");
    const offset = startNow ? 0 : interval;
    if (hours <= offset) return 0;
    return Math.max(0, Math.ceil((hours - offset) / interval - 1e-12));
  }
  function averageOccurrences(hours, interval) {
    if (hours < 0 || !Number.isFinite(hours) || !(interval > 0) || !Number.isFinite(interval)) throw new RangeError("Ore e intervallo non validi");
    return hours / interval;
  }
  function fmt(value, places) {
    const digits = places == null ? 2 : places;
    const safe = Math.abs(value) < 1e-9 ? 0 : value;
    return new Intl.NumberFormat("it-IT", { maximumFractionDigits: digits }).format(safe);
  }
  function fmtTime(hours) {
    if (!Number.isFinite(hours) || hours < 0) throw new RangeError("Ore non valide");
    let minutes = Math.round(hours * 60);
    const days = Math.floor(minutes / 1440);
    minutes %= 1440;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    const parts = [];
    if (days) parts.push(days + " gg");
    if (h) parts.push(h + " h");
    if (m) parts.push(m + " min");
    return parts.join(" ") || "0 h";
  }
  return Object.freeze({ LEVELS: LEVELS, PERIODS: PERIODS, getLevel: getLevel, split: split, occurrences: occurrences, averageOccurrences: averageOccurrences, fmt: fmt, fmtTime: fmtTime });
});