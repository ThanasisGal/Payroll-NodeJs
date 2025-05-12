// Γεμίζει μηδενικά τον αριθμό προσθέτοντάς τα στην αρχή   πχ το 1 με totalLength 4 θα δώσει 0001

function formatNumber(number, totalLength) {
  // Μετατροπή του αριθμού σε string και προσθήκη προπορευόμενων μηδενικών με την padStart()
  return number.toString().padStart(totalLength, '0');
}

export default formatNumber;
