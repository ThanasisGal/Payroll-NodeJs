const threeSpaces = '\u00A0'.repeat(3);
const fiveSpaces = '\u00A0'.repeat(5);
const sixSpaces = '\u00A0'.repeat(6);
const sevenSpaces = '\u00A0'.repeat(7);
const nineSpaces = '\u00A0'.repeat(9);
const tenSpaces = '\u00A0'.repeat(10);
const fifteenSpaces = '\u00A0'.repeat(15);

document.addEventListener("DOMContentLoaded", function () {
  const perifereiesDropdown = document.getElementById("perifereia");
  const nomosDropdown = document.getElementById("nomos");
  const dhmosDropdown = document.getElementById("dhmos");
  const polhDropdown = document.getElementById("polh");
  const typoiTaytothtonDropdown = document.getElementById("typos_taytothtas");
  const yphkoothtesDropdown = document.getElementById("yphkoothta");
  const eidikesKathgoriesDropdown = document.getElementById("eidikh_kathgoria_ergazomenoy");
  const oikogeneiakhKatastashDropdown = document.getElementById("oikogeneiakh_katastash");
  const trapezesDropdown = document.getElementById("trapeza");
  const kathestosApasxolhshsDropdown = document.getElementById("kathestos_apasxolhshs");
  const sxeseisErgasiasDropdown = document.getElementById("sxesh_ergasias");
  const syggenikesSxeseisDropdown = document.getElementById("syggenikh_sxesh");
  const theseisEythynhsDropdown = document.getElementById("thesh_eythynhs");
  const eidikesPeriptoseisDropdown = document.getElementById("eidikh_periptosh");
  const apasxolhseisBaseiSymbashsDropdown = document.getElementById("apasxolhsh_basei_symbashs");
  const tmhmataDropdown = document.getElementById("tmhma");
  const ekpaideytikaEpipedaDropdown = document.getElementById("ekpaideytiko_epipedo");
  const eidikothtesDropdown = document.getElementById("eidikothta");
  const typoiErgazomenonDropdown = document.getElementById("typos_ergazomenon");
  const ypokatasthmataDropdown = document.getElementById("ypokatasthma");
  const kadEfkaDropdown = document.getElementById("kad_efka");
  const eidikothtaEfkaDropdown = document.getElementById("eidikothta_efka");
  const kpkEfkaDropdown = document.getElementById("kpk_efka");
  const epaEfkaDropdown = document.getElementById("epa_efka");
  const programmataDypaDropdown = document.getElementById("programma_dypa");
  const dypaDropdown = document.getElementById("dypa");
  const symbaseisDropdown = document.getElementById("symbash");
  const kathgoriesSymbaseonDropdown = document.getElementById("kathgoria_symbashs");
  const eidikothtesSymbaseonDropdown = document.getElementById("eidikothta_symbashs");
  const adeiesDiamonhsMeProsbashDropdown = document.getElementById("eidos_adeias_diamonhs_me_amesh_prosbash_gia_ergasia");
  const adeiesDiamonhsXwrisProsbashDropdown = document.getElementById("eidos_adeias_diamonhs_xwris_amesh_prosbash_gia_ergasia");
  const foreisEkpaideyshsDropdown = document.getElementById("foreas_katartishs");
  const thematikaPediaDropdown = document.getElementById("thematiko_pedio");
  const thematikesEnothtesDropdown = document.getElementById("thematikh_enothta");
  
  const loadPerifereies = async () => {
    perifereiesDropdown.innerHTML = '<option value="" selected></option>';
    try {
      const response = await fetch("/api/perifereies");
      const data = await response.json();
      data.forEach((perifereia) => {
        const option = new Option(perifereia.perigrafh, perifereia.kodikos);
        perifereiesDropdown.appendChild(option);
      });
    } catch (error) {
      console.error(error);
    }
  };

  // Change event listener for 'perifereies' dropdown
  perifereiesDropdown.addEventListener("change", async () => {
    const selectedPerifereia = perifereiesDropdown.value;
    nomosDropdown.innerHTML = '<option value="" selected></option>';
    nomosDropdown.disabled = true;

    if (selectedPerifereia) {
      try {
        const response = await fetch( `/api/nomoi?perifereia=${selectedPerifereia}` );
        const data = await response.json();

        data.forEach((nomos) => {
          const option = new Option(nomos.perigrafh, nomos.kodikos);
          nomosDropdown.appendChild(option);
        });

        nomosDropdown.disabled = false;
      } catch (error) {
        console.error(error);
      }
    }
  });

  // Change event listener for 'nomos' dropdown
  nomosDropdown.addEventListener("change", async () => {
    const selectedNomos = nomosDropdown.value;
    dhmosDropdown.innerHTML = '<option value="" selected></option>';
    dhmosDropdown.disabled = true;

    if (selectedNomos) {
      try {
        const response = await fetch(`/api/dhmoi?nomos=${selectedNomos}`);
        const data = await response.json();

        data.forEach((dhmos) => {
          const option = new Option(dhmos.perigrafh, dhmos.kodikos);
          dhmosDropdown.appendChild(option);
        });

        dhmosDropdown.disabled = false;
      } catch (error) {
        console.error(error);
      }
    }
  });

  // Change event listener for 'dhmos' dropdown
  dhmosDropdown.addEventListener("change", async () => {
    const selectedDhmos = dhmosDropdown.value;
    polhDropdown.innerHTML = '<option value="" selected></option>';
    polhDropdown.disabled = true;

    if (selectedDhmos) {
      try {
        const response = await fetch(`/api/poleis?dhmos=${selectedDhmos}`);
        const data = await response.json();

        data.forEach((poleis) => {
          const option = new Option(poleis.perigrafh, poleis.kodikos);
          polhDropdown.appendChild(option);
        });

        polhDropdown.disabled = false;
      } catch (error) {
        console.error(error);
      }
    }
  });

  const doyDropdown = document.getElementById("doy");

  const addEmptyDoyOption = (dropdown) => {
    const emptyOption = document.createElement("option");
    emptyOption.value = "";
    emptyOption.textContent = "";
    dropdown.appendChild(emptyOption);
  };

  // Λειτουργία για φόρτωση δεδομένων σε dropdown
  const loadDoyDataToDropdown = async (dropdown, data) => {
    dropdown.innerHTML = ""; // Καθαρισμός του dropdown
    addEmptyDoyOption(dropdown); // Προσθήκη κενής επιλογής
    data.forEach((item) => {
      const option = document.createElement("option");
      option.value = item.value;
      option.textContent = item.value.padEnd(8, '\u00A0') + item.text;
      dropdown.appendChild(option);
    });
  };

  // Αίτημα προς τον server για να πάρει τα δεδομένα
  const fetchDoyDropdownData = async () => {
    try {
      const response = await fetch("/api/populatedoy");
      const dropdownData = await response.json();
      // Φόρτωση δεδομένων στα dropdowns
      loadDoyDataToDropdown(doyDropdown, dropdownData.doy);
      // loadDoyDataToDropdown(doy_loDropdown, dropdownData.doy_lo);
    } catch (error) {
      console.error(error);
    }
  };

  // Κλήση της συνάρτησης για να ανακτήσει τα δεδομένα
  fetchDoyDropdownData();

  const loadtypoiTaytothton = async () => {
    typoiTaytothtonDropdown.innerHTML = '<option value="" selected></option>';
    try {
      const response = await fetch("/api/typoiTaytothton");
      const data = await response.json();
      data.forEach((typosTaytothtas) => {
        const option = new Option(
          typosTaytothtas.perigrafh,
          typosTaytothtas.kodikos
        );
        typoiTaytothtonDropdown.appendChild(option);
      });
    } catch (error) {
      console.error(error);
    }
  };

  const loadYphkoothtes = async () => {
    yphkoothtesDropdown.innerHTML = '<option value="" selected></option>';
    try {
      const response = await fetch("/api/yphkoothtes");
      const data = await response.json();
      data.forEach((yphkoothta) => {
        const option = new Option(
          yphkoothta.perigrafh,
          yphkoothta.kodikos
        );
        yphkoothtesDropdown.appendChild(option);
      });
    } catch (error) {
      console.error(error);
    }
  };

  const loadEidikesKathgories = async () => {
    eidikesKathgoriesDropdown.innerHTML = '<option value="" selected></option>';
    try {
      const response = await fetch("/api/eidikesKathgories");
      const data = await response.json();
      data.forEach((eidikhKathgoria) => {
        const option = new Option(
          eidikhKathgoria.perigrafh,
          eidikhKathgoria.kodikos
        );
        eidikesKathgoriesDropdown.appendChild(option);
      });
    } catch (error) {
      console.error(error);
    }
  };

  eidikesKathgoriesDropdown.addEventListener('change', async (event) => {
    const selectedOption = event.target.value;
    try {
      const response = await fetch(`/api/oresEidikonKathgorion/${selectedOption}`);
      const data = await response.json();
      const selectedEidikhKathgoria = data; // Παίρνουμε τα δεδομένα της επιλεγμένης ειδικής κατηγορίας
      if (selectedEidikhKathgoria) {
        document.getElementById("eidikhKathgoriaErgazomenoy").value = selectedEidikhKathgoria.ores_plhroys_apasxolhshs;
      } else {
        document.getElementById("eidikhKathgoriaErgazomenoy").value = 40;
      }
      var isSpecial;
      if (selectedOption === "0004" || selectedOption === "0005") {
        isSpecial = true;
      } else {
        isSpecial = false;
      }
    
      for (var i = 1; i <= 7; i++) { 
        for (var j = 1; j <= 3; j++) {
          var enable = (isSpecial && j === 3);
          // var enable = !(isSpecial && j === 3);
          document.getElementById("apo_ora_03_0" + i).disabled = !enable;
          document.getElementById("eos_ora_03_0" + i).disabled = !enable;
          document.getElementById("dialleima_apo_ora_03_0" + i).disabled = !enable;
          document.getElementById("dialleima_eos_ora_03_0" + i).disabled = !enable;
        }
      }
    } catch (error) {
      console.error(error);
    }
  });
  
  const loadOikogeneiakhKatastash = async () => {
    oikogeneiakhKatastashDropdown.innerHTML = '<option value="" selected></option>';
    try {
      const response = await fetch("/api/oikogeneiakhKatastash");
      const data = await response.json();
      data.forEach((oikogeneiakhKatastash) => {
        const option = new Option(
          oikogeneiakhKatastash.perigrafh,
          oikogeneiakhKatastash.kodikos
        );
        oikogeneiakhKatastashDropdown.appendChild(option);
      });
    } catch (error) {
      console.error(error);
    }
  };

  const loadTrapezes = async () => {
    trapezesDropdown.innerHTML = '<option value="" selected></option>';
    try {
      const response = await fetch("/api/trapezes");
      const data = await response.json();
      data.forEach((trapeza) => {
        const option = new Option(
          trapeza.perigrafh,
          trapeza.kodikos_dias
        );
        trapezesDropdown.appendChild(option);
      });
    } catch (error) {
      console.error(error);
    }
  };

  const loadKathestosApasxolhshs = async () => {
    kathestosApasxolhshsDropdown.innerHTML = '<option value="" selected></option>';
    try {
      const response = await fetch("/api/kathestosApasxolhshs");
      const data = await response.json();
      data.forEach((kathestos) => {
        const option = new Option(
          kathestos.perigrafh,
          kathestos.kodikos
        );
        kathestosApasxolhshsDropdown.appendChild(option);
      });
    } catch (error) {
      console.error(error);
    }
  };

  const loadSxeseisErgasias = async () => {
    sxeseisErgasiasDropdown.innerHTML = '<option value="" selected></option>';
    try {
      const response = await fetch("/api/sxeseisErgasias");
      const data = await response.json();
      data.forEach((sxesh) => {
        const option = new Option(
          sxesh.perigrafh,
          sxesh.kodikos
        );
        sxeseisErgasiasDropdown.appendChild(option);
      });
    } catch (error) {
      console.error(error);
    }
  };

  const loadSyggenikesSxeseis = async () => {
    syggenikesSxeseisDropdown.innerHTML = '<option value="" selected></option>';
    try {
      const response = await fetch("/api/syggenikesSxeseis");
      const data = await response.json();
      data.forEach((syggenikhSxesh) => {
        const option = new Option(
          syggenikhSxesh.perigrafh,
          syggenikhSxesh.kodikos
        );
        syggenikesSxeseisDropdown.appendChild(option);
      });
    } catch (error) {
      console.error(error);
    }
  };

  const loadTheseisEythynhs = async () => {
    try {
      const response = await fetch("/api/theshEythynhs");
      const data = await response.json();
      data.forEach((theshEythynhs) => {
        const option = new Option(
          theshEythynhs.perigrafh,
          theshEythynhs.kodikos
        );
        theseisEythynhsDropdown.appendChild(option);
      });
    } catch (error) {
      console.error(error);
    }
  };

  const loadEidikesPeriptoseis = async () => {
    eidikesPeriptoseisDropdown.innerHTML = '<option value="" selected></option>';
    try {
      const response = await fetch("/api/eidikhPeriptosh");
      const data = await response.json();
      data.forEach((eidikhPeriptosh) => {
        const option = new Option(
          eidikhPeriptosh.perigrafh,
          eidikhPeriptosh.kodikos
        );
        eidikesPeriptoseisDropdown.appendChild(option);
      });
    } catch (error) {
      console.error(error);
    }
  };

  const loadApasxolhseisBaseiSymbashs = async () => {
    apasxolhseisBaseiSymbashsDropdown.innerHTML = '<option value="" selected></option>';
    try {
      const response = await fetch("/api/apasxolhseisBaseiSymbashs");
      const data = await response.json();
      data.forEach((apasxolhshBaseiSymbashs) => {
        const option = new Option(
          apasxolhshBaseiSymbashs.perigrafh,
          apasxolhshBaseiSymbashs.kodikos
        );
        apasxolhseisBaseiSymbashsDropdown.appendChild(option);
      });

      } catch (error) {
      console.error(error);
    }
  };

  // Προσθήκη κενής επιλογής στο dropdown
  const addEmptyOption = (dropdown) => {
    const emptyOption = document.createElement("option");
    emptyOption.value = ""; // Κενή τιμή
    emptyOption.textContent = ""; // Κενό κείμενο
    dropdown.appendChild(emptyOption);
  };

  const loadAsfalistikesKlaseisToDropdown = (dropdown, data) => {
    dropdown.innerHTML = ""; // Καθαρισμός του dropdown
    addEmptyOption(dropdown); // Προσθήκη κενής επιλογής

    data.forEach((item) => {
      const option = document.createElement("option");
      option.value = item.value; // Συνδυασμός του etos και kodikos για το value του option
      // Εξασφάλισε ότι η perigrafh είναι συμβολοσειρά και όχι undefined
      option.textContent = item.text;
      dropdown.appendChild(option);
    });
  };

  const fetchDropdownDataAsfalistikesKlaseis = async () => {
    try {
      const response = await fetch("/api/asfalistikesKlaseis");
      const dropdownData = await response.json();
      // Φόρτωση δεδομένων στο dropdown
      const asfalistikhKlashDropdown = document.getElementById("asfalistikh_klash");
      loadAsfalistikesKlaseisToDropdown(asfalistikhKlashDropdown, dropdownData.asfalistikh_klash);
    } catch (error) {
      console.error('Σφάλμα κατά τη φόρτωση δεδομένων: ', error);
    }
  };

  const loadTmhmata = async () => {
    tmhmataDropdown.innerHTML = '<option value="" selected></option>';
    try {
      const response = await fetch("/api/tmhmata");
      const data = await response.json();
      data.forEach((tmhma) => {
        const option = new Option(
          tmhma.perigrafh,
          tmhma.kodikos
        );
        tmhmataDropdown.appendChild(option);
      });
    } catch (error) {
      console.error(error);
    }
  };

  const loadEkpaideytikaEpipeda = async () => {
    ekpaideytikaEpipedaDropdown.innerHTML = '<option value="" selected></option>';
    try {
      const response = await fetch("/api/ekpaideytikaEpipeda");
      const data = await response.json();
      data.forEach((ekpaideytikoEpipedo) => {
        const option = new Option(
          ekpaideytikoEpipedo.perigrafh,
          ekpaideytikoEpipedo.kodikos
        );
        ekpaideytikaEpipedaDropdown.appendChild(option);
      });
    } catch (error) {
      console.error(error);
    }
  };

  const loadEidikothtes = async () => {
    eidikothtesDropdown.innerHTML = '<option value="" selected></option>';
    try {
      const response = await fetch("/api/eidikothtes");
      const data = await response.json();
      data.forEach((eidikothta) => {
        const option = new Option(
          eidikothta.perigrafh,
          eidikothta.kodikos
        );
        eidikothtesDropdown.appendChild(option);
      });
    } catch (error) {
      console.error(error);
    }
  };

  const loadTypoiErgazomenon = async () => {
    typoiErgazomenonDropdown.innerHTML = '<option value="" selected></option>';
    try {
      const response = await fetch("/api/typoiErgazomenon");
      const data = await response.json();
      data.forEach((typosErgazomenoy) => {
        const option = new Option(
          typosErgazomenoy.perigrafh,
          typosErgazomenoy.kodikos
        );
        typoiErgazomenonDropdown.appendChild(option);
      });
    } catch (error) {
      console.error(error);
    }
  };

  const loadYpokatasthmata = async () => {
    ypokatasthmataDropdown.innerHTML = '<option value="" selected></option>';
    try {
      const response = await fetch("/api/ypokatasthmata");
      const data = await response.json();
      data.forEach((ypokatasthma) => {
        const option = new Option(
          ypokatasthma.perigrafh,
          ypokatasthma.kodikos
        );
        ypokatasthmataDropdown.appendChild(option);
      });
    } catch (error) {
      console.error(error);
    }
  };

  const loadKadEfka = async () => {
    kadEfkaDropdown.innerHTML = '<option value="" selected></option>';
    try {
      const response = await fetch("/api/kadEfka");
      const data = await response.json();

      let textToConvert
      data.forEach((kadEfka) => {
        textToConvert = removeGreekAccentsAndToUpper(kadEfka.perigrafh);
        const option = new Option(kadEfka.kodikos.padEnd(10, '\u00A0') + textToConvert, kadEfka.kodikos);
        kadEfkaDropdown.appendChild(option);
      });
    } catch (error) {
      console.error(error);
    }
  };

  kadEfkaDropdown.addEventListener("change", async () => {
    const selectedKadEfka = kadEfkaDropdown.value;
    eidikothtaEfkaDropdown.innerHTML = '<option value="" selected></option>';
    eidikothtaEfkaDropdown.disabled = true;

    if (selectedKadEfka) {
      document.getElementById('kad_efka_hidden').value = selectedKadEfka;
      try {
        const response = await fetch( `/api/antistoixishKadEidikothtesEfka?kodikos_kad=${selectedKadEfka}` );
        const data = await response.json();

        let textToConvert
        data.forEach((eidikothtaEfka) => {
          textToConvert = removeGreekAccentsAndToUpper(eidikothtaEfka.perigrafh);
          const option = new Option(eidikothtaEfka.kodikos.padEnd(8, '\u00A0') + textToConvert, eidikothtaEfka.kodikos);
          eidikothtaEfkaDropdown.appendChild(option);
        });

        eidikothtaEfkaDropdown.disabled = false;
      } catch (error) {
        console.error(error);
      }
    }
  });

  eidikothtaEfkaDropdown.addEventListener("change", async () => {
    const selectedKadEfka = kadEfkaDropdown.value;
    const selectedEidikothtaEfka = eidikothtaEfkaDropdown.value;
    kpkEfkaDropdown.innerHTML = '<option value="" selected></option>';
    kpkEfkaDropdown.disabled = true;

    if (selectedEidikothtaEfka) {
      document.getElementById('eidikothta_efka_hidden').value = selectedEidikothtaEfka
      try {
        const response = await fetch( `/api/antistoixishKadKpkEfka?kodikos_kad=${selectedKadEfka}&kodikos_eidikothtas=${selectedEidikothtaEfka}` );
        const data = await response.json();

        let textToConvert
        data.forEach((kpkEfka) => {
          textToConvert = removeGreekAccentsAndToUpper(kpkEfka.perigrafh);
          const option = new Option(kpkEfka.kodikos.padEnd(10, '\u00A0') + textToConvert, kpkEfka.kodikos);
          kpkEfkaDropdown.appendChild(option);
        });

        kpkEfkaDropdown.disabled = false;
      } catch (error) {
        console.error(error);
      }
    }
  });

  kpkEfkaDropdown.addEventListener("change", async () => {
    const selectedKpkEfka = kpkEfkaDropdown.value;
    document.getElementById('kpk_efka_basei_symbashs').value = selectedKpkEfka;
    epaEfkaDropdown.disabled = false;
  });

  const loadEpaEfka = async () => {
    epaEfkaDropdown.innerHTML = '<option value="" selected></option>';
    try {
      const response = await fetch("/api/epaEfka");
      const data = await response.json();
      let textToConvert
      data.forEach((epaEfka) => {
        textToConvert = removeGreekAccentsAndToUpper(epaEfka.perigrafh);
        const option = new Option(epaEfka.kodikos.padEnd(10, '\u00A0') + textToConvert, epaEfka.kodikos);
        epaEfkaDropdown.appendChild(option);
      });
    } catch (error) {
      console.error(error);
    }
  };

  epaEfkaDropdown.addEventListener("change", async () => {
    const selectedEpaEfka = epaEfkaDropdown.value;
    const selectedKpkEfka = document.getElementById("kpk_efka_basei_symbashs").value;
    // document.getElementById("tmp_kpk_efka_basei_symbashs").value = document.getElementById("kpk_efka_basei_symbashs").value
    document.getElementById("tmp_kpk_efka_basei_symbashs").value = selectedKpkEfka;
    kpkEfkaDropdown.innerHTML = '<option value="" selected></option>';

    if (selectedEpaEfka) {
      try {
        const response = await fetch( `/api/antistoixishEpaKpkEfka?kodikos_eidikhs_periptoshs=${selectedEpaEfka}&kodikos_kpk_apo=${selectedKpkEfka}` );
        const data = await response.json();
        
        let textToConvert
        data.forEach((kpkEfka) => {
          textToConvert = removeGreekAccentsAndToUpper(kpkEfka.perigrafh);
          const option = new Option(kpkEfka.kodikos.padEnd(10, '\u00A0') + textToConvert, kpkEfka.kodikos);
          kpkEfkaDropdown.appendChild(option);
        });

        if (data.length === 1) {
          kpkEfkaDropdown.value = data[0].kodikos;
          document.getElementById("tmp_kpk_efka_basei_symbashs").value = data[0].kodikos;
        }

        kpkEfkaDropdown.disabled = false;
      } catch (error) {
        console.error(error);
      }
    }
  });

  const loadProgrammataDypa = async () => {
    programmataDypaDropdown.innerHTML = '<option value="" selected></option>';
    try {
      const response = await fetch("/api/programmataDypa");
      const data = await response.json();
      let textToConvert

      data.forEach((programmaDypa) => {
        textToConvert = removeGreekAccentsAndToUpper(programmaDypa.titlos);
        // Δημιουργία της επιλογής με τον τίτλο και το URL, καθώς και προσθήκη του κωδικού στο dataset
        const option = new Option(textToConvert, programmaDypa.url_link);
        option.dataset.kodikos = programmaDypa.kodikos; // Προσθήκη του κωδικού στο dataset του option
        programmataDypaDropdown.appendChild(option);
      });
    } catch (error) {
      console.error(error);
    }
  };
  
  programmataDypaDropdown.addEventListener("change", async (event) => {
    const selectedOption = event.target.options[event.target.selectedIndex];
    document.getElementById('gotoProgrammaDypa').href = selectedOption.value;
    // Ενημέρωση του hidden πεδίου με τον κωδικό του προγράμματος από το dataset του επιλεγμένου option
    document.getElementById('kodikos_programmatos_dypa').value = selectedOption.dataset.kodikos;
  });

  const loadDypa = async () => {
    dypaDropdown.innerHTML = '<option value="" selected></option>';
    try {
      const response = await fetch("/api/dypa");
      const data = await response.json();
      let textToConvert

      data.forEach((item) => {
        textToConvert = removeGreekAccentsAndToUpper(item.perigrafh);
        const option = new Option(item.kodikos.padEnd(10, '\u00A0') + textToConvert, item.kodikos);
        dypaDropdown.appendChild(option);
      });
    } catch (error) {
      console.error(error);
    }
  };
  
  const kentro_kostoys_1Dropdown = document.getElementById("kentro_kostoys_1");
  const kentro_kostoys_2Dropdown = document.getElementById("kentro_kostoys_2");
  const kentro_kostoys_3Dropdown = document.getElementById("kentro_kostoys_3");
  const kentro_kostoys_4Dropdown = document.getElementById("kentro_kostoys_4");

  const addEmptyOptions = (dropdown) => {
    const emptyOption = document.createElement("option");
    emptyOption.value = ""; // Κενή τιμή
    emptyOption.textContent = ""; // Κενό κείμενο ή μήνυμα
    dropdown.appendChild(emptyOption);
  };

  const loadDataToDropdown = async (dropdown, data) => {
    dropdown.innerHTML = ""; // Καθαρισμός του dropdown
    addEmptyOptions(dropdown); // Προσθήκη κενής επιλογής
    data.forEach((item) => {
      const option = document.createElement("option");
      option.value = item.value;
      option.textContent = item.text;
      dropdown.appendChild(option);
    });
  };

  const fetchDropdownDataKentraKostoys = async () => {
    try {
      const response = await fetch("/api/populateKentraKostoys");
      const dropdownData = await response.json();
      // Φόρτωση δεδομένων στα dropdowns
      loadDataToDropdown(kentro_kostoys_1Dropdown, dropdownData.kentro_kostoys_1);
      loadDataToDropdown(kentro_kostoys_2Dropdown, dropdownData.kentro_kostoys_2);
      loadDataToDropdown(kentro_kostoys_3Dropdown, dropdownData.kentro_kostoys_3);
      loadDataToDropdown(kentro_kostoys_4Dropdown, dropdownData.kentro_kostoys_4);
    } catch (error) {
      console.error(error);
    }
  };

  const loadSymbaseis = async () => {
    symbaseisDropdown.innerHTML = '<option value="" selected></option>';
    try {
      const response = await fetch("/api/symbaseis");
      const data = await response.json();

      let textToConvert
      data.forEach((symbash) => {
        textToConvert = removeGreekAccentsAndToUpper(symbash.perigrafh);
        const option = new Option(symbash.kodikos.padEnd(10, '\u00A0') + textToConvert, symbash.kodikos);
        symbaseisDropdown.appendChild(option);
      });
    } catch (error) {
      console.error(error);
    }
  };

  var kodikosSymbashs, kodikosKathgorias, kodikosEidikothtas;

  symbaseisDropdown.addEventListener("change", async () => {
    const selectedSymbash = symbaseisDropdown.value;
    document.getElementById("selectedSymbash").value
    kodikosSymbashs = selectedSymbash;
    kathgoriesSymbaseonDropdown.innerHTML = '<option value="" selected></option>';
    kathgoriesSymbaseonDropdown.disabled = true;

    if (selectedSymbash) {
      try {
        document.getElementById("selectedSymbash").value = selectedSymbash;
        const response = await fetch( `/api/kathgoriesSymbaseon/${selectedSymbash}` );
        const data = await response.json();

        data.forEach((kathgoriaSymbashs) => {
          const option = new Option(kathgoriaSymbashs.kodikos.padEnd(10,'\u00A0') + kathgoriaSymbashs.perigrafh, kathgoriaSymbashs.kodikos);
          kathgoriesSymbaseonDropdown.appendChild(option);
        });

        kathgoriesSymbaseonDropdown.disabled = false;
      } catch (error) {
        console.error(error);
      }
    }
  });

  kathgoriesSymbaseonDropdown.addEventListener("change", async () => {
    const selectedKathgoria = kathgoriesSymbaseonDropdown.value;
    kodikosKathgorias = selectedKathgoria;
    eidikothtesSymbaseonDropdown.innerHTML = '<option value="" selected></option>';
    eidikothtesSymbaseonDropdown.disabled = true;

    if (selectedKathgoria) {
      document.getElementById("selectedKathgoria").value = selectedKathgoria;
      try {
        const response = await fetch( `/api/eidikothtesSymbaseon/${kodikosSymbashs}${selectedKathgoria}` );
        const data = await response.json();

        data.forEach((eidikothtaSymbashs) => {
          const option = new Option(eidikothtaSymbashs.kodikos.padEnd(10,'\u00A0') + eidikothtaSymbashs.perigrafh, eidikothtaSymbashs.kodikos);
          eidikothtesSymbaseonDropdown.appendChild(option);
        });

        eidikothtesSymbaseonDropdown.disabled = false;
      } catch (error) {
        console.error(error);
      }
    }
  });

  eidikothtesSymbaseonDropdown.addEventListener("change", async () => {
    const selectedEidikothta = eidikothtesSymbaseonDropdown.value;
    kodikosEidikothtas = selectedEidikothta;

    if (selectedEidikothta) {
      document.getElementById("selectedEidikothta").value = selectedEidikothta;
      try {
        const response = await fetch(`/api/stoixeiaSymbaseon/${kodikosSymbashs}${kodikosKathgorias}${selectedEidikothta}`);
        const data = await response.json();
  
        for (let i = 1; i <= data.length; i++) {
          const selectElement = document.getElementById(`stoixeio_symbashs_${i.toString().padStart(2, '0')}`);
          const selectRow = document.querySelector(`.showhide_row_${i.toString().padStart(2, '0')}`);
          selectElement.innerHTML = ''; // Καθαρισμός υπαρχόντων επιλογών
  
          // Αν υπάρχουν δεδομένα, τα εμφανίζουμε σε όλα τα ενεργά select
          if (data.length > 0 && i <= data.length) {
            selectRow.classList.remove('d-none');
            // Δημιουργία και προσθήκη κενής επιλογής
            const emptyOption = new Option('', '');
            selectElement.appendChild(emptyOption);
            
            // Φόρτωση όλων των δεδομένων στο select
            data.forEach(optionData => {
              const option = new Option(optionData.kodikos.padEnd(10, '\u00A0') + optionData.perigrafh, optionData.kodikos);
              selectElement.appendChild(option);
            });
          } else {
            selectRow.classList.add('d-none');
          }
        }
        } catch (error) {
        console.error(error);
      }
    }
  });

  const loadAdeiesDiamonhsMeProsbash = async () => {
    const typosAdeias = "0";
    adeiesDiamonhsMeProsbashDropdown.innerHTML = '<option value="" selected></option>';
    try {
      const response = await fetch(`/api/adeiesDiamonhs/${typosAdeias}`);
      const data = await response.json();
      data.forEach((adeiaDiamonhs) => {
        const option = new Option(
          adeiaDiamonhs.perigrafh,
          adeiaDiamonhs.kodikos
        );
        adeiesDiamonhsMeProsbashDropdown.appendChild(option);
      });
    } catch (error) {
      console.error(error);
    }
  };

  const loadAdeiesDiamonhsXwrisProsbash = async () => {
    const typosAdeias = "1";
    adeiesDiamonhsXwrisProsbashDropdown.innerHTML = '<option value="" selected></option>';
    try {
      const response = await fetch(`/api/adeiesDiamonhs/${typosAdeias}`);
      const data = await response.json();
      data.forEach((adeiaDiamonhs) => {
        const option = new Option(
          adeiaDiamonhs.perigrafh,
          adeiaDiamonhs.kodikos
        );
        adeiesDiamonhsXwrisProsbashDropdown.appendChild(option);
      });
    } catch (error) {
      console.error(error);
    }
  };

  const loadForeisEkpaideyshs = async () => {
    foreisEkpaideyshsDropdown.innerHTML = '<option value="" selected></option>';
    try {
      const response = await fetch('/api/foreisEkpaideyshs');
      const data = await response.json();
      data.forEach((foreasEkpaideyshs) => {
        const option = new Option(
          foreasEkpaideyshs.perigrafh,
          foreasEkpaideyshs.kodikos
        );
        foreisEkpaideyshsDropdown.appendChild(option);
      });
    } catch (error) {
      console.error(error);
    }
  };

  const loadLanguages = async () => {
    let textToConvert;
    try {
      const response = await fetch('/api/languages', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
  
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
  
      const data = await response.json(); 
  
      for (let i = 1; i <= 4; i++) {
        const languagesDropdown = document.getElementById(`allh_glossa_${i.toString().padStart(2, '0')}`);
        languagesDropdown.innerHTML = '<option value="" selected></option>';
        data.forEach(language => {
          textToConvert = removeGreekAccentsAndToUpper(language.perigrafh);
          const option = new Option(textToConvert, language.kodikos);
          languagesDropdown.appendChild(option);  // Προσθήκη option στο dropdown
        });
      }
    } catch (error) {
      console.error('Error loading krathseis:', error);
    }
  };
    
  const loadThematikaPedia = async () => {
    thematikaPediaDropdown.innerHTML = '<option value="" selected></option>';
    try {
      const response = await fetch("/api/thematikaPedia");
      const data = await response.json();
      data.forEach((thematikoPedio) => {
        const option = new Option(thematikoPedio.perigrafh, thematikoPedio.kodikos);
        thematikaPediaDropdown.appendChild(option);
      });
    } catch (error) {
      console.error(error);
    }
  };

  thematikaPediaDropdown.addEventListener("change", async () => {
    const selectedThematikoPedio = thematikaPediaDropdown.value;
    thematikesEnothtesDropdown.innerHTML = '<option value="" selected></option>';
    thematikesEnothtesDropdown.disabled = true;

    if (selectedThematikoPedio) {
      try {
        const response = await fetch( `/api/thematikesEnothtes?thematikoPedio=${selectedThematikoPedio}` );
        const data = await response.json();

        data.forEach((thematikhEnothta) => {
          const option = new Option(thematikhEnothta.perigrafh, thematikhEnothta.kodikos);
          thematikesEnothtesDropdown.appendChild(option);
        });

        thematikesEnothtesDropdown.disabled = false;
      } catch (error) {
        console.error(error);
      }
    }
  });

  // const loadKathgoriesErgasias = async () => {
  //   let textToConvert;
  //   try {
  //     const response = await fetch('/api/kathgoriesErgasias', {
  //       method: 'GET',
  //       headers: { 'Content-Type': 'application/json' },
  //     });
  
  //     if (!response.ok) {
  //       throw new Error(`HTTP error! status: ${response.status}`);
  //     }
  
  //     const data = await response.json(); 
  
  //     for (let i = 1; i <= 7; i++) {
  //       const kathgoriesErgasiasDropdown = document.getElementById(`kathgoria_ergasias_${i.toString().padStart(2, '0')}`);
  //       kathgoriesErgasiasDropdown.innerHTML = '<option value="" selected></option>';
  //       data.forEach(kathgoriaErgasias => {
  //         textToConvert = removeGreekAccentsAndToUpper(kathgoriaErgasias.perigrafh);
  //         const option = new Option(textToConvert, kathgoriaErgasias.kodikos);
  //         kathgoriesErgasiasDropdown.appendChild(option);  // Προσθήκη option στο dropdown
  //       });
  //     }
  //   } catch (error) {
  //     console.error('Error loading krathseis:', error);
  //   }
  // };
    
  loadPerifereies();
  loadtypoiTaytothton();
  loadYphkoothtes();
  loadEidikesKathgories();
  loadOikogeneiakhKatastash();
  loadTrapezes();
  loadKathestosApasxolhshs();
  loadSxeseisErgasias();
  loadSyggenikesSxeseis();
  loadTheseisEythynhs();
  loadEidikesPeriptoseis();
  loadApasxolhseisBaseiSymbashs();
  fetchDropdownDataAsfalistikesKlaseis();
  loadTmhmata();
  loadEkpaideytikaEpipeda();
  loadEidikothtes();
  loadTypoiErgazomenon();
  loadYpokatasthmata();
  loadKadEfka();
  loadEpaEfka();
  loadDypa();
  loadProgrammataDypa();
  fetchDropdownDataKentraKostoys();
  loadSymbaseis();
  loadAdeiesDiamonhsMeProsbash();
  loadAdeiesDiamonhsXwrisProsbash();
  loadThematikaPedia();
  loadForeisEkpaideyshs();
  loadLanguages();
});

function removeGreekAccentsAndToUpper(text) {
  const mapping = {
      'ά': 'Α', 'έ': 'Ε', 'ή': 'Η', 'ί': 'Ι', 'ό': 'Ο', 'ύ': 'Υ', 'ώ': 'Ω',
      'Ά': 'Α', 'Έ': 'Ε', 'Ή': 'Η', 'Ί': 'Ι', 'Ό': 'Ο', 'Ύ': 'Υ', 'Ώ': 'Ω',
      'ϊ': 'Ι', 'ΐ': 'Ι', 'ϋ': 'Υ', 'ΰ': 'Υ', 'Ϊ': 'Ι', 'Ϋ': 'Υ'
  };

  return text.split('').map(function(char) {
      return mapping[char] || char;
  }).join('').toUpperCase();
}
