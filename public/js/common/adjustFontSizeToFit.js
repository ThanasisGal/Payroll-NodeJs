function adjustFontSizeToFit(elementId, maxRemWidth) {
  // Επιλέγουμε το στοιχείο με το συγκεκριμένο id
  const element = document.getElementById(elementId);
  const maxWidth = maxRemWidth * 16; // Μετατροπή του maxRemWidth σε pixels (1rem = 16px)
  
  // Αρχικό μέγεθος γραμματοσειράς
  let fontSize = 0.8 * 16; // 0.8rem σε pixels
  element.style.fontSize = fontSize + "px";
  
  // Ελέγχουμε αν το πλάτος του κειμένου ξεπερνά το μέγιστο πλάτος του κουμπιού
  while (element.scrollWidth > maxWidth && fontSize > 0) {
      fontSize -= 1; // Μείωση του μεγέθους γραμματοσειράς κατά 1px
      element.style.fontSize = fontSize + "px";
  }
}