document.addEventListener("DOMContentLoaded", () => {
    const twelveSpaces = '\u00A0'.repeat(12);
    
    const initialUser = "Χρήστης : " + "Group : ";
    document.getElementById("selectedUser").innerHTML =
    initialUser;
  
    const updateUser = async () => {
      try {
        const response = await fetch(`/api/user`);
        const newUser = await response.json();
        
        if (newUser) {
          let firstName = newUser.firstName;
          let paddedFirstName = firstName.length > 12 ? firstName.substring(0, 12) : firstName + twelveSpaces.substring(0, 12 - firstName.length);

          document.getElementById("selectedUser").innerHTML =
            "Χρήστης: " + paddedFirstName + " ➜ " + "Group: " + newUser.team;
        } else {
            "Χρήστης :  Group : ";
        }
      } catch (error) {
        console.error("Πρόβλημα κατά την εμφάνιση του ονόματος και της ομάδας εργασίας του χρήστη:", error);
      }
    };
  
    updateUser();
  });
  