const loadEfories = async () => {
  const wrapper   = document.querySelector(".wrapper");
  const selectBtn = wrapper.querySelector(".select-btn");
  const options   = wrapper.querySelector(".options");
  const searchInp = wrapper.querySelector("input");
  let originalList = [];

  const makeListItem = (efories) => {
    const li = document.createElement("li");
    const textContent = `${efories.kodikos} ${sevenSpaces.slice(efories.kodikos.length)} ${efories.perigrafh}`;
    const isLong = textContent.length > 60;

    li.textContent = textContent;
    li.dataset.value = efories.kodikos;
    li.classList.toggle("li-long", isLong);   // ✅ styling μέσω CSS κλάσης

    li.addEventListener("click", () => {
      updateName(textContent);
    });

    return li;
  };

  const renderList = (list) => {
    const frag = document.createDocumentFragment();
    list.forEach(ef => frag.appendChild(makeListItem(ef)));
    options.replaceChildren(frag);
  };

  const executeSearch = () => {
    const q = searchInp.value.toLowerCase();
    const filtered = originalList.filter(({ kodikos, perigrafh }) =>
      kodikos.toLowerCase().includes(q) || perigrafh.toLowerCase().includes(q)
    );
    renderList(filtered);
  };

  selectBtn.addEventListener("click", () => wrapper.classList.toggle("active"));

  const updateList = (data) => {
    originalList = data;
    renderList(data);
  };

  const updateName = (selectedDoy) => {
    searchInp.value = "";
    wrapper.classList.remove("active");
    selectBtn.firstElementChild.innerText = selectedDoy;
    executeSearch(); // επαναφέρουμε τη λίστα μετά το clear
  };

  try {
    const response = await fetch("/api/doy");
    const data = await response.json();
    updateList(data);

    // καλύτερο από keyup για IME/επικόλληση κ.λπ.
    searchInp.addEventListener("input", executeSearch);
  } catch (error) {
    console.error(error);
  }
};
