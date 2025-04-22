document.addEventListener("DOMContentLoaded", () => {
    
    const initialPeriod =
      '<%= typeof periodInUseDescr !== "undefined" ? periodInUseDescr : "" %>';
    document.getElementById("selectedPeriod").innerHTML =
    initialPeriod;
  
    const updatePeriod = async () => {
      try {
        const response = await fetch(`/api/periodInUse`);
        const newPeriodInUse = await response.text();
        document.getElementById("selectedPeriod").innerHTML =
          "Περίοδος : " + newPeriodInUse.substring(1, newPeriodInUse.length - 1);
      } catch (error) {
        console.error("Πρόβλημα κατά την εμφάνιση της περιόδου εργασίας:", error);
      }
    };
  
    updatePeriod();
  });
  