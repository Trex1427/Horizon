function toIsoDate(year, month, day) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function normalizeImportedDate(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return null;
  }

  const normalized = raw.replace(/[.]/g, "/").replace(/-/g, "/");

  let match = normalized.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
  if (match) {
    const [, year, month, day] = match.map(Number);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return toIsoDate(year, month, day);
    }
  }

  match = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (match) {
    let [, day, month, year] = match;
    const parsedDay = Number(day);
    const parsedMonth = Number(month);
    const parsedYear = Number(year.length === 2 ? `20${year}` : year);
    if (parsedMonth >= 1 && parsedMonth <= 12 && parsedDay >= 1 && parsedDay <= 31) {
      return toIsoDate(parsedYear, parsedMonth, parsedDay);
    }
  }

  return null;
}