function convertStringToDate(str) {
    const parts = str.split('/');
    const day = parts[0];
    const month = parts[1];
    const year = parts[2];
  
    // Μετατροπή σε μορφή ISO (yyyy-mm-dd)
    const isoFormattedStr = `${year}-${month}-${day}`;
  
    return new Date(isoFormattedStr);
  }
  
  const myDateString = "31/12/2023";
  const myDate = convertStringToDate(myDateString);
  