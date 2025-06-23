document.addEventListener("DOMContentLoaded", () => {
    const initialAppDateInUse =
      '<%= typeof appDate !== "undefined" ? appDate : "" %>';
    document.getElementById("selectedDate").innerHTML = initialAppDateInUse;
  
    const updateAppDate = async () => {
      try {
        const response = await fetch(`/api/appDateInUse`);
        const newAppDateInUse = await response.text();
        // Ανανεώνει το περιεχόμενο του αντίστοιχου <a> element
        document.getElementById("selectedDate").innerHTML =
          "Ημ/νία Χρήσης : " + `${newAppDateInUse.substring(9,11)}/${newAppDateInUse.substring(6,8)}/${newAppDateInUse.substring(1,5)}`;
      } catch (error) {
        console.error("Πρόβλημα κατά την εμφάνιση της ημερομηνίας χρήσης της εφαρμογής:", error);
      }
    };

    updateAppDate();
  });
  