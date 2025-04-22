function showAlert(message, onCloseCallback = null) {
    return new Promise((resolve) => {
        // Αφαιρούμε τυχόν υπάρχον modal
        closeModal();

        // Δημιουργία modal
        const overlay = document.createElement("div");
        overlay.className = "modal-overlay";

        const modal = document.createElement("div");
        modal.className = "modal_";

        // Προσθήκη περιεχομένου στο modal
        modal.innerHTML = `
            ${message}
            <button class="close-button">OK</button>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // Κλείσιμο του modal με ένα κλικ
        const closeButton = modal.querySelector(".close-button");
        closeButton.addEventListener("click", () => {
            closeModal(); // Κλείσιμο του modal
            setTimeout(() => {
                if (onCloseCallback) onCloseCallback();
                resolve();
            }, 0);
        });
    });

    function closeModal() {
        const overlay = document.querySelector(".modal-overlay");
        if (overlay) overlay.remove();
    }
}
