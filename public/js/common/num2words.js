// Συναρτήσεις για μετατροπή αριθμού σε λέξεις
const numbersToWords = (n) => {
    const ones = ['', 'ένα', 'δύο', 'τρία', 'τέσσερα', 'πέντε', 'έξι', 'επτά', 'οκτώ', 'εννέα', 'δέκα', 
        'έντεκα', 'δώδεκα', 'δεκατρία', 'δεκατέσσερα', 'δεκαπέντε', 'δεκαέξι', 'δεκαεπτά', 'δεκαοκτώ', 'δεκαεννέα'];
    const tens = ['', '', 'είκοσι', 'τριάντα', 'σαράντα', 'πενήντα', 'εξήντα', 'εβδομήντα', 'ογδόντα', 'ενενήντα'];
    
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    
    if (n < 1000) {
      const hundreds = Math.floor(n / 100);
      const remainder = n % 100;
  
      const hundredsText = 
        hundreds === 1 ? 'εκατό' :
        hundreds === 2 ? 'διακόσια' :
        hundreds === 3 ? 'τριακόσια' :
        hundreds === 4 ? 'τετρακόσια' :
        hundreds === 5 ? 'πεντακόσια' :
        hundreds === 6 ? 'εξακόσια' :
        hundreds === 7 ? 'επτακόσια' :
        hundreds === 8 ? 'οκτακόσια' :
        hundreds === 9 ? 'εννιακόσια' : '';
  
      return hundredsText + (remainder ? ' ' + numbersToWords(remainder) : '');
    }
  
    if (n < 1000000) {
        return numbersToWords(Math.floor(n / 1000)) + ' χιλιάδες' + 
               (n % 1000 ? ' ' + numbersToWords(n % 1000) : '');
    }
    
    return numbersToWords(Math.floor(n / 1000000)) + ' εκατομμύρια' + 
           (n % 1000000 ? ' ' + numbersToWords(n % 1000000) : '');
  };
  
  // Συνάρτηση για μετατροπή αριθμού με δεκαδικά σε λεκτική περιγραφή
  const numberToText = (num, type = 'money') => {
    const whole = Math.floor(num); // Το ακέραιο μέρος
    const decimal = Math.round((num - whole) * 100); // Το δεκαδικό μέρος (π.χ. 81 για 3527.81)
  
    let wholeText = numbersToWords(whole);
    let decimalText = decimal > 0 ? numbersToWords(decimal) : '';
  
    switch(type) {
      case 'money': // Χρήση για ποσά σε ευρώ
        return decimalText 
          ? `${wholeText} ευρώ και ${decimalText} λεπτά` 
          : `${wholeText} ευρώ`;
      case 'time': // Χρήση για ώρες και λεπτά
        return decimalText 
          ? `${wholeText} ώρες και ${decimalText} λεπτά` 
          : `${wholeText} ώρες`;
      default: // Απλά αριθμοί
        return decimalText 
          ? `${wholeText} και ${decimalText}` 
          : `${wholeText}`;
    }
  }; 
  


