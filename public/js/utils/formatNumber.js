// Γεμίζει μηδενικά προσθέτοντάς τα στην αρχή

function formatNumber(number, totalLength) {
  // Μετατροπή του αριθμού σε string και προσθήκη προπορευόμενων μηδενικών με την padStart()
  return number.toString().padStart(totalLength, '0');
}

export default formatNumber;
