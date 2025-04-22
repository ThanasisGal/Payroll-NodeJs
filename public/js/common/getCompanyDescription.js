document.addEventListener("DOMContentLoaded", () => {
  const initialCompanyDescription =
    '<%= typeof companyDescription !== "undefined" ? companyDescription : "" %>';
  document.getElementById("selectedCompany").innerHTML =
    initialCompanyDescription;

  // Καλεί τον εξυπηρετητή για να λάβει τη νέα τιμή του companyDescription
  const updateCompanyDescription = async () => {
    try {
      const response = await fetch(`/api/companyDescription`);
      const newCompanyDescription = await response.text();

      // Ανανεώνει το περιεχόμενο του αντίστοιχου <a> element
      document.getElementById("selectedCompany").innerHTML =
        "Εταιρεία : " + newCompanyDescription.substring(1, newCompanyDescription.length - 1);
    } catch (error) {
      console.error("Error updating company description:", error);
    }
  };

  // Καλεί την συνάρτηση για τυχόν ενημερώσεις στο μέλλον
  updateCompanyDescription();
});
