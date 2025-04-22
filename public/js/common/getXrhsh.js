document.addEventListener("DOMContentLoaded", () => {
    const initialYearInUse =
      '<%= typeof yearInUse !== "undefined" ? yearInUse : "" %>';
    document.getElementById("selectedYear").innerHTML =
      initialYearInUse;
  
    const updateYearInUse = async () => {
      try {
        const response = await fetch(`/api/yearInUse`);
        const newYearInUse = await response.text();
        // Ανανεώνει το περιεχόμενο του αντίστοιχου <a> element
        document.getElementById("selectedYear").innerHTML =
          "Χρήση : " + newYearInUse.substring(1, newYearInUse.length - 1);
      } catch (error) {
        console.error("Πρόβλημα κατά την εμφάνιση του έτους αλλαγής χρήσης:", error);
      }
    };
  
    updateYearInUse();
  });
  