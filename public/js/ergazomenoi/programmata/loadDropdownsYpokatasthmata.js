document.addEventListener("DOMContentLoaded", function () {
  const ypokatasthmataDropdown = document.getElementById("ypokatasthmata");
  
  const loadYpokatasthmata = async () => {
    ypokatasthmataDropdown.innerHTML = '';
    const emptyOption = new Option('', '');
    ypokatasthmataDropdown.appendChild(emptyOption);

    try {
      const response = await fetch("/api/ypokatasthmata");
      const data = await response.json();
      data.forEach((data) => {

        let txtContent = data.perigrafh;

        const option = new Option(txtContent, data.kodikos);
        ypokatasthmataDropdown.appendChild(option);
      });
    } catch (error) {
      console.error(error);
    }
  };

  // Change event listener for 'ergazomenos' dropdown
  ypokatasthmataDropdown.addEventListener("change", async () => {
    const selectedYpokatasthma = ypokatasthmataDropdown.value;
    document.getElementById("ypokatasthmaHidden").value = selectedYpokatasthma;

    const selectedOption = ypokatasthmataDropdown.options[ypokatasthmataDropdown.selectedIndex];
    if (selectedOption.value) {
      const txtContent = selectedOption.text;
      const lastFourChars = txtContent.slice(-4);
      document.getElementById("ypokatasthmaHidden").value = selectedOption.value;
    } else {
      document.getElementById("ypokatasthmaHidden").value = '';
    }
  });
  
  loadYpokatasthmata();

})
