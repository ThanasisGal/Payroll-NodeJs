document.addEventListener("DOMContentLoaded", () => {
    function disableButton(button) {
    button.classList.add("disabled-link");
    }

    function disableSaveButton(button) {
        button.disabled = true;
    }

    // Συνάρτηση για ενεργοποίηση του κουμπιού
    function enableButton(button) {
        button.classList.remove("disabled-link");
        button.style.pointerEvents = "auto"; // Επιτρέπει το κλικ
        button.style.opacity = "1"; // Επαναφέρει την κανονική εμφάνιση
        button.style.color = "white";
    }

    // Συνάρτηση για ενεργοποίηση του κουμπιού
    function enableSaveButton(button) {
        button.disabled = false;
    }
});