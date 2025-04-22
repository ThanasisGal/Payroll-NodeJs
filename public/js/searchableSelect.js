const loadEfories = async () => {
  const wrapper = document.querySelector(".wrapper");
  const selectBtn = wrapper.querySelector(".select-btn");
  const options = wrapper.querySelector(".options");
  const searchInp = wrapper.querySelector("input");
  let originalList = [];

  const executeSearch = () => {
    const searchWord = searchInp.value.toLowerCase();
    const filteredItems = originalList.filter((efories) => {
      const kodikos = efories.kodikos.toLowerCase();
      const perigrafh = efories.perigrafh.toLowerCase();
      return kodikos.includes(searchWord) || perigrafh.includes(searchWord);
    });

    options.innerHTML = "";
    filteredItems.forEach((efories) => {
      const listItem = document.createElement("li");
      const textContent = `${efories.kodikos} ${sevenSpaces.slice(efories.kodikos.length)} ${efories.perigrafh}`;
      if (textContent.length > 60) {
        listItem.style.lineHeight = "44px";
      } else {
        listItem.style.lineHeight = "22px";
      }
      listItem.style.lineHeight = listItem.getAttribute("data-line-height"); // Ορίζουμε το αρχικό lineHeight
      listItem.textContent = textContent;
      listItem.dataset.value = efories.kodikos;

      listItem.addEventListener("click", () => {
        updateName(textContent);
        listItem.style.lineHeight = listItem.getAttribute("data-line-height"); // Επαναφέρουμε το lineHeight
      });

      options.appendChild(listItem);
    });
  };

  selectBtn.addEventListener("click", () => wrapper.classList.toggle("active"));

  const updateList = (data) => {
    originalList = data;

    options.innerHTML = "";
    data.forEach((efories) => {
      const listItem = document.createElement("li");
      listItem.textContent = `${efories.kodikos} ${sevenSpaces.slice(
        efories.kodikos.length
      )} ${efories.perigrafh}`;
      listItem.dataset.value = efories.kodikos;

      listItem.addEventListener("click", () => {
        updateName(`${efories.kodikos} ${sevenSpaces.slice(efories.kodikos.length)} ${efories.perigrafh}`);
      });

      options.appendChild(listItem);
    });
  };

  const updateName = (selectedDoy) => {
    searchInp.value = "";
    wrapper.classList.remove("active");
    selectBtn.firstElementChild.innerText = selectedDoy;
    executeSearch();
  };

  try {
    const response = await fetch("/api/doy");
    const data = await response.json();
    updateList(data);

    searchInp.addEventListener("keyup", () => {
      executeSearch();
    });
  } catch (error) {
    console.error(error);
  }
};
