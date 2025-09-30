// document.addEventListener("DOMContentLoaded", function () {
//   function formatISODate(isoDate) {
//     const date = new Date(isoDate);
//     return date.toISOString().split("T")[0];
//   }
//   window.formatISODate = formatISODate;
  
// });


document.addEventListener("DOMContentLoaded", function () {
  /**
   * Μετατρέπει διάφορες μορφές ημερομηνίας σε "YYYY-MM-DD" (input[type=date]).
   * Αν δεν μπορεί να καταλάβει την τιμή → επιστρέφει "".
   */
  function formatISODate(value) {
    if (value == null) return "";
    if (value instanceof Date && !isNaN(value)) {
      return value.toISOString().slice(0, 10);
    }

    const s = String(value).trim();
    if (!s) return "";

    // Numeric timestamp (ms ή s)
    if (/^\d+$/.test(s)) {
      const n = Number(s.length <= 10 ? Number(s) * 1000 : Number(s));
      const d = new Date(n);
      return isNaN(d) ? "" : d.toISOString().slice(0, 10);
    }

    // YYYY-MM-DD ή YYYY/MM/DD ή YYYY.MM.DD
    let m = s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})$/);
    if (m) {
      const [, yy, mm, dd] = m.map(Number);
      const d = new Date(Date.UTC(yy, mm - 1, dd));
      return isNaN(d) ? "" : d.toISOString().slice(0, 10);
    }

    // DD/MM/YYYY ή DD-MM-YYYY ή DD.MM.YYYY
    m = s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/);
    if (m) {
      const [, dd, mm, yy] = m.map(Number);
      const d = new Date(Date.UTC(yy, mm - 1, dd));
      return isNaN(d) ? "" : d.toISOString().slice(0, 10);
    }

    // Fallback: ό,τι άλλο αναγνωρίζει ο Date
    const d = new Date(s);
    return isNaN(d) ? "" : d.toISOString().slice(0, 10);
  }

  window.formatISODate = formatISODate;
});
