// Ορίζουμε τις μεταβλητές για τα inputs και τις labels
document.addEventListener('DOMContentLoaded', function() {
  const inputs = {
      eponymo: document.getElementById('eponymo'),
      onoma: document.getElementById('onoma'),
      afm: document.getElementById('afm'),
      amka: document.getElementById('amka')
  };
 
  const labels = {
      eponymo: [
          'Apodoxes', 'Krathseis', 'Allodapoi', 'Katartish', 'Diafora', 'Istoriko', 'Oraria' ].map(suffix => document.getElementById(`eponymoLabel_${suffix}`)),
      onoma: [
          'Apodoxes', 'Krathseis', 'Allodapoi', 'Katartish', 'Diafora', 'Istoriko', 'Oraria'
      ].map(suffix => document.getElementById(`onomaLabel_${suffix}`)),
      afm: [
          'Apodoxes', 'Krathseis', 'Allodapoi', 'Katartish', 'Diafora', 'Istoriko', 'Oraria'
      ].map(suffix => document.getElementById(`afmLabel_${suffix}`)),
      amka: [
          'Apodoxes', 'Krathseis', 'Allodapoi', 'Katartish', 'Diafora', 'Istoriko', 'Oraria'
      ].map(suffix => document.getElementById(`amkaLabel_${suffix}`))
  };

  function updateLabels(inputType, value) {
      labels[inputType].forEach(label => {
          if (label) {
              label.textContent = value;
          }
      });
  }

  Object.keys(inputs).forEach(type => {
      if (inputs[type]) {
          inputs[type].addEventListener('input', function() {
              updateLabels(type, this.value);
          });
      }
  });
});
