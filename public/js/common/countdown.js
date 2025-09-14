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
    const totalSeconds = Math.ceil(remainingTime / 1000); // προς τα πάνω για να μη χάνεις το 300
    remainingTimeElement.classList.remove("rt-white", "rt-orange", "rt-red");

    if (totalSeconds >= 900) {
      remainingTimeElement.classList.add("rt-white");   // 30' - 15'
    } else if (totalSeconds >= 300) {
      remainingTimeElement.classList.add("rt-orange");  // 15' - 05'
    } else {
      remainingTimeElement.classList.add("rt-red");     // 05' - 00'
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
        remainingTimeElement.classList.remove("white", "orange", "red");
        remainingTimeElement.classList.add("red");        
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
