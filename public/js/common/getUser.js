document.addEventListener("DOMContentLoaded", () => {
    const fiveSpaces = '\u00A0'.repeat(5);
    const fifteenSpaces = '\u00A0'.repeat(25);
    const twentyfiveSpaces = '\u00A0'.repeat(25);
    
    // const initialUser = '<%= typeof userName !== "undefined" ? userName : "" %>';
    const initialUser = "Χρήστης : " + twentyfiveSpaces + "Group : " + fifteenSpaces;
    document.getElementById("selectedUser").innerHTML =
    initialUser;
  
    const updateUser = async () => {
      try {
        const response = await fetch(`/api/user`);
        const newUser = await response.json();
        
        if (newUser) {
          document.getElementById("selectedUser").innerHTML =
            "Χρήστης : " + newUser.firstName + fiveSpaces + "Group : " + newUser.team;
        } else {
            "Χρήστης : " + fiveSpaces + "Group : ";
        }
      } catch (error) {
        console.error("Πρόβλημα κατά την εμφάνιση του ονόματος και της ομάδας εργασίας του χρήστη:", error);
      }
    };
  
    updateUser();
  });
  