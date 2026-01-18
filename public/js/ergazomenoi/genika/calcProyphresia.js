document.addEventListener("DOMContentLoaded", function() {
  const proyphresiaSeEthInput = document.getElementById("proyphresia_se_eth");
  const proyphresiaSeMhnesInput = document.getElementById("proyphresia_se_mhnes");
  const hmeromhniaProslhpshsInput = document.getElementById("hmeromhnia_proslhpshs");
  const misthologikoKlimakioInput = document.getElementById("misthologiko_klimakio");

  proyphresiaSeEthInput.addEventListener("change", calculateTotalExperience);
  proyphresiaSeMhnesInput.addEventListener("change", calculateTotalExperience);
  hmeromhniaProslhpshsInput.addEventListener("change", calculateTotalExperience);

  function calculateTotalExperience() {
    const today = new Date();
    const hmeromhniaProslhpshs = new Date(hmeromhniaProslhpshsInput.value);
    let yearsDifference = today.getFullYear() - hmeromhniaProslhpshs.getFullYear();
    let monthsDifference = today.getMonth() - hmeromhniaProslhpshs.getMonth();

    if (today.getDate() < hmeromhniaProslhpshs.getDate()) {
      monthsDifference--;
    }
    if (monthsDifference < 0) {
      yearsDifference--;
      monthsDifference += 12;
    }

    const proyphresiaSeEth = parseInt(proyphresiaSeEthInput.value, 10);
    const proyphresiaSeMhnes = parseInt(proyphresiaSeMhnesInput.value, 10);

    let totalYears = parseInt(yearsDifference, 10) + parseInt(proyphresiaSeEth, 10);
    let totalMonths = parseInt(monthsDifference, 10) + parseInt(proyphresiaSeMhnes, 10);

    if (totalMonths >= 12) {
      totalYears += Math.floor(totalMonths / 12);
      totalMonths %= 12;
    }

    if (totalMonths === 12) {
      totalYears += 1;
      totalMonths = 0;
    }

    if (totalYears < 0) {
      totalYears = 0;
    }

    document.getElementById("synolo_proyphresias_se_eth").value = totalYears || 0;
    document.getElementById("synolo_proyphresias_se_mhnes").value = totalMonths || 0;

    updateMisthologikoKlimakio(totalYears, hmeromhniaProslhpshs, today);
  }

  function updateMisthologikoKlimakio(totalYears, startDate, endDate) {
    let misthologikoKlimakio = 1;
    if (totalYears >= 1) {
      misthologikoKlimakio = totalYears + 1;
    }
    misthologikoKlimakioInput.value = misthologikoKlimakio;
  }

  function countLeapYears(startDate, endDate) {
    let count = 0;
    for (let year = startDate.getFullYear(); year <= endDate.getFullYear(); year++) {
      if ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0) {
        count++;
      }
    }
    return count;
  }

  function calculateDaysIncludingLeapYears(startDate, endDate) {
    const oneDay = 24 * 60 * 60 * 1000; // hours*minutes*seconds*milliseconds
    const leapDays = countLeapYears(startDate, endDate);
    const diffDays = Math.round(Math.abs((endDate - startDate) / oneDay)) + leapDays;

    return diffDays;
  }
});
