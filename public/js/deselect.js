document.addEventListener('DOMContentLoaded', function() {
    var userSelect = document.getElementById('selectedUsers');
    var selectionState = {};

    userSelect.addEventListener('click', function(e) {
        if (e.target.tagName === 'OPTION') {
            var optionValue = e.target.value;
            
            // Αντιστροφή της κατάστασης επιλογής του συγκεκριμένου option
            selectionState[optionValue] = !selectionState[optionValue];
            e.target.selected = selectionState[optionValue];
        }
    });
});
