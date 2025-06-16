document.addEventListener("DOMContentLoaded", () => {
  const remainingTimeElement = document.getElementById("remaining-time");
  if (!remainingTimeElement) return;
  let intervalId; // Αποθηκεύει το ID του setInterval

  function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  }

  function updateTextColor(remainingTime) {
    const totalSeconds = Math.floor(remainingTime / 1000); // Υπολειπόμενος χρόνος σε δευτερόλεπτα
    if (totalSeconds > 300) {
      remainingTimeElement.style.color = "white"; // Από 15:00 έως 05:00
    } else if (totalSeconds > 60) {
      remainingTimeElement.style.color = "orange"; // Από 04:59 έως 01:00
    } else {
      remainingTimeElement.style.color = "red"; // Κάτω από 01:00
    }
  }

  async function updateRemainingTime() {
    // try {
      const response = await fetch("/remaining-time");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.remainingTime <= 0) {
        remainingTimeElement.textContent = "Λήξη!";
        remainingTimeElement.style.color = "red"; // Κόκκινο χρώμα για τη λήξη
        clearInterval(intervalId); // Σταματάει το setInterval
        document.dispatchEvent(new Event("sessionEnd")); // Ενεργοποιεί το SweetAlert2
      } else {
        remainingTimeElement.textContent = formatTime(data.remainingTime);
        updateTextColor(data.remainingTime); // Ενημέρωση του χρώματος
      }
    // } catch (error) {
    //   console.error("Error:", error);
    // }
  }

  function onSessionEnd() {
    Swal.fire({
      title: "Λήξη Συνεδρίας",
      text: "Η συνεδρία σας έχει λήξει λόγω αδράνειας. Συνδεθείτε ξανά για να συνεχίσετε...",
      icon: "error",
      timer: 4000,
      showConfirmButton: false,
      customClass: {
        title: 'custom-title',
        popup: "custom-swal-popup",
        confirmButton: "class-warning custom-confirm-button custom-swal-button",
      },
      willClose: () => {
        window.location.href = "/logout/end_Session?method=idle";
      },
    });
  }

  document.addEventListener("sessionEnd", onSessionEnd);

  // Ενημέρωση κάθε 1 δευτερόλεπτο
  updateRemainingTime(); // Αρχική ενημέρωση
  intervalId = setInterval(updateRemainingTime, 1000); // Αποθηκεύστε το ID του setInterval
});
