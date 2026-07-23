/**
 * Formate une date cible (Timestamp Firebase ou Date JS) pour l'affichage en français
 * @param {Timestamp|Date|string|null|undefined} targetDate
 * @returns {string|null} Format "dd/mm/yyyy" ou null si invalide
 */
export function formatTargetDate(targetDate) {
  if (!targetDate) return null;

  try {
    let date;

    // Cas 1: Timestamp Firebase avec méthode .toDate()
    if (targetDate && typeof targetDate.toDate === "function") {
      date = targetDate.toDate();
    }
    // Cas 2: Date JavaScript
    else if (targetDate instanceof Date) {
      date = targetDate;
    }
    // Cas 3: String (au cas où)
    else if (typeof targetDate === "string") {
      date = new Date(targetDate);
    } else {
      return null;
    }

    // Vérifier si la date est valide
    if (isNaN(date.getTime())) {
      return null;
    }

    return date.toLocaleDateString("fr-FR");
  } catch (error) {
    console.error("Erreur lors du formatage de la date:", error);
    return null;
  }
}

/**
 * Convertit une date pour l'input HTML type="date" (format YYYY-MM-DD)
 * @param {Timestamp|Date|string|null|undefined} date
 * @returns {string} Format "YYYY-MM-DD" ou ""
 */
export function dateToInputFormat(date) {
  if (!date) return "";

  try {
    let dateObj;

    if (date && typeof date.toDate === "function") {
      dateObj = date.toDate();
    } else if (date instanceof Date) {
      dateObj = date;
    } else if (typeof date === "string") {
      dateObj = new Date(date);
    } else {
      return "";
    }

    if (isNaN(dateObj.getTime())) {
      return "";
    }

    // Format YYYY-MM-DD pour HTML input
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, "0");
    const day = String(dateObj.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  } catch (error) {
    console.error("Erreur lors de la conversion de la date:", error);
    return "";
  }
}
