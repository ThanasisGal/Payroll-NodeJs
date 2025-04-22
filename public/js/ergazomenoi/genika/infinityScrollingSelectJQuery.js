$(function() {
  // Αρχικοποίηση του Select2 με δυνατότητα αναζήτησης μέσω AJAX
  $('#eidikothta_erganh').select2({
      ajax: {
          url: '/api/eidikothtesErganh',
          dataType: 'json',
          delay: 250,
          data: function (params) {
              return {
                  query: params.term, // Ο όρος αναζήτησης από τον χρήστη
                  page: params.page || 1
              };
          },
          processResults: function (data, params) {
              params.page = params.page || 1;
              return {
                  results: data.map(item => ({
                      id: item.kodikos,
                      text: item.kodikos.padEnd(9, '\u00A0') + item.perigrafh
                  })),
                  pagination: {
                      more: (params.page * 30) < data.length
                  }
              };
          },
          cache: true
      },
      placeholder: 'Αναζήτηση...',
      minimumInputLength: 3
  });

  var initialEidikothtaId = $('#eidikothtaErganh').val();

  // Φόρτωση της αρχικής επιλεγμένης τιμής
  $.ajax({
    url: '/api/getSelectedEidikothta',
    method: 'GET',
    data: { id: initialEidikothtaId },  // Περνάμε την τιμή ως παράμετρο στο API
    dataType: 'json',
    success: function(data) {
        var selectedOption = new Option(data.text, data.id, true, true);
        $('#eidikothta_erganh').append(selectedOption).trigger('change');
    },
    error: function(error) {
        console.error('Error loading initial data:', error);
    }
});

  // Ενημέρωση του κρυφού πεδίου κατά την επιλογή τιμής
  $('#eidikothta_erganh').on('select2:select', function (e) {
      var selectedId = e.params.data.id;
      $('#kodikos_eidikothtas_erganh').val(selectedId);
  });
});
