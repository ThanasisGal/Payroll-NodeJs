// import { hasRecord } from './loadDropdowns.js';

async function applyButtonPermissions(hasRecord) {
    document.querySelectorAll("section").forEach(section => {
        const saveButton = section.querySelector("[id^=saveButton]");
        const updateButton = section.querySelector("[id^=updateButton]");
        const undoButton = section.querySelector("[id^=undoButton]");
        const deleteButton = section.querySelector("[id^=deleteButton]");

        const canCreate = saveButton?.getAttribute("data-create") === "true";
        const canUpdate = updateButton?.getAttribute("data-update") === "true";
        const canUndo = undoButton?.getAttribute("data-undo") === "true";
        const canDelete = deleteButton?.getAttribute("data-delete") === "true";

        if (!saveButton || !updateButton || !undoButton || !deleteButton) return;

        // Αν κάποιο κουμπί δεν έχει άδεια (canXXX === false), παραμένει απενεργοποιημένο
        if (!canCreate) disableButton_Permissions(saveButton);
        if (!canUpdate) disableButton_Permissions(updateButton);
        if (!canUndo) disableButton_Permissions(undoButton);
        if (!canDelete) disableButton_Permissions(deleteButton);

        // 🔹 Αν δεν υπάρχει record (hasRecord === false), ορίζουμε τα κουμπιά σε όλα τα sections
        if (!hasRecord) {
            if (canCreate) enableButton_Permissions(saveButton);
            disableButton_Permissions(updateButton);
            disableButton_Permissions(undoButton);
            disableButton_Permissions(deleteButton);
        } 
        // 🔹 Αν υπάρχει record (hasRecord === true), ενημερώνουμε όλα τα sections
        else {
            if (canCreate) disableButton_Permissions(saveButton);
            if (canUpdate) enableButton_Permissions(updateButton);
            if (canUndo) disableButton_Permissions(undoButton);
            if (canDelete) enableButton_Permissions(deleteButton);
        }
    });

    await toggleReadonlyFields(hasRecord);
}

// ✅ Εκτελείται στην αρχική φόρτωση της σελίδας
document.addEventListener("DOMContentLoaded", function () {
    applyButtonPermissions(hasRecord);
});

// ✅ Εκτελείται όταν πατηθεί Save και ενημερώνει **όλα τα sections**
document.querySelectorAll("[id^=saveButton]").forEach(saveButton => {
    saveButton.addEventListener("click", function () {
        hasRecord = true;
        applyButtonPermissions(hasRecord);
    });
});

// ✅ Εκτελείται όταν πατηθεί Undo και ενημερώνει **όλα τα sections**
document.querySelectorAll("[id^=undoButton]").forEach(undoButton => {
    undoButton.addEventListener("click", function () {
        hasRecord = false;
        applyButtonPermissions(hasRecord);
    });
});

function disableButton_Permissions(button) {
    if (button) {
        button.classList.add("disabled-link");
        button.style.pointerEvents = "none"; // Αποτρέπει το κλικ
        button.style.opacity = "0.4"; // Οπτικό feedback
        button.style.color = "black";
    }
}

function enableButton_Permissions(button) {
    if (button) {
        button.classList.remove("disabled-link");
        button.style.pointerEvents = "auto"; // Επιτρέπει το κλικ
        button.style.opacity = "1"; // Επαναφέρει την κανονική εμφάνιση
        button.style.color = "white";
    }
}
