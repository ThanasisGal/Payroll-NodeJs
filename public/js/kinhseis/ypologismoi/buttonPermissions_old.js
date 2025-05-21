export async function setButtonPermissions(isAdmin, canCreate, canUpdate, canUndo, canDelete) {
    const saveButton = document.getElementById("saveButton");
    const updateButton = document.getElementById("updateButton");
    const undoButton = document.getElementById("undoButton");
    const deleteButton = document.getElementById("deleteButton");

    // Εφαρμογή κανόνων απενεργοποίησης για saveButton
    if (!isAdmin) {
        if (!canCreate) {
            disableSaveButton(saveButton);
        } else 
            enableSaveButton(saveButton);
    } else {
        enableSaveButton(saveButton);
    }

    // Εφαρμογή κανόνων απενεργοποίησης για updateButton
    if (!isAdmin && !canUpdate) {
        disableButton(updateButton);
    } else if (isAdmin && !canUpdate) {
        disableButton(updateButton);
    } else {
        enableButton(updateButton);
    }

    // Εφαρμογή κανόνων απενεργοποίησης για undoButton
    if (!isAdmin) {
        if (!canUndo) {
            disableButton(undoButton);
        } else 
            enableButton(undoButton);
    } else {
        enableButton(undoButton);
    }


    // Εφαρμογή κανόνων απενεργοποίησης για deleteButton
    if (!isAdmin && !canDelete) {
        disableButton(deleteButton);
    } else if (isAdmin && !canDelete) {
        disableButton(deleteButton);
    } else {
        enableButton(deleteButton);
    }
}
