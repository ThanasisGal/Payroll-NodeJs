// async function applyButtonPermissions(section, hasRecord) {
//     if (!section) return;

//     const saveButton = section.querySelector("[id^=saveButton]");
//     const updateButton = section.querySelector("[id^=updateButton]");
//     const undoButton = section.querySelector("[id^=undoButton]");
//     const deleteButton = section.querySelector("[id^=deleteButton]");

//     const canCreate = saveButton?.getAttribute("data-create") === "true";
//     const canUpdate = updateButton?.getAttribute("data-update") === "true";
//     const canUndo = undoButton?.getAttribute("data-undo") === "true";
//     const canDelete = deleteButton?.getAttribute("data-delete") === "true";

//     if (!saveButton || !updateButton || !undoButton || !deleteButton) return;

//     // Αν κάποιο κουμπί δεν έχει άδεια (canXXX === false), παραμένει απενεργοποιημένο
//     if (!canCreate) {
//         disableButton(saveButton);
//     }
//     if (!canUpdate) {
//         disableButton(updateButton);
//     }
//     if (!canUndo) {
//         disableButton(undoButton);
//     }
//     if (!canDelete) {
//         disableButton(deleteButton);
//     }

//     // Αν δεν υπάρχει record (hasRecord === false), ορίζουμε τα κουμπιά ανάλογα με τα δικαιώματα
//     if (!hasRecord) {
//         if (canCreate) enableButton(saveButton);
//         disableButton(updateButton);
//         disableButton(undoButton);
//         disableButton(deleteButton);
//     } 
//     // Αν υπάρχει record (hasRecord === true)
//     else {
//         if (canCreate) disableButton(saveButton);
//         if (canUpdate) enableButton(updateButton);
//         if (canUndo) disableButton(undoButton);
//         if (canDelete) enableButton(deleteButton);
//     }

//     await toggleReadonlyFields(hasRecord);
// }

// // Εκτελείται στην αρχική φόρτωση της σελίδας
// document.addEventListener("DOMContentLoaded", function () {
//     document.querySelectorAll("section").forEach(section => {
//         applyButtonPermissions(section, hasRecord);
//     });
// });

// //  Εκτελείται όταν πατηθεί Save
// document.querySelectorAll("[id^=saveButton]").forEach(saveButton => {
//     saveButton.addEventListener("click", function () {
//         hasRecord = true;
//         document.querySelectorAll("section").forEach(section => {
//             applyButtonPermissions(section, hasRecord);
//         });
//     });
// });

// //  Εκτελείται όταν πατηθεί Undo
// document.querySelectorAll("[id^=undoButton]").forEach(undoButton => {
//     undoButton.addEventListener("click", function () {
//         hasRecord = false;
//         document.querySelectorAll("section").forEach(section => {
//             applyButtonPermissions(section, hasRecord);
//         });
//     });
// });

// function disableButton(button) {
//     button.classList.add("disabled-link");
// }

// // Συνάρτηση για ενεργοποίηση του κουμπιού
// function enableButton(button) {
//     button.classList.remove("disabled-link");
//     button.style.pointerEvents = "auto"; // Επιτρέπει το κλικ
//     button.style.opacity = "1"; // Επαναφέρει την κανονική εμφάνιση
//     button.style.color = "white";
// }





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
        if (!canCreate) disableButton(saveButton);
        if (!canUpdate) disableButton(updateButton);
        if (!canUndo) disableButton(undoButton);
        if (!canDelete) disableButton(deleteButton);

        // 🔹 Αν δεν υπάρχει record (hasRecord === false), ορίζουμε τα κουμπιά σε όλα τα sections
        if (!hasRecord) {
            if (canCreate) enableButton(saveButton);
            disableButton(updateButton);
            disableButton(undoButton);
            disableButton(deleteButton);
        } 
        // 🔹 Αν υπάρχει record (hasRecord === true), ενημερώνουμε όλα τα sections
        else {
            if (canCreate) disableButton(saveButton);
            if (canUpdate) enableButton(updateButton);
            if (canUndo) disableButton(undoButton);
            if (canDelete) enableButton(deleteButton);
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

function disableButton(button) {
    if (button) {
        button.classList.add("disabled-link");
        button.style.pointerEvents = "none"; // Αποτρέπει το κλικ
        button.style.opacity = "0.5"; // Οπτικό feedback
        button.style.color = "black";
    }
}

function enableButton(button) {
    if (button) {
        button.classList.remove("disabled-link");
        button.style.pointerEvents = "auto"; // Επιτρέπει το κλικ
        button.style.opacity = "1"; // Επαναφέρει την κανονική εμφάνιση
        button.style.color = "white";
    }
}
