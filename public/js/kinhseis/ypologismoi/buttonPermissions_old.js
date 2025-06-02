// export async function setButtonPermissions(isAdmin, canCreate, canUpdate, canUndo, canDelete) {
//     const saveButton = document.getElementById("saveButton");
//     const updateButton = document.getElementById("updateButton");
//     const undoButton = document.getElementById("undoButton");
//     const deleteButton = document.getElementById("deleteButton");

//     // Εφαρμογή κανόνων απενεργοποίησης για saveButton
//     if (!isAdmin) {
//         if (!canCreate) {
//             disableSaveButton(saveButton);
//         } else 
//             enableSaveButton(saveButton);
//     } else {
//         enableSaveButton(saveButton);
//     }

//     // Εφαρμογή κανόνων απενεργοποίησης για updateButton
//     if (!isAdmin && !canUpdate) {
//         disableButton(updateButton);
//     } else if (isAdmin && !canUpdate) {
//         disableButton(updateButton);
//     } else {
//         enableButton(updateButton);
//     }

//     // Εφαρμογή κανόνων απενεργοποίησης για undoButton
//     if (!isAdmin) {
//         if (!canUndo) {
//             disableButton(undoButton);
//         } else 
//             enableButton(undoButton);
//     } else {
//         enableButton(undoButton);
//     }


//     // Εφαρμογή κανόνων απενεργοποίησης για deleteButton
//     if (!isAdmin && !canDelete) {
//         disableButton(deleteButton);
//     } else if (isAdmin && !canDelete) {
//         disableButton(deleteButton);
//     } else {
//         enableButton(deleteButton);
//     }
// }





// === Helper functions (αν δεν έχουν οριστεί αλλού) ===
function disableButton(btn) {
  if (btn) btn.disabled = true;
}

function enableButton(btn) {
  if (btn) btn.disabled = false;
}

function disableSaveButton(btn) {
  if (btn) {
    btn.disabled = true;
    btn.classList.add('disabled');
  }
}

function enableSaveButton(btn) {
  if (btn) {
    btn.disabled = false;
    btn.classList.remove('disabled');
  }
}

// === Κύρια συνάρτηση ===
async function setButtonPermissions(isAdmin, canCreate, canUpdate, canUndo, canDelete) {
  const saveButton = document.getElementById("saveButton");
  const updateButton = document.getElementById("updateButton");
  const undoButton = document.getElementById("undoButton");
  const deleteButton = document.getElementById("deleteButton");

  // === SAVE
  if (!isAdmin && !canCreate) {
    disableSaveButton(saveButton);
  } else {
    enableSaveButton(saveButton);
  }

  // === UPDATE
  if (!canUpdate) {
    disableButton(updateButton);
  } else {
    enableButton(updateButton);
  }

  // === UNDO
  if (!isAdmin && !canUndo) {
    disableButton(undoButton);
  } else {
    enableButton(undoButton);
  }

  // === DELETE
  if (!canDelete) {
    disableButton(deleteButton);
  } else {
    enableButton(deleteButton);
  }
}

// === Export για χρήση στον browser ===
if (typeof window !== "undefined") {
  window.setButtonPermissions = setButtonPermissions;
}

// === Export για CommonJS (Node) ===
if (typeof module !== "undefined" && module.exports) {
  module.exports = { setButtonPermissions };
}
